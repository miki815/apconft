# Zadatak 2: Auto-start sledeće ruke posle završetka

## Status

- **Implementirano** u [`poker/server/room.ts`](../../poker/server/room.ts)
- **Testovi** u [`poker/server/room.test.ts`](../../poker/server/room.test.ts)
- **Nastavak** Zadatka 1 (`tryAutoStartHand` na `sit`) — taj flow ostaje netaknut

---

## Cilj

Kada se aktivna ruka završi, automatski pokrenuti sledeću ruku dok god za stolom sede **barem 2 igrača**.

---

## Kontekst (Zadatak 1 — ne dirati)

U `poker/server/room.ts` već postoji:

```typescript
private tryAutoStartHand(seatedBefore: number): void {
  if (this.isHandActive()) return
  if (seatedBefore >= 2) return
  if (this.seats.filter(Boolean).length < 2) return
  this.startHand()
}
```

Poziva se na kraju uspešnog `sit()` — auto-start **prve** ruke samo pri prelasku `< 2 → ≥ 2` sedećih.

---

## Gde se ruka završava

**Centralno mesto:** `finishHand()` — sva završetka prolaze kroz njega.

| Put | Ulaz |
|-----|------|
| Fold / single winner | `applyAction()` → `finishHand()` direktno |
| Showdown | `applyAction()` → `beginShowdown()` → `SHOWDOWN_MS` (5s) timer → `finishHand()` |

Redosled cleanup-a u `finishHand()`:

1. Clear showdown timer
2. `inShowdown = false`, `showdownEndsAt = null`
3. `syncStacksFromTable()`
4. `removeBustedSeats()`
5. `this.table = null`
6. **`tryAutoStartNextHandAfterFinish()`** (novo)

---

## Implementacija

### Trigger

Na kraju `finishHand()`, **posle** `this.table = null`:

```typescript
private finishHand() {
  // ... postojeći cleanup ...
  this.table = null
  this.tryAutoStartNextHandAfterFinish()
}
```

### Helper

```typescript
private tryAutoStartNextHandAfterFinish(): void {
  if (this.isHandActive()) return
  if (this.seats.filter(Boolean).length < 2) return
  this.startHand() // return se ignoriše — kao tryAutoStartHand
}
```

- Koristi postojeći `startHand()` — bez dupliranja engine logike
- Ne baca error ako `startHand()` ne uspe
- **Bez** novog timera/delay-a (showdown već ima 5s pre `finishHand`)

### Zašto je minimalno

- ~8 linija produkcijskog koda
- Jedno centralno mesto (`finishHand`) — fold i showdown
- `hub.ts` ne menja — broadcast posle `applyAction` / `onTableUpdate` šalje snapshot sa novom rukom

---

## Šta se NE menja

| Oblast | Status |
|--------|--------|
| `tryAutoStartHand(seatedBefore)` na `sit` | Netaknut |
| Frontend (`solana/web`) | Netaknut |
| Vault / lock / release | Netaknut |
| `hub.ts`, `protocol.ts` | Netaknut |
| Poker engine (`poker/src/`) | Netaknut |
| `.env`, `.env.example` | Netaknut |
| `package.json`, `package-lock.json` | Netaknut |
| Dependency-ji, WS contract | Netaknut |

---

## Edge case-ovi i ponašanje

| Scenario | Očekivano |
|----------|-----------|
| Završetak ruke, ≥2 sedeća | Auto-next pokreće sledeću ruku |
| Završetak ruke, <2 sedeća (bust) | Nema auto-next |
| Ručni `startHand()` posle auto-next | `'Hand already in progress'` |
| Drugi `sit` (Zadatak 1) | I dalje auto-start prve ruke |
| Failed `sit` | Nema auto-start |
| Treći `sit` posle fold-a | `'Cannot sit during a hand'` (auto-next odmah pokrene novu ruku) |
| Showdown put | Auto-next **posle** 5s timera (postojeći `SHOWDOWN_MS`) |
| Fold put | Auto-next odmah posle `finishHand` |

### Napomena: `handNumber`

`handNumber` u `HoldemTable` resetuje se na **1** za svaku novu instancu tabele — nije globalni brojač ruku kroz sesiju.

---

## Testovi (`poker/server/room.test.ts`)

### Novi testovi

| Test | Šta pokriva |
|------|-------------|
| `auto-starts next hand after fold with two seated` | Auto-next posle fold-a, 2 igrača |
| `does not auto-start next hand when one seated remains` | Bust → 1 igrač, nema nove ruke |
| `manual startHand after auto-next rejects duplicate` | Nema duplog starta |

### Ažurirani postojeći testovi

| Test | Promena assert-a |
|------|------------------|
| `sit, start hand, fold wins` | Posle fold-a `handInProgress === true`; chip total umanjen za blindove sledeće ruke |
| `third sit after hand ends blocked while auto-next hand runs` | `sit('c')` → `'Cannot sit during a hand'` |

### Regresija (Zadatak 1 — bez izmene)

- `first sit does not auto-start`
- `second sit auto-starts hand`
- `manual startHand after auto-start rejects duplicate`
- `failed sit does not auto-start`

---

## Rizici (dokumentovano)

- **Fold put:** nova ruka odmah (bez dodatnog delay-a)
- **Treći igrač:** nema idle prozora između ruku dok 2 igrača kontinuirano igraju
- **Chip total:** posle auto-next blindovi druge ruke se oduzimaju od ukupnog stack-a za sto

---

## Acceptance

- [x] Auto-next posle `finishHand` ako ≥2 igrača
- [x] Nema auto-next ako <2 igrača
- [x] Zadatak 1 (`sit` auto-start) i dalje radi
- [x] Nema duplog starta
- [x] `npm run poker:test` — PASS 25/25

---

## Ručni QA

Nije deo evidence fajlova — navodi se u MR opisu.
