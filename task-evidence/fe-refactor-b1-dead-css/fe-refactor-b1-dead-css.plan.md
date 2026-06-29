# Inicijativa B.1 — Dead CSS / `index.css`

**Tip:** FE refactor (dead CSS removal)  
**Grana:** `feature/refactor-web-dead-css`  
**Globalni roadmap:** `task-evidence/fe-global-refactor-roadmap/fe-global-refactor-roadmap.plan.md` (Inicijativa 2/7)  
**Status inicijative:** Phase 1 **DONE** (`336d8bd`); Phase 2a **implementirana** — build + manual QA **PASS**; **commit i push nisu urađeni**

**Primarni FE reference:** `FRONTEND_TECHNOLOGY_RESEARCH.md` §4.7, §4.8, §4.9, §6

---

## Svrha inicijative

Ukloniti potvrđeno mrtav CSS iz `solana/web/src/index.css` — pravila čije se klase ne pojavljuju u aktivnom markup-u (literalno niti kroz poznate dinamičke `className` obrasce).

**Očekivanje:** 0 vizuelne promene; manji `index.css`; bez diranja TSX, runtime logike, env-a ili WS/Vault flow-a.

---

## Šta pripada B.1 (granica inicijative)

Kandidat pripada B.1 **samo** ako ispunjava **sva** četiri uslova:

1. Uklapa se u cilj „Dead CSS / `index.css`“
2. Može da se uradi u dozvoljenom scope-u B.1 (uklanjanje iz `index.css`)
3. **Ne zahteva** TSX izmenu
4. **Ne dodaje** novi stil, izgled ili UX ponašanje

Kandidati koji zahtevaju TSX izmenu, novi CSS, layout hook bez mrtvog CSS-a ili evidence/metadata sređivanje **ne ulaze** u B.1 mini-roadmap.

---

## Mini-roadmap

| Faza | Scope | Status | Implementacija |
|------|-------|--------|----------------|
| **Phase 1** | B1-01–07 | **DONE** — committed (`336d8bd`) | **Urađena** |
| **Phase 2a** | B1-08–10 (konzervativni scope) | **završena** — verifikacija **PASS** | **Implementirana** |
| **B1-11** | `.card-row--lg` | **closed / rejected by user decision** | **Ne radi se** — CSS ostaje |

**Napomena:** B1-11 **ne ulazi** u Phase 2a, nije future task i **ne planira se kasnije** u B.1. CSS `.card-row--lg` **ostaje** u `index.css`. Promena samo eksplicitnom budućom korisničkom odlukom. Ništa iz Phase 2a ne sme u Phase 1 commit.

---

## Phase 1 — B1-01–07 (detaljno)

### Korisničke odluke (finalne za plan)

| Stavka | Odluka |
|--------|--------|
| Scope | Samo B1-01–07 |
| Production fajl | Samo `solana/web/src/index.css` |
| Commit model | **Jedan zaseban commit** za Phase 1 |
| Komentar L781 | Ukloniti `/* Vault seats (circles) */` zajedno sa B1-05–07 |
| Screenshot baseline | **Preskačemo** — nije blocker |
| QA | `npm run build --prefix solana/web` + minimalni manual visual smoke |
| Globalni roadmap | Korisnička postojeća lokalna izmena — **ne dirati** u Phase 1 |

### Cilj Phase 1

Ukloniti 8 CSS rule blokova + 1 zastareli komentar za legacy klase koje se ne renderuju u trenutnom `solana/web` UI-u.

### Implementacija (stvarno stanje)

| Stavka | Vrednost |
|--------|----------|
| Production fajl | Samo `solana/web/src/index.css` |
| Uklonjeno | B1-01–07 + komentar `/* Vault seats (circles) */` |
| Stvarni diff | **55 obrisanih linija** (`git diff --stat -- solana/web/src/index.css`) |
| TSX / env / package / WS / Vault / Anchor | **0 izmena** |

### Šta se menja

| Akcija | Putanja |
|--------|---------|
| MOD (brisanje mrtvih pravila + komentara) | `solana/web/src/index.css` |

