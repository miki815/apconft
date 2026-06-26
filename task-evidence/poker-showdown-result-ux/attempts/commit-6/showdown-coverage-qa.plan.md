# Showdown result UX — preostali coverage i manual QA

**Branch:** `feature/poker-showdown-result-ux`  
**Tip commit-a:** coverage / QA (commit-6)  
**Prethodni commit:** `1f22c87` — server clock anchor (završen)

---

## Kontekst

> Ovaj plan se bavi zatvaranjem preostalih provera za showdown result UX MR, bez dodavanja nove funkcionalnosti.

Ovaj commit zatvara preostali **test i manual QA coverage** za već implementirani showdown result UX u istom MR-u. Nema nove funkcionalnosti, nema UX polish-a van dokumentovanog CSS fix workflow-a.

**Već urađeno u MR-u (ne ponavljati u commit-6 manual QA):**

- Server-authoritative result period: `resultKind`, `showdownEndsAt`, `resultDurationMs`, `serverNow`
- Winner rank u `TableState.winners[]` (`handRank: { category, name }`) — showdown, ne fold
- Frontend: grouped winner/pot panel, winner seat highlight, glatka countdown traka, monotoni clock anchor
- Automatska verifikacija commit-5: `npm run poker:test` 100/100, frontend build PASS
- Manual QA commit-5: HU showdown, fold, F5/reconnect, mobilni osnovni, `Date.now` override, background/minimize, mid-result add-chips (skip-vault), stari server bez `serverNow`

**Van scope-a ovog commit-a:**

- Best-five card highlight / `bestCards` contract
- Finalni root evidence folder (poseban korak posle commit-6 PASS)
- Commit / push (samo na eksplicitnu korisničku potvrdu)

---

## Automatski coverage — rank na showdown-u sa 4–6 igrača

### Odluka

Proširiti **postojeći** test u `poker/src/table.test.ts`:

`'4–6-way locked runout: lone active, rest all-in'`

**Ne** praviti novi `it(...)`.

### Minimalni assert-i (posle river `advanceRunout`, unutar postojeće petlje `n ∈ {4, 5, 6}`)

```typescript
assert.ok(river.state!.winners.length >= 1, `n=${n}`)
for (const winner of river.state!.winners) {
  assert.ok(winner.handRank, `n=${n}`)
  assert.equal(typeof winner.handRank!.category, 'number', `n=${n}`)
  assert.equal(typeof winner.handRank!.name, 'string', `n=${n}`)
}
```

Ekvivalentno: svaki winner mora imati `handRank`; proveravaju se tipovi `category` i `name`, **ne** tačno ime ruke (random deck).

### Zašto je ovo dovoljno

- Postojeći test već pokriva locked runout → showdown za 4, 5 i 6 igrača (`handComplete`, board 5).
- Gap je samo nedostajući assert na `winners` / `handRank` na tom broju igrača.
- HU i 3-way rank/tie/side-pot scenariji već imaju direktne engine testove; `showdown()` ne gradi rank drugačije po broju sedišta.

### Public flow (bez ručnog nameštanja internog state-a)

| Korak | API |
|-------|-----|
| Kreiranje stola | `nWayLockedRunoutTable(n)` → `new HoldemTable` + `startHand()` |
| Preflop all-in locked runout | `driveLockedRunout()` → `applyAction()` preko `act()` helpera |
| Turn + river | `table.advanceRunout()` (javni API, isti pattern kao ostali locked-runout testovi) |
| Showdown | `advanceRunout()` na board 5 poziva `showdown()` u engine-u |

Nema direktnog mutiranja privatnog engine state-a.

---

## Manual QA — tie / split u browseru

### Odluka

**Pokušaj je obavezan.** Ishod tie-a **nije garantovan** bez rig/deck alata — u produkcijskom serveru nema dev shuffle override-a (`riggedShuffle` postoji samo u test fajlu).

### Predlog pokušaja

1. Preduslov: `npm run poker:server` + `npm run solana:web`; skip-vault na oba env-a; **2 Chrome profila**.
2. HU, buy-in dovoljan za check/call kroz sve ulice.
3. Odigrati **više ruku** (preporuka: **3–5 pokušaja**) check/call do showdown-a.
4. Cilj: **board-play tie / split** — board daje najbolju ruku oba igrača (npr. straight na boardu), oba igrača dele pot.

