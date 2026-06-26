# Task evidence: Frontend side-pot UI

## Status

**Implemented** — 2026-06-16. Frontend-only side-pot breakdown u Poker tabu (`solana/web`).

Branch: `feature/poker-side-pots-ui`.

Poslednja verifikacija: 2026-06-16 (final acceptance — visual polish side-pot breakdown + evidence osvežen).

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

### Visual polish — side-pot breakdown (2026-06-16, final)

Minimalni CSS + JSX polish **bez promene logike** (`computeDisplayPots`, stable gate, eligible format netaknut).

#### `PotBreakdown.tsx`

| Promena | Detalj |
|---------|--------|
| `pots.map((pot, index) => …)` | Dodat `index` u map |
| `pot-breakdown-row--main` | Prvi red (`index === 0`) — **Glavni pot** |
| `pot-breakdown-row--mine` | Ostaje kad je moj igrač eligible za taj pot |
| Eligible tekst | Ostaje `seatLabels.join(' · ')` — **nema** pill/badge tagova |
| Logika | **Nije menjana** |

#### `index.css`

| Promena | Detalj |
|---------|--------|
| Chip marker | CSS-only zlatni disk preko `.pot-breakdown-label::before` (radial gradient + prsten); **nema SVG** |
| Glavni pot | `.pot-breakdown-row--main` — jači border/pozadina, label `#a8b8cc` / `font-weight: 700`, disk malo veći |
| Side potovi | Mirniji default red (tanji border, tamnija pozadina, label `#8fa3bb`) |
| My eligible | `.pot-breakdown-row--mine` — suptilan plavi `border-left`, glow/box-shadow **samo na redu** |
| Main + mine | `.pot-breakdown-row--main.pot-breakdown-row--mine` — kombinovani stil |
| Eligible linija | Ostaje neutralna/siva (`#6f849c` / `#8fa3bb`) — **ne plavi se** unutar `--mine` reda |
| Amount | Ostaje `var(--gold)` |
| Mobile | `@media (max-width: 540px)` — disk 1px manji (6px / 7px na main) |

**Nije dirano:** layout stola, seat-wrap, karte, hero bar pozicioniranje (samo breakdown redovi).

---

## Implementation summary

| Fajl | Izmena |
|------|--------|
| [`solana/web/src/poker/pots.ts`](../../solana/web/src/poker/pots.ts) | **Novo** — `buildPots`, `isPotBreakdownStable`, `computeDisplayPots`, labele |
| [`solana/web/src/poker/PotBreakdown.tsx`](../../solana/web/src/poker/PotBreakdown.tsx) | Breakdown JSX; visual polish: `--main` klasa, eligible tekst |
| [`solana/web/src/poker/PokerPlay.tsx`](../../solana/web/src/poker/PokerPlay.tsx) | `computeDisplayPots`; `PotBreakdown` sibling ispod `.table-visual`; conditional CSS hook klase |
| [`solana/web/src/index.css`](../../solana/web/src/index.css) | `.pot-breakdown*` stilovi; layout/clearance; hero label/spacing; **visual polish** (chip disk, hijerarhija, `--mine`) |
| [`poker/src/pot-port-sync.test.ts`](../../poker/src/pot-port-sync.test.ts) | **Novo (test-only)** — contract test backend vs frontend `buildPots`; ne menja runtime |

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

Manual QA izvršen tokom razvoja i layout iteracija (2026-06-13 — 2026-06-16). Finalni vizuelni retest posle side-pot **visual polish** (chip disk, `--main` / `--mine` hijerarhija).