### Šta ostaje netaknuto

- Svi `solana/web/src/**/*.{tsx,ts,jsx,js}` — **0 izmena**
- `.env`, `.env.example`, `package.json`, `package-lock.json`
- `poker/`, `solana/programs/`, root `src/`, `contracts/`
- WS contract, `tableVault.ts`, vault/poker runtime logika
- `:root` tokeni, `@keyframes`, svi `@media (max-width: 540px)` blokovi
- Žive klase: `panel`, `panel--flush`, `panel--showdown`, `table-visual`, `table-visual--poker`, `table-visual--showdown`, `seat--poker` i modifikatori, showdown/countdown/winner/hero/pot pravila
- B1-08–10 (`btn-row--actions`, `pot-title`, `seat-bet`) — **Phase 2a**
- B1-11 (`.card-row--lg`) — **closed / rejected** — CSS ostaje (vidi sekciju ispod)
- `task-evidence/fe-global-refactor-roadmap/fe-global-refactor-roadmap.plan.md` — korisnička lokalna izmena netaknuta

---

### Dokaz po selektoru (B1-01–07)

**Metod provere (provereno u aktivnom kodu):**

- Grep `solana/web/**/*.{tsx,ts,jsx,js,html}` za literalne stringove klasa
- Grep celog repoa za izvorni kod (osim `index.css` i `task-evidence/*.md`)
- Pregled dinamičkih `className` obrazaca u `PokerPlay.tsx`, `PokerTableVisual.tsx`, `PokerSeat.tsx`, `VaultPlay.tsx`, `App.tsx`
- Nema `clsx` / `classnames` u `solana/web`
- Nema `panel--${…}` / `table-visual--${…}` osim `table-visual--poker` i `table-visual--showdown`

**Poznati živi `panel--*` / `table-visual--*` u markup-u (ne brisati):**

- `PokerPlay.tsx:198` — `panel--flush`, `panel--showdown`
- `PokerTableVisual.tsx:51` — `table-visual--poker`, `table-visual--showdown`
- `PokerSeat.tsx:64–75` — `seat`, `seat--poker`, `selected`, `you`, … (ne `table-visual--vault`)

**Žive alternative za hint tekst (ne brisati):**

- `hero-actions-hint` — `PokerHeroBar.tsx:55`, CSS L1085+
- `panel-hint` — `PokerControlsPanel.tsx:83`, CSS L150+

#### B1-01 — `.panel--actions`

| | |
|---|---|
| **Linije** | 134–137 |
| **Sadržaj** | `border-color`, `background` gradient |
| **Markup ref** | **0** u `solana/web` |
| **Dinamički** | **0** |
| **@media** | Nema |
| **Mrtav** | **DA** |

#### B1-02 — `.panel--waiting`

| | |
|---|---|
| **Linije** | 139–142 |
| **Sadržaj** | `text-align: center`, `padding` |
| **Markup ref** | **0** |
| **Vault** | Koristi običan `.panel` (`VaultPlay.tsx:271,277`) |
| **Mrtav** | **DA** |

#### B1-03 — `.action-hint`, `.action-hint strong`

| | |
|---|---|
| **Linije** | 303–311 |
| **Sadržaj** | font, boja, margin; `strong` → `var(--gold)` |
| **Markup ref** | **0** za `action-hint` |
| **Mrtav** | **DA** |

#### B1-04 — `.table-visual--vault`

| | |
|---|---|
| **Linije** | 323–336 |
| **Sadržaj** | `max-width: 340px`, felt gradient, rail, shadow |
| **Markup ref** | **0** |
| **Aktivni sto** | `table-visual--poker` + opciono `--showdown` |
| **Bazni `.table-visual` (L314–321)** | **Ostaje** |
| **Mrtav** | **DA** |

#### B1-05 — `.table-visual--vault .seat`

| | |
|---|---|
| **Linije** | 781–790 (uključujući komentar L781) |
| **Sadržaj** | kružni vault seat (72px, border-radius 50%) |
| **Roditelj** | B1-04 — nikad u DOM-u |
| **Poker seat** | `.seat--poker` + `.seat--poker.selected` (L682–685) |
| **Mrtav** | **DA** (kaskadno) |

