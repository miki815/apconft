---
name: Poker allow sit during hand
overview: "Dozvoliti sedenje tokom aktivne ruke: igrač u seats (waiting), ne u trenutnom HoldemTable; ulaz u sledeću ruku kroz startHand / auto-next. Scope: room.ts, room.test.ts, ws.ts preflight."
todos:
  - id: server-checksit
    content: Ukloniti isHandActive guard iz checkSit() u room.ts
    status: completed
  - id: frontend-preflight
    content: Ukloniti handInProgress/showdownActive blok u preflightSitMessage()
    status: completed
  - id: room-tests
    content: Flip postojeći 3rd-player test + suite PokerRoom waiting sit (7 testova)
    status: completed
  - id: poker-test
    content: npm run poker:test — 40/40 PASS
    status: completed
isProject: false
---

# Zadatak: Dozvoliti sedenje tokom aktivne ruke (waiting sit)

## Status

**Implementirano.** Minimalni diff: uklonjena hand-blokada u `checkSit()` i frontend preflight. `npm run poker:test` → 40 pass, 0 fail.

---

## Cilj

Dozvoliti novom / trećem igraču da sedne na prazan seat dok je ruka već aktivna, ali **ne učestvuje u trenutnoj ruci**. Igrač je seated/waiting u `seats` i ulazi tek u **sledeću ruku** kroz postojeći `startHand()` / auto-next flow.

Očekivano ponašanje:

- Ruka aktivna + prazan seat → novi igrač može da sedne
- Novi igrač **ne** ulazi u trenutni `HoldemTable`
- Nema kart u trenutnoj ruci, nema prava akcije
- Buy-in/stack vidljiv u `seats`
- Vault flow isti: `sit-check` → lock tx → `sit`
- Auto-start, auto-next, action timeout, showdown — bez regresije

---

## Minimalni scope

| Fajl | Izmena |
|------|--------|
| `poker/server/room.ts` | Uklonjena 1 linija u `checkSit()` |
| `poker/server/room.test.ts` | Flip 1 test + 7 novih u `PokerRoom waiting sit` |
| `solana/web/src/poker/ws.ts` | Uklonjena preflight blokada za hand/showdown |

---

## Šta je menjano

### `poker/server/room.ts`

U `checkSit()` uklonjeno:

```typescript
if (this.isHandActive()) return 'Cannot sit during a hand'
```

Waiting stanje je **implicitno**: igrač u `this.seats`, ali ne u `HoldemTable.state.players` dok traje trenutna ruka.

`sit()` bez drugih promena:

1. `this.seats[seat] = { playerId, stack: buyIn }`
2. `tryAutoStartHand(seatedBefore)` — no-op dok `isHandActive()`

### `solana/web/src/poker/ws.ts`

U `preflightSitMessage()` uklonjena blokada:

```typescript
if (table.handInProgress || table.showdownActive) {
  return 'Ne možeš da sedneš tokom ruke'
}
```

### `poker/server/room.test.ts`

- Test `third sit after hand ends blocked…` → `third sit allowed while auto-next hand runs`
- Novi suite `PokerRoom waiting sit` (7 testova)

---

## Šta nije menjano

- `poker/src/` — HoldemTable engine
- `poker/src/protocol.ts` — WS tipovi
- `poker/server/hub.ts` — broadcast posle `sit` već postoji
- Vault / lock / release (`vaultTx.ts`, `tableVault.ts`, Anchor program)
- `stand()` tokom ruke — i dalje `Cannot leave during a hand`
- `startHand()`, `applyAction()`, action timeout, showdown, auto-start, auto-next logika
- `.env`, `.env.example`, `package.json`, `package-lock.json`
- Nove dependency-je
- WS message struktura
- `PokerPlay.tsx` — opcioni „čeka ruku“ label nije dodat

---

## Edge case-ovi i očekivano ponašanje

