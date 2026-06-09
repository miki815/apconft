---
name: Poker action timeout
overview: "Server-side action timer u PokerRoom: 30s default, auto check/fold preko postojećeg applyAction(). Scope: poker/server/room.ts + room.test.ts."
todos:
  - id: room-timer-implementation
    content: ACTION_TIMEOUT_MS, actionTimerSeq, token, clear/schedule/onTimeout u poker/server/room.ts
    status: completed
  - id: room-lifecycle-hooks
    content: Hook-ovi u startHand, applyAction, beginShowdown, finishHand + failed applyAction reschedule
    status: completed
  - id: room-tests-existing
    content: Postojeći testovi sa actionTimeoutMs 0
    status: completed
  - id: room-tests-timeout
    content: 8 novih timeout testova sa actionTimeoutMs 20
    status: completed
  - id: run-poker-test
    content: npm run poker:test — 33/33 PASS
    status: completed
isProject: false
---

# Zadatak: Vremensko ograničenje poteza po igraču (action timeout)

## Status

**Implementirano i potvrđeno.** Finalni review: samo `poker/server/room.ts` i `poker/server/room.test.ts`; `npm run poker:test` → 33 pass, 0 fail.

---

## Cilj

Kada je igrač na potezu, server pokreće timer. Ako igrač ne odigra potez u zadatom vremenu:

- `toCall === 0` → automatski **check**
- `toCall > 0` → automatski **fold**

Koristi postojeći `PokerRoom.applyAction()` flow — bez dupliranja poker engine logike.

---

## Production konstante i opts

| Stavka | Vrednost |
|--------|----------|
| `ACTION_TIMEOUT_MS` | `30_000` |
| Constructor opt | `actionTimeoutMs?: number` |
| Default | `ACTION_TIMEOUT_MS` |
| Disabled | `actionTimeoutMs: 0` (skip `scheduleActionTimer`) |

---

## Stale guard (finalna verzija)

**Ne koristi `handNumber`** — resetuje se po novoj `HoldemTable` instanci.

Koristi interni monotoni counter u `PokerRoom`:

- `private actionTimerSeq = 0`
- Token: `{ seq, seat, playerId }`
- `seq` je glavna zaštita od stale / superseded callback-a

### `clearActionTimer()`

- `clearTimeout(actionTimer)`
- `actionTimerToken = null`
- **`actionTimerSeq++`** — invalidira pending/queued callback

### `scheduleActionTimer()`

- Guard: `actionTimeoutMs > 0`, `table`, `!inShowdown`, `!handComplete`, `actionSeat !== null`, igrač `active` sa `stack > 0`
- `const seq = ++this.actionTimerSeq`
- `setTimeout(() => onActionTimeout(token), actionTimeoutMs)`
- `actionTimer.unref()` — test suite ne visi na pending timerima

### `onActionTimeout(token)`

Provere pre auto-akcije:

1. `token.seq === actionTimerSeq`
2. `this.table` postoji, `!inShowdown`
3. `!state.handComplete`
4. `state.actionSeat === token.seat`
5. `player.id === token.playerId`
6. igrač `active`, `stack > 0`

Auto-akcija:

```typescript
const toCall = Math.max(0, state.currentBet - player.betThisRound)
const action = toCall > 0 ? { type: 'fold' } : { type: 'check' }
this.applyAction(player.id, action)
```

Posle uspešne auto-akcije: `this.onTableUpdate?.()` (timeout ne prolazi kroz `hub.ts` WS handler).

Ako `applyAction()` vrati grešku: bez loop-a, bez force reschedule iz `onActionTimeout`.

---

## Timer lifecycle

| Tačka | Akcija |
|-------|--------|
| Uspešan `startHand()` | **schedule** |
| Uspešan `applyAction()`, ruka traje | **clear** na ulazu → **schedule** na izlazu |
| Failed `applyAction()`, ruka traje | **clear** na ulazu → **`maybeRescheduleActionTimer()`** |
| `beginShowdown()` | **clear** |
| `finishHand()` | **clear** |
| Failed `startHand()` | defensive **clear**, bez schedule |
| Auto-next posle `finishHand()` | **schedule** indirektno kroz `startHand()` |
| `sit()` / `stand()` | no-op za timer |

---

## Failed `applyAction()` reschedule

Pošto `applyAction()` čisti timer na ulazu, na engine grešku:

```typescript
if (!r.ok) {
  this.maybeRescheduleActionTimer()
  return r.error ?? 'Invalid action'
}
```

`maybeRescheduleActionTimer()` ponovo schedule-uje ako ruka traje, nije showdown, postoji `actionSeat`.

---

## Fajlovi u scope-u

| Fajl | Izmena |
|------|--------|
| [`poker/server/room.ts`](../../poker/server/room.ts) | Timer implementacija (~98 linija dodato) |
| [`poker/server/room.test.ts`](../../poker/server/room.test.ts) | Postojeći testovi + 8 timeout testova (~306 linija dodato) |

---

## Test strategija

### Postojeći testovi

```typescript
new PokerRoom('test', { actionTimeoutMs: 0 })
```

Sprecava pending 30s timere u suite-u.

### Novi timeout testovi

```typescript
new PokerRoom('test', { actionTimeoutMs: 20 })
```

Suite: `PokerRoom action timeout` (8 testova):

1. auto-check kada `toCall === 0`
2. auto-fold kada `toCall > 0`
3. timer reset posle ručnog poteza
4. timer cleared posle fold end
5. ne act tokom showdown prikaza
6. auto-start / auto-next regression sa timerom uključenim
7. nema duplog timeout poteza posle ručnog poteza
8. stale seq guard — superseded callback se ignoriše

Test helperi (samo u `room.test.ts`):

- `sleep`, `flushTimers`, `waitForActionTimer`, `waitUntilActionSeatChanges`
- `stopRoomTimer(room)` — test teardown preko privatnog `clearActionTimer`
- `playToFlop(room)` — deterministički do flopa za auto-check test

---

## Nije dirano

- Frontend (`solana/web`)
- Vault / lock / release flow
- `hub.ts` (osim postojećeg `onTableUpdate` callback-a)
- `protocol.ts`
- Poker engine (`poker/src`)
- `.env`, `.env.example`
- `package.json`, `package-lock.json`
- Dependency-ji
- WS contract

---

## Poznati rizici (prihvatljivi za v1)

- Dupli broadcast na showdown ulaz iz timeout-a (`beginShowdown` + `onTableUpdate`) — kozmetika
- Timeout fold umesto call — namerno po specifikaciji
- `timer.unref()` — ne sprečava firing dok proces radi; olakšava test exit

---

## QA checklist

- [x] `npm run poker:test` — 33 pass, 0 fail
- [x] Auto-start prve ruke i auto-next i dalje rade
- [x] Failed sit ne pokreće ruku
- [x] Treći igrač tokom ruke blokiran
- [x] Scope: samo room.ts + room.test.ts