#### B1-06 — `.table-visual--vault .seat.selected`

| | |
|---|---|
| **Linije** | 792–795 |
| **Mrtav** | **DA** |

#### B1-07 — `.table-visual--vault .seat.you`

| | |
|---|---|
| **Linije** | 797–799 |
| **Mrtav** | **DA** |

**Komentar L781** `/* Vault seats (circles) */` — ukloniti zajedno sa B1-05–07; posle brisanja postaje mrtav i netačan.

---

### Tačna CSS mapa uklanjanja (Phase 1)

**Fajl:** `solana/web/src/index.css`

| ID | Linije (pre implementacije) | Ukloniti |
|----|----------------------------|----------|
| B1-01 | 134–137 | `.panel--actions { … }` |
| B1-02 | 139–142 | `.panel--waiting { … }` |
| B1-03 | 303–311 | `.action-hint { … }`, `.action-hint strong { … }` |
| B1-04 | 323–336 | `.table-visual--vault { … }` |
| B1-05–07 | 781–799 | komentar + `.table-visual--vault .seat`, `.table-visual--vault .seat.selected`, `.table-visual--vault .seat.you` |

**Procena (pre implementacije):** ~48 linija, 8 rule blokova + 1 komentar.

**Stvarno (posle implementacije):** **55 obrisanih linija** u `git diff`.

**Posle uklanjanja ostaju netaknuti susedni blokovi:**

- L125–132: `.panel--flush`, `.panel--showdown`
- L314–321: `.table-visual` (bazni)
- L338+: `.table-visual--showdown`, L374+: `.table-visual--poker`
- L638+: `.seat`, `.seat--poker` i svi poker modifikatori

---

### Granice brisanja i rizici

| Provera | Rezultat |
|---------|----------|
| Deljene deklaracije sa živim selektorom | **Ne** |
| Promena source order / specificity za žive klase | **Ne** |
| B1 selektori unutar `@media` | **Ne** (sva tri `@media` bloka su za `.row`, pot-breakdown, `.winner-chip`) |
| Teorijski rizik: skrivena ref van `solana/web/src` | Repo izvorni kod: **0**; ručni bookmark van repoa: **NIJE UTVRĐENO** |
| Regresija Poker tab | **Nizak** — aktivne klase netaknute |
| Regresija Vault tab | **Nizak** — nikad nije koristio ove klase |
| Tab switch / mobile ≤540px | **Nizak** |

**FRONTEND_TECHNOLOGY_RESEARCH.md primena:**

- §4.7 — lokalni cleanup u jednom globalnom CSS fajlu; nije CSS split (B.3)
- §4.8 — lokalni cleanup u okviru izmene; bez spring-clean (B1-08–10 = Phase 2a; B1-11 zatvoren)
- §4.9 — build + browser smoke obavezni
- §6 — 0 promene ponašanja; samo uklanjanje nekorišćenih pravila

---

### Build verifikacija

**Komanda:** `npm run build --prefix solana/web`

| Proverava | Ne proverava |
|-----------|--------------|
| TypeScript compile, Vite bundle, import graph | Vizuelni izgled, responsive, countdown |
| Da `index.css` ulazi u production bundle | WS, wallet, vault on-chain, Phantom |

**Evidence:** `frontend-build-pass-1-of-1.log` u ovom folderu.

**Status build loga:** **PASS** — svež raw log sačuvan posle finalne evidence provere (UTF-8, bez BOM-a).

---

### Manual QA — minimalni visual smoke

**Status:** obavezan za Phase 1 acceptance (pored build-a).

#### Preduslov servisa

```bash
npm run solana:web
```

**`npm run poker:server` — nije obavezan** za ovaj minimum smoke.

**Provereno u aktivnom kodu:** `PokerPlay.tsx` uvek renderuje sto (`PokerTableVisual` sa `table-visual--poker`), hero zonu (`PokerHeroBar`) i kontrole (`PokerControlsPanel`) čim je Poker tab aktivan — i kada je `table === null` (WS offline). `PokerStatusBar` tada prikazuje **Offline** pill (`PokerStatusBar.tsx:22–24`).