### PASS ako tie uspe

- **2 winner bloka** u result panelu (2 različita `playerId` / „Ti" + drugi wallet)
- **Isti rank tekst** u per-pot linijama oba bloka
- **Oba seat-a** imaju winner highlight
- Countdown i result period završavaju normalno (regresija već pokrivena ranijim commit-om — ne ponavljati kao poseban blocker)

### Ako tie ne uspe

- U `manual-qa.md` zapisati: **`NOT REACHED random deck`**
- To **nije automatski MR FAIL**
- Logiku tie/split pokriva engine test `'board-play split winners share the same handRank'` u `poker/src/table.test.ts`

---

## Manual QA — side-pot sa različitim pobednicima

### Odluka

**Obavezan** manual QA scenario. Commit-1 manual QA pokriva **isti igrač — više potova** (grouped total); **ne** pokriva **različite igrače — različiti potovi**.

### Setup

- **3 Chrome profila / 3 wallet-a**
- Skip-vault: `POKER_SKIP_VAULT_CHECK=1` + `VITE_POKER_SKIP_VAULT_CHECK=1`
- Buy-in / stackovi približno **500 / 50 / 100** (deep / short / medium) — paritet sa engine helper flow-om

### Cilj

Side-pot showdown gde **različiti igrači** pobede **različite potove** → **2+ winner bloka** u grouped result panelu.

### Pokušaji

- **Do 5 pokušaja** (različite ruke sa istim stack setup-om)
- Svaki pokušaj: deep raise prema ~100, kratki stackovi all-in, deep call → locked runout → showdown

### Status kriterijumi

| Status | Uslov |
|--------|--------|
| **PASS** | **≥2 winner bloka**, različiti igrači; **`Glavni pot`** i **`Side pot`** linije na **različitim** igračima; winner seat highlight na više igrača; rank tekst prisutan |
| **PARTIAL** | Side-pot **vidljiv** (`Glavni pot` + `Side pot` linije), rank tekst OK, UI struktura ispravna, ali **isti igrač** osvoji više potova (1 winner block) posle pokušaja — **nije MR FAIL** |
| **FAIL** | Ne može se doći do side-pot showdown-a **ili** UI ne prikazuje pot/rank strukturu ispravno |

Rank imena ne moraju odgovarati engine rigged testu. Countdown stabilan; panel nestaje posle result perioda.

### Engine referenca (logika, ne browser PASS)

Test `'side-pot winners carry handRank per pot with different winners'` — 3 igrača, rigged shuffle; browser proverava **UI oblik**, ne tačan rank string.

---

## Manual QA — mobilni winner blokovi

### Odluka

- **Ne insistirati** na 5–6 winner blokova bez rig/deck alata (praktično nededuktivno sa random shuffle-om).
- **Minimum 2 winner bloka** na uskom viewportu = prihvatljiv **mobile proxy** za layout stress.
- U evidence **mora** pisati **koliko winner blokova** je stvarno provereno (npr. „2 winner bloka @ 540px").

### Šta je „winner block"

Jedan **`.winner-chip`** u `.winner-banner` result panelu = **jedan grouped winner prikaz za jednog igrača** (`groupWinners()` u `PokerPlay.tsx` grupiše po `playerId`). Isti igrač sa main + side potom = **1 blok** sa više per-pot linija unutra.

### Koraci

1. Koristiti scenario sa **≥2 winner bloka** (idealno side-pot različiti winneri iz prethodnog QA, ili tie ako postignut).
2. DevTools → viewport **≤540px** (ili fizički telefon).
3. Proveriti istovremeno: winner banner, countdown bar, sto, hero hand.

### PASS

- Svi winner blokovi vidljivi (`flex-wrap`, vertikalni scroll stranice OK)
- Tekst pot/rank čitljiv; nema kritičnog preklapanja sa countdown-om
- Nema horizontalnog scroll-a koji seče adrese/iznose (postojeći pot breakdown scroll nije regresija ovog taska)

### Ako layout pukne na 2+ blokova

- **STOP**
- Prijavi problem u manual QA
- **Ne popravljati CSS** bez eksplicitne korisničke odluke (poseban fix commit)

---

## Verifikacija (posle implementacije commit-6)

| Provera | Komanda / artefakt | Napomena |
|---------|-------------------|----------|
| Poker testovi | `npm run poker:test` | Očekivano PASS; broj testova isti (+0 novih `it`, samo proširen assert) |
| Frontend regression build | `npm run build --prefix solana/web` | Pokrenuti **pre final acceptance-a** čak i ako frontend nije diran |
| Manual QA | `manual-qa.md` u ovom folderu | Scenariji tie, side-pot, mobile; Date verified |
| Evidence logovi | `poker-test-pass-N-of-N.log`, `frontend-build-pass.log` | UTF-8 bez BOM: `chcp 65001` + `WriteAllText` UTF-8 no BOM (PS 5.1) |

**Ne kreirati** finalni root `task-evidence/poker-showdown-result-ux/` u ovom koraku.

---

## Evidence struktura (commit-6)

```txt
task-evidence/poker-showdown-result-ux/attempts/commit-6/
  showdown-coverage-qa.plan.md    ← ovaj fajl
  poker-test-pass-N-of-N.log        ← posle test run-a
  frontend-build-pass.log         ← posle build run-a
  manual-qa.md                      ← posle korisničkog manual QA
```

Postojeći `attempts/commit-1` … `commit-5` ostaju kao istorija.

### `manual-qa.md` — obavezna polja po scenariju

Za **tie**, **side-pot** i **mobile** svaki scenario mora imati:

- **Status:** `PASS` / `PARTIAL` / `NOT REACHED random deck` / `FAIL`
- **Broj pokušaja**
- **Broj winner blokova** (`.winner-chip` count)
- **Viewport širina** (px) — za mobile scenario
- **Kratka napomena** (npr. „1 block, 2 pot lines, same player")

---

## Out of scope

- Best-five / `bestCards`
- Frontend kod (osim budući CSS fix **samo uz odobrenje**)
- `room.ts`, countdown lifecycle, `serverNow` / clock anchor
- Vault / lock / release flow
- `RebuyGraceBar`
- `.env`, `.env.example`
- `package.json`, lock fajlovi, dependencies
- Final root evidence
- Commit / push
- Ponavljanje commit-5 manual QA matrice
- Real Vault add-chips timing QA (budući task)
- Rig/deck dev alat za browser QA

---

## Predlog commit poruke (posle implementacije)

```
test(poker): proširi 4-6 locked-runout coverage sa handRank assert-ima

Dodaje minimalne showdown rank assert-e u postojeći 4-6-way locked
runout test. Commit-6 evidence pokriva preostali manual QA za tie,
side-pot različite winner-e i mobilni multi-block layout proxy.
```

---

## Rizici i preostalo posle commit-6

| Rizik | Mitigacija |
|-------|------------|
| Tie u browseru retko sa random deck-om | Dostižan na 7. pokušaju — manual-qa **PASS**; engine test kao dodatna pokrivenost |
| Side-pot 5 pokušaja bez 2 winner bloka | **PARTIAL** ako side-pot UI OK, isti igrač više potova; **FAIL** samo ako nema side-pot showdown ili UI struktura pogrešna |
| Mobile layout fail na 2 bloka | STOP + korisnička odluka za CSS fix |
| 5–6 winner blokova nije testirano | Prihvaćeno; dokumentovati stvarni broj blokova |

**Posle commit-6 PASS:** finalni root evidence + MR opis / review checklist.

---

## Status plana

**Automatski deo implementiran — manual QA PASS.**

| Stavka | Status |
|--------|--------|
| Plan (PARTIAL tier + manual-qa polja) | Ažuriran |
| Auto-test proširenje | Implementirano |
| `npm run poker:test` | vidi `poker-test-pass-100-of-100.log` |
| `npm run build --prefix solana/web` | vidi `frontend-build-pass.log` |
| Manual QA (tie / side-pot / mobile) | **PASS** — vidi `manual-qa.md` |
| Commit / push | **not done** |
