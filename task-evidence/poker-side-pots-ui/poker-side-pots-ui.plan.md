# Task evidence: Frontend side-pot UI

## Status

**Implemented** — 2026-06-16. Frontend-only side-pot breakdown u Poker tabu (`solana/web`).

Branch: `feature/poker-side-pots-ui`.

Poslednja verifikacija: 2026-06-16 (final acceptance workflow — plan osvežen posle layout/styling QA iteracija).

---

## Pre-change verification / data flow verification

| Provera | Rezultat |
|---------|----------|
| Frontend side-pot UI pre ovog task-a | **Ne postoji** — prikazivao se samo `potTotal = sum(betThisHand)` |
| Server `state.pots` na wire-u | **Postoji** u `TableState` (`ws.ts`); popunjava se na showdown-u |
| `buildPots` u backend-u | [`poker/src/pot.ts`](../../poker/src/pot.ts) — **nije diran** u ovom task-u |
| Frontend refund simulacija | **Nije u scope-u** — uncalled refund je backend concern (`returnUncalledBets`) |
| Baseline `npm run poker:test` | **77/77 pass** (2026-06-16, evidence log) |
| Baseline `npm run build --prefix solana/web` | **PASS** (2026-06-16, evidence log) |

### Data flow (final)

```text
WebSocket table snapshot
  → TableState { players[], pots[], actionSeat, handComplete, bettingRound, ... }
  → computeDisplayPots(state, myPlayerId, handInProgress)
       total = sum(players[].betThisHand)           // uvek
       stable = isPotBreakdownStable(...)
       rawPots =
         handComplete && state.pots.length > 0  → server state.pots   // showdown
         stable                                 → buildPotsFromPlayers(players)
         else                                   → []
       showBreakdown = stable && rawPots.length >= 2
  → PokerPlay: potDisplay.total u centru stola
  → PotBreakdown (samo ako showBreakdown): Glavni pot / Side pot N / Mesto N
```

| Gate | Pravilo |
|------|---------|
| **Stable state** | `handComplete` **ili** (`handInProgress && actionSeat === null && bettingRound !== 'showdown'`) |
| **Open betting** | `actionSeat !== null` → **samo total**, bez breakdown-a |
| **Single pot** | `rawPots.length < 2` → **samo total**, bez breakdown DOM-a |
| **Showdown** | Prefer server `state.pots` kad `handComplete && pots.length > 0` |
| **Live breakdown** | `buildPotsFromPlayers` samo u stable state-u — **nema** frontend refund simulacije |

---

## Problem

Tokom ruke sa različitim stackovima (side-pot scenariji), igrači vide samo jedan ukupan broj u centru stola. Nema prikaza:

- koliko čipova ide u glavni vs side pot
- ko je eligible po potu
- da li je igrač u potu u kome učestvuje

Potrebno je **frontend-only** rešenje koje ne menja poker engine, WS protokol ni vault flow.

---

## Solution

### Display logika (`solana/web/src/poker/pots.ts`)

- Port `buildPots` iz `poker/src/pot.ts` (display-safe, ručno održavanje u sync-u)
- `isPotBreakdownStable` — stable-state gate (vidi tabelu iznad)
- `computeDisplayPots` — total + conditional breakdown
- Labele: **`Glavni pot`**, **`Side pot N`**, **`Mesto N`** (seat + 1)
- Folded igrači **nisu** u eligible listi; matched folded chips ostaju u `amount`-u (engine semantika)

### UI (`PotBreakdown.tsx` + `PokerPlay.tsx`)

- Breakdown **ispod** `.table-visual`, van ovala — normal document flow (`position: static`)
- U `.table-center` ostaju samo board + zlatna pot ikonica + **total**
- Conditional hook klase: `poker-table-wrap--pot-breakdown`, `poker-table-section--pot-breakdown`
- Single-pot: `showBreakdown === false` → nema `PotBreakdown` DOM-a, nema praznog prostora

### Styling (`index.css`) — finalne odluke posle manual QA

| Odluka | Finalno stanje |
|--------|----------------|
| Breakdown pozicija | Ispod stola, ne u ovalu; desktop i mobile isti princip |
| Stil breakdown-a | **Dark/blue** redovi — bez gold/felt panel okvira |
| Clearance donjeg seat/reveal | `margin-top: 2rem` (desktop), `1.25rem` (mobile) samo kad `--pot-breakdown` |
| „Tvoje karte“ | Namerno poboljšanje: `.hero-hand-label` kontrast + `.hero-bar` / showdown spacing |
| Sto / seat / karte | **Netaknuti** u diff-u (felt, rail, seat-wrap, playing-card) |

