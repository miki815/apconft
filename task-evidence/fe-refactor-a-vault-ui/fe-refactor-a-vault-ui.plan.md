# Inicijativa A — Vault tab / `VaultPlay.tsx`

**Tip:** FE refactor (clean-code, 0 ponašanja)  
**Globalni roadmap:** `task-evidence/fe-global-refactor-roadmap/fe-global-refactor-roadmap.plan.md` (Inicijativa 3/7)  
**Status inicijative:** A1 **DONE** (`be1eab3`, pushed); **A1-test cancelled/deferred** (korisnička odluka); **sledeća faza: A2**  
**Primarni FE reference:** `FRONTEND_TECHNOLOGY_RESEARCH.md` §4.5, §4.6, §4.8, §4.9, §6

**A1 commit:** `be1eab3` — `refactor(web): izdvoji pure vault amount helper-e (A1)`  
**Branch:** `feature/refactor-web-vault-ui` (usklađen sa `origin`)

---

## Svrha inicijative

Organizovati Vault tab monolit [`solana/web/src/vault/VaultPlay.tsx`](../../solana/web/src/vault/VaultPlay.tsx) (~353L) u hook, pure helper-e i presentation komponente — **bez promene** deposit/withdraw/ATA toka, Anchor account redosleda, wallet provider flow-a, env/program ID logike i poker integracije.

**Očekivanje:** isti UI i isti on-chain ponašaj; manji i čitljiviji moduli u `vault/`.

---

## Korisničke odluke (finalne za plan)

| Stavka | Odluka |
|--------|--------|
| **A4** | **Planirana kasnija faza** u A roadmap-u; **ne radi se sada**; ide **posle A1, A2, A3**; posebno planiranje + posebno odobrenje pre implementacije; striktno po `FRONTEND_TECHNOLOGY_RESEARCH.md`; može oprezno dirati shared IDL/balance logic i `useVaultBalance.ts`; **Vault + Poker QA** obavezna |
| **F3** | **F backlog** — **ne ulazi** u A (ni A1–A4) |
| **Mint editable vs `VITE_MINT` lock** | **Kasnija UX odluka** — **ne ulazi** u A1/A2/A3/A4 |
| **Redosled faza** | A1 → A2 → A3 → A4 (A1-test **cancelled/deferred** — nije deo trenutnog A roadmap execution-a) |
| **Commit model** | **Jedan zaseban commit po fazi** (preporuka; korisnik potvrđuje pri startu faze) |
| **Production granice** | Ne dirati `tableVault.ts`, Anchor account redosled, deposit/withdraw/ATA redosled, wallet provider, env, poker server, WS |

---

## Mini-roadmap A1–A4