| Scenario | Ponašanje |
|----------|-----------|
| Sit preflop/flop/turn/river | OK u `seats`; ne u `state.players` |
| Sit tokom showdown prikaza | OK; ne u trenutnoj ruci |
| Sit neposredno pre auto-next | OK; uključen u sledeći `startHand()` |
| Waiting šalje `action` | Server: `Player not at table`; UI: `canAct` false |
| Waiting `stand` tokom ruke | Server odbija (van scope-a ovog taska) |
| Seat taken / already seated | `checkSit` i dalje reject |
| Invalid buy-in (≤ 0) | `buyIn must be positive` |
| MAX_SEATS (6) | `Invalid seat` za seat ≥ MAX_SEATS |
| Vault lock fail | Ne sedne; isti flow kao pre |
| Seat zauzet tokom lock-a | Drugi `checkSit` posle lock-a → `Seat taken` |
| Action timeout + waiting | Timer samo za hand players |
| Fold-win + waiting | `finishHand` → auto-next sa svim `seats` |
| Busted stack 0 | `removeBustedSeats()` na `startHand()` |

---

## Test plan

### Komanda

```bash
npm run poker:test
```

### Postojeći test izmenjen

- `third sit allowed while auto-next hand runs` (ranije očekivao reject)

### Novi testovi (`PokerRoom waiting sit`)

1. Sit tokom aktivne ruke — u `seats`, ne u `state.players`
2. `youState` — `seat` set, `holeCards: null`, `canAct: false`
3. Ulaz u sledeću ruku posle `finishHandByFold` + auto-next (3 players)
4. Treći sit ne menja broj igrača u trenutnoj ruci
5. `checkSit` reject taken / already seated tokom ruke
6. Sit tokom showdown — dozvoljen, ne u trenutnoj ruci
7. `applyAction` od waiting igrača — reject

### Rezultat

- `# tests 40`
- `# pass 40`
- `# fail 0`

Log: `task-evidence/poker-allow-sit-during-hand/poker-test-pass-40-of-40.log`

---

## Manual QA plan (frontend — nema automatskog testa)

1. `npm run poker:server` + `npm run solana:web`
2. Dva Chrome profila — oba sednu, ruka startuje (auto-start)
3. Treći profil sedne tokom **aktivne** ruke (`sit-check` → lock → `sit` ako vault uključen)
4. Proveri treći igrač:
   - Vidi seat i stack/buy-in na stolu
   - Nema hole kartic (face-down idle ili prazno)
   - Nema action dugmadi (`canAct` false)
5. Posle kraja ruke / auto-next:
   - Treći igrač u ruci sa kartama
   - Može akciju kada je na potezu
6. Regresija: auto-start 2 igrača, timeout, showdown i dalje rade

---

## Rizici / napomene

| Rizik | Nivo | Napomena |
|-------|------|----------|
| Auto-start / auto-next | Nizak | `tryAutoStartHand` guard nepromenjen |
| Action timeout / showdown | Nizak | Timer scope = hand players only |
| WS contract | Nizak | Ista `table` poruka |
| Vault race (seat tokom lock-a) | Nizak | Postojeći; drugi `checkSit` posle lock-a |
| Waiting ne može `stand` tokom ruke | UX | Postojeće pravilo; van scope-a |
| Nema „Čeka ruku“ labela | UX | Funkcionalno OK; seat/stack vidljiv |

---

## Acceptance kriterijumi

- [x] Novi igrač može `sit` tokom aktivne ruke (server + frontend preflight)
- [x] Waiting igrač u `seats`, **ne** u `state.players` tokom trenutne ruke
- [x] `youState`: `seat` postoji, `holeCards: null`, `canAct: false`
- [x] Ulaz u sledeću ruku kroz `startHand()` / auto-next bez engine promene
- [x] `checkSit` reject: taken seat, already seated, invalid buy-in
- [x] Vault flow nepromenjen (`sit-check` → lock → `sit`)
- [x] `npm run poker:test` — 40 pass, 0 fail
- [ ] Ručni QA 3 igrača (korisnik) — preporučen pre production

---

## QA checklist (automatski)

- [x] `npm run poker:test` — 40 pass, 0 fail
- [x] Scope: samo `room.ts`, `room.test.ts`, `ws.ts`
- [x] Nema promene engine, protocol, hub, vault contract
- [x] Postojeći auto-start / auto-next / timeout testovi prolaze