| Scenario | Rezultat | Napomena |
|----------|----------|----------|
| **HU / single-pot** | **PASS** | Nema breakdown-a; nema praznog prostora |
| **3-player side-pot** | **PASS** | Breakdown ispod stola; disk + hijerarhija; eligible tekst `Mesto N · …` |
| **4-player / Side pot 2** | **PASS** | `Glavni pot` / `Side pot 1` / `Side pot 2`; zbir = total |
| **My eligible red** | **PASS** | Plavi accent na **redu**; eligible linija ostaje siva |
| **Open betting gate** | **PASS** | Dok postoji otvorena akcija — samo total |
| **Mobile ~540px** | **PASS** | Čitljiv breakdown; disk 1px manji; scroll OK za 3+ reda |
| **Sto / hero** | **PASS** | Seat/karte/„Tvoje karte“ bez regresije layout-a |
| **Showdown** | **PASS** | Server `state.pots`; winner banner vidljiv |
| **Folded eligibility** | **PASS** | Folded nije u eligible listi |
| **Sit during active hand** | **PASS** | Novi igrač čeka sledeću ruku |
| **Stand** | **NOT VERIFIED** | Postojeći unrelated issue |
| **Vault tab smoke** | **PASS** | Tab radi; povratak na Poker OK |

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

### 2. 3-player short-stack all-in postflop stall (backend)

**Klasifikacija:** postojeći backend engine bug na **`main`** — **nije** side-pot UI regresija, **nije** blocker za ovaj MR.

**Git / poreklo (Cursor provera, 2026-06-16):**

- Bug postoji na `main`; **nije** uveden u `feature/poker-uncalled-bet-refund` ni `feature/poker-side-pots-ui`
- `feature/poker-side-pots-ui` ne menja backend runtime (`table.ts` identičan `main`-u)
- Root cause: `poker/src/table.ts` — `firstPostflopActionSeat()` / `seatsInHandCount()` / `seatedWithChips()` (all-in igrač sa `stack === 0` ispada iz broja → engine pogrešno tretira 3-way kao HU → `actionSeat` na all-in button igraču)

**Repro:**

- A = 100, B = 50, C = 100
- B All-in 50 → C Call 50 → A Call 50

**Observed:**

- Flop se podeli (`board.length === 3`)
- `actionSeat` postane **B** (all-in, `stack === 0`)
- A i C imaju stack, ali ne dobiju hero dugmad
- Hand ostaje incomplete; nema showdown/winner

**Predlog follow-up task-a:**

```text
fix(poker): postflop action seat when all-in player excluded from seatsInHandCount
```

### 3. Stand flow (frontend/backend)

UI trenutno ne dozvoljava / ne završava ustajanje u testiranom scenariju — **NOT VERIFIED**; tretira se kao postojeći unrelated issue.

---

## Scope

### Dirati (ovaj MR)

```text
solana/web/src/poker/pots.ts
solana/web/src/poker/PotBreakdown.tsx
solana/web/src/poker/PokerPlay.tsx
solana/web/src/index.css
poker/src/pot-port-sync.test.ts          # test-only dodatak (buildPots drift check)
task-evidence/poker-side-pots-ui/*
```

### Ne dirati

| Oblast | Status |
|--------|--------|
| Backend poker runtime / engine logic (`poker/src/pot.ts`, `table.ts`, …) | **Netaknut** |
| Backend test-only file | **Dodat** [`poker/src/pot-port-sync.test.ts`](../../poker/src/pot-port-sync.test.ts) — contract test, bez runtime promene |
| `poker/package.json` | **Netaknut** — standardni `npm run poker:test` ne uključuje sync test |
| Poker server (`poker/server/`) | **Netaknut** |
| WS contract / poruke | **Netaknut** |
| Vault flow (`solana/web/src/vault/`) | **Netaknut** |
| `.env`, `.env.example` | **Netaknut** |
| Root / web `package.json`, `package-lock.json` | **Netaknut** |

---

## Test results

### Frontend build

```bash
npm run build --prefix solana/web
```

| Datum | Rezultat | Evidence |
|-------|----------|----------|
| 2026-06-16 (initial) | **PASS** — `✓ built in 15.98s` | [`frontend-build-pass.log`](frontend-build-pass.log) |
| 2026-06-16 (visual polish final) | **PASS** — `✓ built in 10.93s` | [`frontend-build-pass-sidepot-visual-polish-final.log`](frontend-build-pass-sidepot-visual-polish-final.log) |

### Poker unit tests

```bash
npm run poker:test
```