Poker server je potreban samo ako želiš **Live** pill ili WS-driven stanje stola tokom smoke-a — to **nije** deo minimum checklist-a za Phase 1.

#### Konkretni UI state za smoke

| Korak | UI state | Šta proveriti |
|-------|----------|---------------|
| 1 | `http://localhost:5173`, podrazumevani **Poker** tab | App shell (`app-shell`, header, tabovi) se učitava |
| 2 | Poker tab, wallet **nije** obavezan za layout | `poker-page`, `poker-status-bar` (Offline OK), `poker-table-section` sa `table-visual--poker`, 6 `seat--poker` pozicija, `hero-bar`, `PokerControlsPanel` vidljivi |
| 3 | Klik **Vault** tab | Vault paneli i forme (`VaultPlay`) vidljivi |
| 4 | Tab switch Vault → Poker | Oba taba se učitavaju bez layout pucanja |
| 5 | Viewport ≤540px (DevTools) | Nema očigledne layout regresije na Poker i Vault |
| 6 | Browser console | Nema novih grešaka povezanih sa učitavanjem |

**Ne zahteva za minimum smoke:** dva Chrome profila, production vault lock/release, sit/stand Vault E2E.

**Prošireni smoke (korisnik):** aktivna ruka, all-in, showdown/countdown/pot, Vault Deposit — zabeleženo u `manual-qa.md`.

#### Skip-vault flagovi

- **Production Vault lock/release nije testiran** niti je potreban za Phase 1 acceptance.
- QA je rađen sa `POKER_SKIP_VAULT_CHECK=1`; frontend prikazuje da je Vault provera isključena.
- Sit/stand Vault E2E **nije deo** Phase 1 acceptance-a.
- Screenshot baseline: **nije rađen** — nije blocker; korisnik je dostavio QA screenshots lokalno (putanje nisu u repou).

**Evidence:** `manual-qa.md` u ovom folderu.

**Status manual QA:** **PASS** (korisnik potvrđen).

---

### Phase 1 acceptance kriterijumi

Razdvojeno **očekivanje** od **stvarnog acceptance dokaza**:

| Sloj | Formulacija |
|------|-------------|
| **Očekivanje (design intent)** | Uklanjanje potvrđeno mrtvog CSS-a **ne bi trebalo** da promeni vizuelni izgled — cilj je 0 vizuelne promene |
| **Stvarni acceptance dokaz** | `npm run build --prefix solana/web` — **PASS** + tokom manual smoke QA **nije uočena vizuelna regresija** u checklist scenarijima |
| **Granica dokaza** | Bez screenshot baseline-a **ne tvrdimo** da je apsolutno dokazano 0 vizuelne razlike u svim mogućim stanjima — samo da smoke nije našao regresiju |

| Kriterijum | Merilo | Status |
|------------|--------|--------|
| Scope | Samo `index.css`, samo B1-01–07 | **PASS** |
| Build | `npm run build --prefix solana/web` | **PASS** (`frontend-build-pass-1-of-1.log`) |
| Manual QA | Smoke bez vizuelne regresije | **PASS** (`manual-qa.md`) |
| Commit | **Jedan** zaseban commit; push ručno od korisnika | **Urađen** (`336d8bd`) |

**Verdict Phase 1:** **DONE** — build PASS, manual QA PASS, committed.

---

## Phase 2a — B1-08–10 (detaljno)

**Status:** implementirana — build + manual QA **PASS**; commit **nije urađen**.

### Korisničke odluke (finalne za plan)

| Stavka | Odluka |
|--------|--------|
| Scope | Samo **B1-08, B1-09, B1-10** |
| B1-11 | **closed / rejected by user decision** — CSS ostaje u `index.css` (vidi sekciju ispod) |
| Production fajl | Samo `solana/web/src/index.css` |
| Commit model | **Jedan zaseban commit** za Phase 2a |
| Screenshot baseline | **Opciono** — nije blocker |
| QA | `npm run build --prefix solana/web` + minimalni manual visual smoke |