---

## Implementation summary

| Fajl | Izmena |
|------|--------|
| [`solana/web/src/poker/pots.ts`](../../solana/web/src/poker/pots.ts) | **Novo** — `buildPots`, `isPotBreakdownStable`, `computeDisplayPots`, labele |
| [`solana/web/src/poker/PotBreakdown.tsx`](../../solana/web/src/poker/PotBreakdown.tsx) | **Novo** — kompaktan breakdown JSX |
| [`solana/web/src/poker/PokerPlay.tsx`](../../solana/web/src/poker/PokerPlay.tsx) | `computeDisplayPots`; `PotBreakdown` sibling ispod `.table-visual`; conditional CSS hook klase |
| [`solana/web/src/index.css`](../../solana/web/src/index.css) | `.pot-breakdown*` stilovi; layout/clearance; hero label/spacing (Poker tab only) |

### DOM struktura (final)

```text
.poker-table-section[.panel--showdown][.poker-table-section--pot-breakdown]
  .poker-table-wrap[.poker-table-wrap--pot-breakdown]
    .table-visual
      .table-center → board + pot icon + total
      .seat-wrap × N (absolute, reveal karte)
    PotBreakdown (samo ako showBreakdown)
  .hero-bar → Tvoje karte + akcije
```

### CSS scope napomena (audit pre acceptance)

| Klasa | Scope uticaja |
|-------|----------------|
| `.pot-breakdown*`, `--pot-breakdown` | Samo side-pot breakdown |
| `.hero-bar`, `.hero-hand-label`, `.poker-table-wrap` margin | **Ceo Poker tab** (namerno — „Tvoje karte“); **ne utiče na Vault** |

---

## Poker-rule / engine-flow check

| Pravilo | Frontend ponašanje |
|---------|-------------------|
| Side-pot nivoi | `buildPots` port — isti algoritam kao backend |
| Folded nije eligible | `eligibleToSeatLabels` preskače `status === 'folded'` |
| Matched folded chips u potu | Ostaju u `amount`; folded nije u listi mesta |
| Uncalled refund | **Ne simulira se** na frontendu — total = `sum(betThisHand)` iz server stanja |
| Open action | Gate sakriva breakdown dok `actionSeat !== null` |
| Showdown | Server `state.pots` kada `handComplete && pots.length > 0` |
| Single pot (HU matched) | `showBreakdown = false` — samo total |

**Nema izmena** u poker engine flow-u, `endBettingRound`, locked runout, WS porukama.

---

## Manual QA

Manual QA izvršen tokom razvoja i layout iteracija (2026-06-13 — 2026-06-16). Finalni vizuelni retest posle clearance tweak-a.

| Scenario | Rezultat | Napomena |
|----------|----------|----------|
| **HU / single-pot showdown** | **PASS** | Nema breakdown-a; nema praznog prostora; „Tvoje karte“ jasno vidljivo |
| **3-player side-pot — desktop** | **PASS** | Breakdown ispod stola; `Glavni pot` / `Side pot 1`; `Mesto N` čitljivo; ne preklapa board/seat/reveal |
| **3-player side-pot — mobile** | **PASS** | Isti princip; čitljiv dark/blue breakdown |
| **4-player / Side pot 2 — desktop** | **PASS** | `Glavni pot` / `Side pot 1` / `Side pot 2`; zbir = total; donji reveal ne preklapa breakdown |
| **4-player / Side pot 2 — mobile** | **PASS** | Prihvatljiv clearance posle `margin-top` tweak-a |
| **Final visual QA** | **PASS** | HU + 3p + 4p desktop/mobile; bottom seat/reveal ne preklapa breakdown; „Tvoje karte“ vidljivo |
| **Open betting round** | **PASS** (gate) | Dok postoji otvorena akcija — samo total; breakdown tek u stable state-u |
| **Showdown** | **PASS** | Server `state.pots`; winner banner vidljiv; breakdown ne preklapa showdown/reveal |
| **Folded eligibility** | **PASS** | Folded nije u eligible listi; matched folded chips u amount-u |
| **Sit during active hand** | **PASS** | Novi igrač čeka sledeću ruku — očekivano ponašanje |
| **Stand** | **NOT VERIFIED** | UI ne dozvoljava / ne završava ustajanje — postojeći unrelated issue, ne side-pot regresija |
| **Vault tab smoke** | **PASS** | Tab se otvara normalno; nema white screen/crash; nema novog error-a; povratak na Poker tab radi |