| Faza | Scope | Rizik | QA | Status | Implementacija |
|------|-------|-------|-----|--------|----------------|
| **A1** | Pure helper-i (`humanToRaw`, format 1:1) | Nizak | Build + Vault tab smoke (bez tx) | **DONE** — `be1eab3`, pushed | **Committed** |
| **A1-test** | FE unit testovi za `vaultAmount.ts` | — | — | **Cancelled / deferred by user decision** | Nije deo trenutnog execution-a |
| **A2** | Presentation komponente; `VaultPlay` orchestrator | Nizak | Build + layout smoke Vault (+ tab switch) | **sledeća planirana faza** | Nije odobrena |
| **A3** | `useVaultPlay` — state, effects, handlers | Srednji | **Pun** Vault QA (connect, refresh, ATA, deposit, withdraw, greške) | planirana | Nije odobrena |
| **A4** | Shared IDL / balance logic; može dirati `useVaultBalance.ts` | Srednji | **Vault + Poker** QA (prikaz „Dostupno u vault-u") | planirana kasnija faza | **Nije odobrena** — poseban plan pre starta |

**A4 napomena:** A4 **jeste deo** A mini-roadmap-a, ali **nije** trenutni implementation scope. Detaljan A4 implementacioni plan piše se **tek posle** A3 acceptance-a i **posebnog** korisničkog odobrenja.

---

## Šta pripada A (granica inicijative)

| Ulazi u A | Ne ulazi u A |
|-----------|--------------|
| `vault/VaultPlay.tsx` refactor | `vault/tableVault.ts` |
| Novi `vault/*` helperi, hookovi, presentation komponente | Anchor program, poker server |
| A4: oprezno `useVaultBalance.ts`, shared IDL/balance (posebno odobrenje) | `vaultConfig.ts` env semantika |
| Reuse postojećih `vaultPdas`, `vaultConfig` parse/program helpera | `.env`, `.env.example`, `package.json`, `package-lock.json` |
| | F3 (`loadTableVaultIdl.ts` hardening) — **F backlog** |
| | Mint editable vs fixed — **kasnija UX odluka** |
| | `App.tsx` providers (Inicijativa E) |
| | B.2 / B.3 CSS inicijative |

---

## F3 — F backlog (van A)

| | |
|---|---|
| **Problem** | [`loadTableVaultIdl.ts`](../../solana/web/src/vault/loadTableVaultIdl.ts) — nema `response.ok` provere |
| **Status** | **Pre-existing**; provereno u aktivnom kodu |
| **Odluka** | **Ne ulazi** u A1–A4; ostaje F backlog |
| **Veza sa A4** | A4 može oprezno dirati IDL load put — F3 i dalje **odvojen** task ako se radi |

---

## A1 — Pure helper-i (detaljan scope — jedina faza sa implementacionim detaljima)

### Korisnička odluka za A1

Izdvojiti **pure helper-e** iz `VaultPlay.tsx` — logika **1:1**, bez promene ponašanja. Bez hooka, bez JSX splita, bez tx handler izmene.

### Cilj A1

Smanjiti inline logiku u `VaultPlay.tsx` premeštanjem **pure** funkcija u novi modul, uz identičan runtime rezultat za amount parsing i formatiranje prikaza balansa.

### Production scope A1

| Menja se | Ne menja se |
|----------|-------------|
| **NOVI** `solana/web/src/vault/vaultAmount.ts` (predloženo ime) | `vault/tableVault.ts` |
| **MOD** `solana/web/src/vault/VaultPlay.tsx` — import helpera, zamena inline poziva | `useVaultBalance.ts`, `vaultBalance.ts`, `loadTableVaultIdl.ts` |
| | Tx handleri (`createUserAta`, `doDeposit`, `doWithdraw`) — telo netaknuto |
| | `refreshBalances` async flow — samo zamena inline formula pozivima helpera |
| | Anchor `.accounts({...})`, `Transaction.add` redosled |
| | UI/JSX, state shape, `err`/`msg` tekstovi |
| | env, package, poker, WS, CSS |

### Helper-i — tačan A1 scope

#### 1. `humanToRaw` (obavezno)

**Izvor:** `VaultPlay.tsx` L117–122.

**Predložena signatura (pure, bez closure nad state):**

```ts
export function humanToRaw(
  human: string,
  mintDecimals: number | null,
): BN | null
```

**Logika 1:1:**

- `mintDecimals === null` → `null`
- `parseFloat(human.replace(',', '.'))`
- `!Number.isFinite(n) || n <= 0` → `null`
- `new BN(Math.round(n * 10 ** mintDecimals))`

**Pozivi u `VaultPlay`:** `doDeposit`, `doWithdraw` — proslediti `mintDecimals` iz state-a.

#### 2. Format helper-i (samo ako 1:1 bezbedni)

**Izvor:** `refreshBalances` u `VaultPlay.tsx`.

| Helper (predlog) | Izvor | Formula 1:1 |
|------------------|-------|-------------|
| `formatSolFromLamports(lamports: number)` | L73–74 | `(lamports / 1e9).toFixed(4)` |
| `formatSplHumanAmount(rawAmount: number, decimals: number)` | L82–83, L100–103 | `(rawAmount / 10 ** decimals).toFixed(Math.min(decimals, 6))` |

**Ostaje u `refreshBalances` (nije pure format):**

- `'—'` za prazan/neučitan prikaz (L63–66)
- `'0 (nema ATA)'` kada `getAccount` baca (L85)
- `'0'` za vault credit catch (L106)
- `setMintDecimals`, RPC pozivi, Anchor fetch — **ne** u helper

**Ne u A1:**

- Deljenje sa `fetchVaultChipBalance` / `useVaultBalance` (to je **A4**, posebno odobrenje)
- `ensureProgram` (A3 hook kandidat)
- Bilo kakva promena rounding prikaza (floor vs toFixed)

### Granice i rizici A1

| Provera | Rezultat |
|---------|----------|
| Menja deposit/withdraw/ATA tx | **Ne** |
| Menja Anchor account mapu | **Ne** |
| Menja prikaz stringova za iste inpute | **Ne** (1:1) |
| `humanToRaw` floating-point ponašanje | **Isto** kao pre (pre-existing `Math.round`) |
| Rizik regresije | **Nizak** — pure extract |

### Build verifikacija (posle implementacije A1)

**Komanda:** `npm run build --prefix solana/web`

| Proverava | Ne proverava |
|-----------|--------------|
| TypeScript compile, Vite bundle | Vizuelni izgled, wallet tx |

**Evidence (posle implementacije):** `frontend-build-pass-a1-1-of-1.log`

### Manual QA plan A1

**Preduslov:** `npm run solana:web`

| # | Scenario | Obavezno |
|---|----------|----------|
| 1 | Frontend start / app load | Da |
| 2 | Vault tab učitava se | Da |
| 3 | Poker ↔ Vault tab switch | Da |
| 4 | Bez walleta — `—` balansi, postojeći disabled dugmadi | Da |
| 5 | Prazan mint — nema crash-a | Da |
| 6 | Nevalidan mint — nema crash-a | Da |
| 7 | Sa walletom + mint — Osveži prikazuje iste SOL/token/vault stringove | Da |
| 8 | Mobile viewport ≤560px | Da |
| 9 | Deposit / Withdraw / ATA | **Ne** — van A1 acceptance-a |
| 10 | Poker lock/release E2E | **Ne** — van A1 acceptance-a |

**Skip-vault:** **ne utiče** na Vault tab QA (VaultPlay ne čita `SKIP_VAULT`).

**Wallet za A1:** preporučeno za scenario 4; nije obavezno za layout smoke (1–2).

**Production Vault deposit/withdraw u A1:** **ne testirati** — van A1 scope-a.

### A1 acceptance

| Kriterijum | Merilo |
|------------|--------|
| Scope | Samo `vaultAmount.ts` (nov) + `VaultPlay.tsx` (import/pozivi) |
| Ponašanje | 1:1 `humanToRaw` + format stringovi |
| Build | `npm run build --prefix solana/web` PASS |
| Manual QA | Smoke gore — bez uočene regresije prikaza |
| Commit | Jedan zaseban commit (kad korisnik odluči) |

**Implementacija A1:** **DONE** — `vaultAmount.ts` + `VaultPlay.tsx`; build PASS; manual QA PASS; commit `be1eab3` pushed.

**A1 verifikacija:** implementirana + build PASS + manual QA PASS — **committed + pushed** (`be1eab3`).

---

## A1-test — istorijska napomena (cancelled / deferred)

**Status:** **Cancelled / deferred by user decision** — nije deo trenutnog A roadmap execution-a.

### Šta se desilo

- Analiza FE unit test setup-a je rađena; razmatran je `tsx` + `node:test` uzor iz `poker/`.
- Pokušaj pokretanja otkrio je **Node ESM / Anchor BN blocker**: `import { BN } from '@coral-xyz/anchor'` pada u `node --import tsx --test`, dok Vite build prolazi.
- Korisnik je odlučio da se **A1-test ne radi sada** — bez package/test runner promena, bez production import/workaround promena.

### Šta nije urađeno u A1-test fazi

- Nema commit-a za A1-test.
- Nema planiranih package promena (`solana/web/package.json`, `package-lock.json`, `tsx`, root `solana:web:test`) u trenutnom scope-u.
- Nema FE unit test fajlova u production tree-u kao deo ove faze.

### Pre-existing ponašanja (backlog notes — ne popravljaju se sada)

Ova ponašanja su dokumentovana tokom A1-test analize; **nisu deo A1-test** jer je faza cancelled:

| Ponašanje | Napomena |
|-----------|----------|
| `parseFloat("1abc")` prihvata numerički prefiks | pre-existing u `humanToRaw` |
| `humanToRaw` može vratiti `BN(0)` za sitan pozitivan input | pre-existing `Math.round`; deposit `!raw` guard ne hvata BN objekat |
| Samo prvi zarez se zamenjuje pre `parseFloat` | pre-existing u `humanToRaw` |

---

### A1 implementacija (stvarno stanje — DONE)

| Stavka | Vrednost |
|--------|----------|
| Novi fajl | `solana/web/src/vault/vaultAmount.ts` |
| Mod | `solana/web/src/vault/VaultPlay.tsx` — import + pozivi helpera |
| Exporti | `humanToRaw`, `formatSolFromLamports`, `formatSplHumanAmount` |
| Tx handleri / JSX / state | **Netaknuto** |
| Build log | `frontend-build-pass-a1-1-of-1.log` — PASS |
| Manual QA | `manual-qa-a1.md` — **PASS** |
| Van A1 QA | Deposit, Withdraw, ATA, Poker lock/release — **nije testirano** |

---

## A2 — Presentation komponente (sažetak — bez implementacionog detalja)

### Cilj

Izdvojiti JSX blokove iz `VaultPlay.tsx` u presentation komponente (npr. vault credit panel, mint/balansi/amount forma, action dugmad) — **props 1:1**, handleri ostaju u parentu (ili kasnije u `useVaultPlay`).

### Predloženi fajlovi (radni nazivi)

- `vault/VaultCreditPanel.tsx`
- `vault/VaultMintBalancesPanel.tsx` (ili split po odluci)
- `vault/VaultActionButtons.tsx`

### QA (planirano)

Build + Vault layout smoke + tab switch; **bez** obaveznog tx ako se handleri ne pomeraju.

**Status:** **sledeća planirana faza** — detalji u budućem osvežavanju plana pre A2 starta.

---

## A3 — `useVaultPlay` hook (sažetak — bez implementacionog detalja)

### Cilj

Preneti state, effects (`loadTableVaultIdl`, `refreshBalances`), `busy`/`err`/`msg` i async handlere u `useVaultPlay`; `VaultPlay.tsx` postaje tanak UI wrapper.

### Rizik

Srednji — wallet tx orchestration; mora ostati **user-action-only** (FRONTEND_TECHNOLOGY §4.5, §4.8).

### QA (planirano)

**Pun** Vault flow: connect, Osveži, Kreiraj ATA, Deposit, Withdraw, greške (nema wallet/SOL/nevalidan iznos).

**Skip-vault:** ne utiče na Vault deposit/withdraw.

**Status:** planirana — detalji pre A3 starta.

---

## A4 — Shared IDL / balance logic (sažetak — planirana kasnija faza)

### Korisnička odluka (finalna)

- A4 **ulazi** u A roadmap — **nije optional**
- **Ne radi se sada** — posle A1, A2, A3
- **Posebno planiranje** i **posebno odobrenje** pre implementacije
- Striktno prati [`FRONTEND_TECHNOLOGY_RESEARCH.md`](../../FRONTEND_TECHNOLOGY_RESEARCH.md) §4.5, §4.6, §4.8 (custom hooks, deljenje stateful logike, ne mešati display parity bez analize)
- Može oprezno razmatrati:
  - shared IDL load (npr. `useTableVaultIdl` ili ekvivalent)
  - deljenje balance read logike između `VaultPlay` i `useVaultBalance.ts`
- **Obavezan QA:** Vault tab **+** Poker tab „Dostupno u vault-u" (buy-in max izvor)

### Kritična napomena (display parity)

`VaultPlay.refreshBalances` koristi **decimalni** `toFixed` prikaz vault kredita.  
`fetchVaultChipBalance` u [`vaultBalance.ts`](../../solana/web/src/vault/vaultBalance.ts) vraća **`Math.floor` celobrojne chipove** za Poker.

A4 **ne sme** ujednačiti ovo bez eksplicitne parity analize i korisničke odluke — inače je to UX promena, ne refactor.

### F3

F3 fix **ostaje van A4** osim ako korisnik posebno otvori F task.

**Status:** planirana kasnija faza — **implementacioni detalji nisu deo ovog dokumenta**.

---

## Šta ne ulazi u A1 (eksplicitno)

| Stavka | Razlog |
|--------|--------|
| Hook `useVaultPlay` | A3 |
| Presentation komponente | A2 |
| Shared IDL / `useVaultBalance` | A4 |
| F3 `response.ok` | F backlog |
| Mint editable vs fixed | kasnija UX odluka |
| `tableVault.ts`, `vaultPdas.ts`, `vaultConfig.ts` env | van scope-a |
| Tx handler telo, Anchor accounts, withdraw tx redosled | netaknuto u A1 |
| `App.tsx`, poker moduli, WS, CSS | druge inicijative / van A |
| Novi dependency-ji | zabranjeno |
| FE unit testovi u A1 patch-u | nije deo A1 production scope-a |
| FE unit testovi (`vaultAmount.ts`) | **A1-test cancelled/deferred** — nema package/test runner plana sada |

---

## Aktivni kod — referenca (fresh scan)

| Fajl | Uloga |
|------|-------|
| [`vault/VaultPlay.tsx`](../../solana/web/src/vault/VaultPlay.tsx) | Vault tab UI + deposit/withdraw/ATA + balance refresh |
| [`vault/useVaultBalance.ts`](../../solana/web/src/vault/useVaultBalance.ts) | Poker tab vault chips read |
| [`vault/vaultBalance.ts`](../../solana/web/src/vault/vaultBalance.ts) | Pure on-chain read (floor chips) |
| [`vault/loadTableVaultIdl.ts`](../../solana/web/src/vault/loadTableVaultIdl.ts) | IDL fetch |
| [`vault/vaultConfig.ts`](../../solana/web/src/vault/vaultConfig.ts) | Env + program/mint parse |
| [`vault/vaultPdas.ts`](../../solana/web/src/vault/vaultPdas.ts) | PDA derivacije |
| [`vault/tableVault.ts`](../../solana/web/src/vault/tableVault.ts) | lock/release — **ne dirati** |
| [`App.tsx`](../../solana/web/src/App.tsx) | Tab switch — **ne dirati u A** |

**Import grafa:** `App` → `VaultPlay`; `PokerPlay` → `useVaultBalance` (ne `VaultPlay`).

---

## Kandidati — globalna tabela (inicijativa A)

| Redosled | Inicijativa | Faza | Tip | Odredište | Kandidat | Status | Odluka |
|----------|-------------|------|-----|-----------|----------|--------|--------|
| 3 | A | A1 | 🧹 | — | `humanToRaw` → `vaultAmount.ts` | DONE | implementirano |
| 3 | A | A1 | 🧹 | — | `formatSolFromLamports` / `formatSplHumanAmount` | DONE | implementirano |
| 3 | A | A1-test | 🧪 | — | FE unit testovi za `vaultAmount.ts` | cancelled / deferred by user decision | ne radi se sada |
| 3 | A | A1-test | 🧪 | — | `tsx` + test skripta u `solana/web` | cancelled / deferred by user decision | ne radi se sada |
| 3 | A | A2 | 🧹 | — | Presentation paneli | **sledeća planirana faza** | pre A2 plana |
| 3 | A | A3 | 🧹 | — | `useVaultPlay` | later phase | |
| 3 | A | A4 | 🧹 | — | Shared IDL / balance + `useVaultBalance.ts` | later phase — user approved roadmap | posebno odobrenje pre starta |
| — | F | F3 | 🐞 | 🔀 | `loadTableVaultIdl` `response.ok` | F backlog | ne u A |
| 3 | A | — | ✨ | — | Mint editable vs `VITE_MINT` lock | deferred UX | kasnije |
| 3 | A | A4 | 🧹 | — | Vault credit vs `fetchVaultChipBalance` parity | needs user decision at A4 | |

---

## Odluke koje još čekaju korisnika

| # | Odluka | Status |
|---|--------|--------|
| 1 | A1 helper scope — sva tri helpera u `vaultAmount.ts` | **DONE** |
| 2 | A1 ime fajla — `vaultAmount.ts` | **DONE** |
| 3 | A1 exporti — `humanToRaw`, `formatSolFromLamports`, `formatSplHumanAmount` | **DONE** |
| 4 | Commit model po fazi — potvrda | **DONE** (A1) |
| 5 | **A2** scope (broj panela / split) | **pre A2 plana** — sledeća aktivna odluka |
| 6 | **A3** `useVaultPlay` API oblik | pre A3 plana |
| 7 | **A4** detaljan plan + display parity strategija | posle A3, pre A4 |
| 8 | Mint editable vs fixed | van A — kasnija UX odluka |
| 9 | F3 — kada u F sprintu | van A |
| — | A1-test — FE unit testovi / test runner | **cancelled / deferred** — nije aktivna odluka |

---

## Šta nije urađeno

| Stavka | Status |
|--------|--------|
| A1 implementacija | **Urađena** |
| A1 build log | **PASS** — `frontend-build-pass-a1-1-of-1.log` |
| A1 manual QA | **PASS** — `manual-qa-a1.md` |
| A1 git commit | **DONE** — `be1eab3` |
| Git push | **DONE** — `origin/feature/refactor-web-vault-ui` |
| A1-test (FE unit testovi) | **Cancelled / deferred by user decision** |
| A2 presentation split | **Sledeća planirana faza** — čeka odobrenje |

---

## Evidence tree (trenutno)

```txt
task-evidence/fe-refactor-a-vault-ui/
├── fe-refactor-a-vault-ui.plan.md
├── frontend-build-pass-a1-1-of-1.log
└── manual-qa-a1.md
```

---

## Finalni verdict (plan)

| Stavka | Status |
|--------|--------|
| Formalni plan A1–A4 | **Upisan** — ovaj fajl |
| A4 u roadmap-u | **DA** — planirana kasnija faza, **nije** current implementation scope |
| F3 | **F backlog** — van A |
| A1 implementacija | **DONE** — `be1eab3`, build + manual QA PASS |
| A1 commit / push | **DONE** |
| **A1-test** | **Cancelled / deferred by user decision** — nema package/test/production promena sada |
| **A2** | **Sledeća planirana faza** — čeka odobrenje |
| A3–A4 | Planirane kasnije faze |