### Cilj Phase 2a

Ukloniti 3 samostalna mrtva CSS rule bloka (~15 linija) — legacy klase koje se ne renderuju u trenutnom `solana/web` UI-u.

### Production scope

| Menja se | Ne menja se |
|----------|-------------|
| `solana/web/src/index.css` (B1-08–10) | TS/TSX/JS fajlovi |
| | `.env`, `.env.example`, `package.json`, `package-lock.json` |
| | WS, Vault, Poker server, Anchor |
| | B1-11 `.card-row--lg` — **zatvoreno**, CSS ostaje namerno |
| | `:root`, `@keyframes`, svi `@media (max-width: 540px)` |
| | Žive klase: `.btn-row`, `.pot-label*`, `.pot-icon`, `.pot-amount`, `.seat-action`, `.card-row`, `.card-row--md`, `.playing-card--*` |

### Dokaz po selektoru (B1-08–10)

**Metod (full fresh scan @ `336d8bd`):** grep `solana/web/**/*.{tsx,ts,jsx,js,html}` + ceo repo izvorni kod; pregled dinamičkih `className`; nema `clsx`/`classnames`.

#### B1-08 — `.btn-row--actions`

| | |
|---|---|
| **Linije** | 191–193 |
| **Sadržaj** | `gap: 0.45rem` |
| **Markup ref** | **0** |
| **Dinamički** | **0** — nema `btn-row--${…}` |
| **Živi sibling** | `.btn-row` — `VaultPlay.tsx` L301,319; `PokerControlsPanel.tsx` L143 |
| **@media / grouped** | **Ne** |
| **Mrtav** | **DA** |
| **Git** | `a7a2860` poker game added |

#### B1-09 — `.pot-title`

| | |
|---|---|
| **Linije** | 388–394 |
| **Sadržaj** | uppercase label stil |
| **Markup ref** | **0** |
| **Živa zamena** | `PokerTableVisual.tsx` L62–93: `pot-label`, `pot-icon`, `pot-amount` |
| **PotBreakdown** | `pot-breakdown-*` — ne `pot-title` |
| **@media / grouped** | **Ne** |
| **Mrtav** | **DA** |
| **Git** | `a7a2860` |

#### B1-10 — `.seat-bet`

| | |
|---|---|
| **Linije** | 735–739 |
| **Sadržaj** | zeleni bet tekst (`#7dffb3`) |
| **Markup ref** | **0** — `git log -S "seat-bet"` na `*.tsx` bez pogodaka |
| **Živa zamena** | `PokerSeat.tsx` L88: `.seat-action` |
| **Povezani živi CSS** | `.seat-action` L705–733 |
| **@media / grouped** | **Ne** |
| **Mrtav** | **DA** |
| **Git** | CSS `a7a2860`; `.seat-action` u `c63afe9` |

### Tačna CSS mapa uklanjanja (Phase 2a)

**Fajl:** `solana/web/src/index.css` (linije pre implementacije)

| ID | Linije | Ukloniti |
|----|--------|----------|
| B1-08 | 191–193 | `.btn-row--actions { gap: 0.45rem; }` |
| B1-09 | 388–394 | `.pot-title { … }` |
| B1-10 | 735–739 | `.seat-bet { … }` |

**Procena:** ~15 linija, 3 samostalna bloka.

**Posle uklanjanja ostaju netaknuti:** `.btn-row`, `.pot-icon`, `.pot-amount`, `.seat-action`, `.card-row`, **`.card-row--lg` (B1-11 — namerno zadržan)**, `.card-row--md` animacije.

### Granice brisanja i rizici (Phase 2a)

| Provera | Rezultat |
|---------|----------|
| Deljene deklaracije sa živim selektorom | **Ne** |
| Promena source order / specificity | **Ne** |
| B1-08–10 u `@media` | **Ne** |
| Vizuelna regresija danas | **Veoma nizak** — klase nisu u DOM-u |
| Full scan novih kandidata | **Nema** — B1-11 zatvoren korisničkom odlukom |

### Build verifikacija (posle implementacije)