| Run | Datum | Rezultat | Evidence |
|-----|-------|----------|----------|
| 1 (final) | 2026-06-16 | **77/77 pass**, 0 fail | [`poker-test-pass-77-of-77.log`](poker-test-pass-77-of-77.log) |

Retry: **nije potreban** — prvi run prošao bez greške.

Napomena: standardni `npm run poker:test` pokriva backend engine/room; **engine runtime nije menjan** u ovom task-u. Evidence log [`poker-test-pass-77-of-77.log`](poker-test-pass-77-of-77.log) ostaje za standardni test run (77/77, **bez** sync testa).

**Additional sync check** (posebna komanda, vidi ispod): `build-pots-sync-test-pass-3-of-3.log` — 3/3 pass.

### Additional sync check: backend/frontend buildPots

Dodat je namenski contract test:

`poker/src/pot-port-sync.test.ts`

Test poredi backend `buildPots` iz `poker/src/pot.ts` i frontend port iz `solana/web/src/poker/pots.ts` na istim fixture-ima.

Cilj:

- ako se backend `buildPots` promeni u budućnosti
- a frontend port se ne ažurira
- ovaj namenski test treba da pukne

Napomena:

- test **nije** dodat u standardni `npm run poker:test`
- `poker/package.json` **nije** menjan
- test se pokreće posebnom komandom (iz `poker/` foldera):

```bash
cd poker && node --import tsx --test src/pot-port-sync.test.ts
```

- runtime logika **nije** menjana

| Check | Datum | Rezultat | Evidence |
|-------|-------|----------|----------|
| buildPots sync | 2026-06-16 | **3/3 pass**, 0 fail | [`build-pots-sync-test-pass-3-of-3.log`](build-pots-sync-test-pass-3-of-3.log) |

---

## Final checklist

- [x] Frontend side-pot UI scope — nema backend runtime / WS / vault / env / package izmena
- [x] Backend test-only dodatak — `poker/src/pot-port-sync.test.ts` (drift check; `poker/package.json` netaknut)
- [x] Stable-state gate — breakdown samo kad nema otvorene akcije (ili showdown complete)
- [x] Open betting — samo total
- [x] Showdown — server `state.pots`
- [x] Labele `Glavni pot`, `Side pot N`, `Mesto N`
- [x] Breakdown ispod stola, dark/blue styling + **visual polish** (chip disk, `--main` / `--mine`)
- [x] Visual polish manual QA — PASS (HU, 3p, 4p, my eligible, open betting, mobile ~540px, sto/hero)
- [x] Single-pot bez breakdown-a i bez praznog prostora
- [x] Clearance donjeg seat/reveal (`margin-top` samo na `--pot-breakdown`)
- [x] „Tvoje karte“ spacing/label poboljšanje (namerno, Poker tab)
- [x] `npm run build --prefix solana/web` — PASS (initial + visual polish final evidence logs)
- [x] `npm run poker:test` — 77/77 PASS (standardni run; evidence log bez sync testa)
- [x] buildPots sync check — 3/3 PASS ([`build-pots-sync-test-pass-3-of-3.log`](build-pots-sync-test-pass-3-of-3.log); komanda: `cd poker && node --import tsx --test src/pot-port-sync.test.ts`)
- [x] Manual QA — side-pot scenariji PASS (vidi tabelu)
- [x] Known unrelated backend bug dokumentovan (4-player stall, 3-player postflop stall)
- [x] Vault tab smoke — PASS (ručna provera: otvaranje, bez crash/error-a, povratak na Poker)
- [ ] Stand flow — **NOT VERIFIED** (postojeći issue, van scope-a)

---

## MR readiness

Task je **spreman za MR** sa napomenom:

1. **Stand** — poznat unrelated issue; ne blokira side-pot UI MR.
2. **4-player locked-runout stall** — dokumentovan backend follow-up; ne blokira ovaj frontend MR.
3. **3-player postflop stall** — potvrđen postojeći bug na `main`; otkriven tokom side-pot QA; **nije regression**; ne blokira MR.

Predlog MR title:

```text
feat(web): side-pot breakdown UI in Poker tab
```