---

## Known unrelated issues

### 1. 4-player folded/all-in stall (backend)

**Klasifikacija:** postojeći backend bug — **nije** side-pot UI regresija, **nije** QA greška.

**Repro:**

- A = 500, B/C/D = 200
- B fold posle matched chips
- C/D all-in
- A call / zatvori akciju
- Board dođe do river-a (5 karata)
- Nijedan igrač nema hero dugmad
- Nema showdown/winner završetka (`handComplete: false`)

**Root cause (analiza tokom manual QA):**

- Locked runout poslednja karta: `endBettingRound()` deal-uje river sa `board.length === 4 → 5`, ali **ne pozove** `showdown()`

**Predlog follow-up task-a:**

```text
fix(poker): showdown after locked runout deals river in endBettingRound
```

### 2. Stand flow (frontend/backend)

UI trenutno ne dozvoljava / ne završava ustajanje u testiranom scenariju — **NOT VERIFIED**; tretira se kao postojeći unrelated issue.

---

## Scope

### Dirati (ovaj MR)

```text
solana/web/src/poker/pots.ts
solana/web/src/poker/PotBreakdown.tsx
solana/web/src/poker/PokerPlay.tsx
solana/web/src/index.css
task-evidence/poker-side-pots-ui/*
```

### Ne dirati

| Oblast | Status |
|--------|--------|
| Backend poker engine (`poker/src/`) | **Netaknut** |
| Poker server (`poker/server/`) | **Netaknut** |
| WS contract / poruke | **Netaknut** |
| Vault flow (`solana/web/src/vault/`) | **Netaknut** |
| `.env`, `.env.example` | **Netaknut** |
| `package.json`, `package-lock.json` | **Netaknut** |

---

## Test results

### Frontend build

```bash
npm run build --prefix solana/web
```

| Datum | Rezultat | Evidence |
|-------|----------|----------|
| 2026-06-16 | **PASS** — `✓ built in 15.98s` | [`frontend-build-pass.log`](frontend-build-pass.log) |

### Poker unit tests

```bash
npm run poker:test
```

| Run | Datum | Rezultat | Evidence |
|-----|-------|----------|----------|
| 1 (final) | 2026-06-16 | **77/77 pass**, 0 fail | [`poker-test-pass-77-of-77.log`](poker-test-pass-77-of-77.log) |

Retry: **nije potreban** — prvi run prošao bez greške.

Napomena: poker testovi pokrivaju backend engine/room; ovaj task ih nije menjao — služe kao regresiona potvrda da frontend-only diff nije slučajno dirnuo backend (nije dirnut).

---

## Final checklist

- [x] Frontend-only scope — nema backend/WS/vault/env/package izmena
- [x] Stable-state gate — breakdown samo kad nema otvorene akcije (ili showdown complete)
- [x] Open betting — samo total
- [x] Showdown — server `state.pots`
- [x] Labele `Glavni pot`, `Side pot N`, `Mesto N`
- [x] Breakdown ispod stola, dark/blue final styling
- [x] Single-pot bez breakdown-a i bez praznog prostora
- [x] Clearance donjeg seat/reveal (`margin-top` samo na `--pot-breakdown`)
- [x] „Tvoje karte“ spacing/label poboljšanje (namerno, Poker tab)
- [x] `npm run build --prefix solana/web` — PASS (evidence log)
- [x] `npm run poker:test` — 77/77 PASS (evidence log)
- [x] Manual QA — side-pot scenariji PASS (vidi tabelu)
- [x] Known unrelated backend bug dokumentovan (4-player stall)
- [x] Vault tab smoke — PASS (ručna provera: otvaranje, bez crash/error-a, povratak na Poker)
- [ ] Stand flow — **NOT VERIFIED** (postojeći issue, van scope-a)

---

## MR readiness

Task je **spreman za MR** sa napomenom:

1. **Stand** — poznat unrelated issue; ne blokira side-pot UI MR.
2. **4-player stall** — dokumentovan backend follow-up; ne blokira ovaj frontend MR.

Predlog MR title:

```text
feat(web): side-pot breakdown UI in Poker tab
```