**Komanda:** `npm run build --prefix solana/web`

| Proverava | Ne proverava |
|-----------|--------------|
| TypeScript compile, Vite bundle | Vizuelni izgled, responsive |
| `index.css` u production bundle | WS, wallet, vault on-chain |

**Evidence (posle implementacije):** novi raw log u ovom folderu (npr. `frontend-build-pass-phase2a-1-of-1.log`).

**Status build loga:** **PASS** — `frontend-build-pass-phase2a-1-of-1.log`

### Manual QA plan (posle implementacije)

**Preduslov:** `npm run solana:web`

| # | Scenario | Provera |
|---|----------|---------|
| 1 | Poker tab load | Sto, hero, kontrole vidljivi |
| 2 | Board `CardRow` (`size="md"`) + hero `PlayingCard size="lg"` | Karte netaknute |
| 3 | Vault tab | Paneli/forme |
| 4 | Tab switch Poker ↔ Vault | Bez layout regresije |
| 5 | Viewport ≤540px | Bez očigledne regresije |
| 6 | Console | Bez novih grešaka |

**Opciono (sa `poker:server`):** aktivna ruka — `.seat-action` na sedištu; side pot breakdown.

| QA parametar | Napomena |
|--------------|----------|
| `poker:server` | Opciono za layout; korisno za seat-action tokom ruke |
| Wallet / 2 Chrome profila | **Nisu potrebni** |
| Skip-vault | **Može ostati uključen** — sit/stand i production Vault lock/release **nisu** deo Phase 2a acceptance-a |
| Screenshot baseline | **Opciono** — nije blocker |
| Production Vault lock/release | **Ne testirati** |

**Acceptance:** očekivanje 0 vizuelne promene; dokaz = build PASS + smoke bez uočene regresije.

**Evidence:** `manual-qa-phase2a.md`

**Status manual QA:** **PASS** (korisnik potvrđen).

### Phase 2a acceptance (plan)

| Kriterijum | Merilo | Status |
|------------|--------|--------|
| Scope | Samo `index.css`, samo B1-08–10 | **PASS** |
| Build | `npm run build --prefix solana/web` | **PASS** |
| Manual QA | Smoke bez vizuelne regresije | **PASS** |
| Commit | Jedan zaseban commit | **Nije urađen** |

**Verdict Phase 2a:** **Verifikacija PASS** — čeka commit odluku.

---

## B1-11 — `.card-row--lg` (zatvoreno — van B.1 scope-a)

**Status:** **closed / rejected by user decision** — **ne radi se** u ovoj inicijativi i **ne planira se kasnije**.

| | |
|---|---|
| **Linije** | 864–866 (`gap: 0.65rem`) |
| **Runtime danas** | **Mrtav** — nema `CardRow size="lg"` poziva |
| **Dinamički** | **Moguć** — `` card-row--${size} `` u `PlayingCard.tsx` L77 |
| **TS API** | `CardRow` i dalje podržava `size?: 'sm' \| 'md' \| 'lg'` |
| **Odluka** | **CSS ostaje** — bez uklanjanja i bez TS/API izmene u ovom refactoru |

**Razlog zatvaranja (korisnik):**

- runtime je mrtav danas, ali `CardRow size="lg"` API i dalje postoji
- ne želim CSS/API drift
- ne želim TS/API izmenu u ovom refactoru
- zato CSS ostaje

**Granice:**

- **Nije** deo Phase 2a
- **Nije** Phase 2b
- **Nije** future task u B.1
- **Ne implementirati** uklanjanje nikad, osim ako korisnik **eksplicitno** promeni ovu odluku u budućnosti

**Full scan:** nema drugih otvorenih mrtvih klasa u preostalom `index.css` posle zatvaranja B1-11.

---

## Phase 2 — zastareli sažetak (zamenjen Phase 2a sekcijom iznad)

*Stare linije (201–203, 423–429, …) u ranijem planu bile su pre Phase 1 commit-a. Aktivne linije: B1-08 L191–193, B1-09 L388–394, B1-10 L735–739, B1-11 L864–866.*

**Napomena:** `playing-card--sm/md/lg` i `card-row--md` su **živi** (dinamički `` `--${size}` ``).

---

## Kandidati — B.1 tabela (samo B.1 scope)

| Redosled | Inicijativa | Faza | Tip | Odredište | Kandidat | Pre-existing | Uveden trenutnom fazom | Provereno u kodu | Poreklo / napomena | Status | Odluka |
|----------|-------------|------|-----|-----------|----------|--------------|------------------------|------------------|-------------------|--------|--------|
| 2 | B.1 | Phase 1 | 🧹 | — | B1-01 `.panel--actions` | — | NO | YES | uklonjeno; diff 55 linija ukupno | DONE | implementirano |
| 2 | B.1 | Phase 1 | 🧹 | — | B1-02 `.panel--waiting` | — | NO | YES | uklonjeno | DONE | implementirano |
| 2 | B.1 | Phase 1 | 🧹 | — | B1-03 `.action-hint` | — | NO | YES | uklonjeno | DONE | implementirano |
| 2 | B.1 | Phase 1 | 🧹 | — | B1-04 `.table-visual--vault` | — | NO | YES | uklonjeno | DONE | implementirano |
| 2 | B.1 | Phase 1 | 🧹 | — | B1-05–07 vault nested `.seat*` + komentar | — | NO | YES | uklonjeno | DONE | implementirano |
| 2 | B.1 | Phase 2a | 🧹 | — | B1-08 `.btn-row--actions` | — | NO | YES | uklonjeno; 18 linija ukupno | DONE | implementirano |
| 2 | B.1 | Phase 2a | 🧹 | — | B1-09 `.pot-title` | — | NO | YES | uklonjeno | DONE | implementirano |
| 2 | B.1 | Phase 2a | 🧹 | — | B1-10 `.seat-bet` | — | NO | YES | uklonjeno | DONE | implementirano |
| 2 | B.1 | — | 🧹 | — | B1-11 `.card-row--lg` | — | NO | YES | runtime 0; TS API `lg` živ; CSS ostaje | closed / rejected by user decision | rejected — ne raditi |

Za 🧹 refactor redove kolone Pre-existing / Uveden nisu primenjive na isti način kao za 🐞/✨ — označeno sa „—“.

---

## Šta nije urađeno

| Stavka | Status |
|--------|--------|
| Phase 2a git commit | **Nije** |
| Phase 2a git push | **Nije** |

**B1-11:** **closed / rejected by user decision** — CSS ostaje; nije otvorena stavka.

## Šta je urađeno

| Stavka | Status |
|--------|--------|
| Phase 1 (`index.css`, B1-01–07) | **DONE** — 55 linija; commit `336d8bd` |
| Phase 1 build + manual QA | **PASS** — `frontend-build-pass-1-of-1.log`, `manual-qa.md` |
| Phase 2a implementacija (B1-08–10) | **Urađena** — 18 obrisanih linija |
| Phase 2a build | **PASS** — `frontend-build-pass-phase2a-1-of-1.log` |
| Phase 2a manual QA | **PASS** — `manual-qa-phase2a.md` |
| Phase 2a plan | **Odobren** |
| B1-11 odluka | **closed / rejected** — CSS ostaje |

---

## Evidence tree (finalno)

```txt
task-evidence/fe-refactor-b1-dead-css/
├── fe-refactor-b1-dead-css.plan.md
├── frontend-build-pass-1-of-1.log
├── manual-qa.md
├── frontend-build-pass-phase2a-1-of-1.log
└── manual-qa-phase2a.md
```

---

## Finalni verdict

| Stavka | Status |
|--------|--------|
| Phase 1 | **DONE** — committed `336d8bd`, build + QA PASS |
| Phase 2a | **Verifikacija PASS** — implementirana; build + QA PASS |
| Plan Phase 2a | **Odobren** |
| B1-11 | **closed / rejected by user decision** — CSS ostaje |
| Phase 2a commit / push | **Nisu urađeni** |
| Screenshot baseline | **Opciono** — nije blocker |
| Production poker Vault lock/release | **Ne testirati** u Phase 2a |
