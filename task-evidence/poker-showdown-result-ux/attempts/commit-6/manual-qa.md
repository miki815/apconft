# Manual QA — Showdown coverage i preostali QA (commit-6)

**Task:** poker showdown result UX — preostali coverage / manual QA  
**Branch:** `feature/poker-showdown-result-ux`  
**Overall status:** **PASS**  
**Date verified:** 2026-06-23 (side-pot, mobile); 2026-06-24 (tie/split browser — korisnički potvrđeno screenshotom)

## Preconditions

- `npm run poker:server` — WS na `:3081`
- `npm run solana:web` — Vite na `:5173`
- Skip-vault: `POKER_SKIP_VAULT_CHECK=1` + `VITE_POKER_SKIP_VAULT_CHECK=1`
- Auto-test commit-6: **100/100 PASS** (`poker-test-pass-100-of-100.log`)
- Regression build: **PASS** (`frontend-build-pass.log`)

---

## Scenarios

### 1. Tie / split u browseru

| Polje | Vrednost |
|-------|----------|
| **Status** | **PASS** |
| **Broj pokušaja** | 7 |
| **Broj winner blokova** | 2 |
| **Viewport (px)** | desktop |
| **Napomena** | Nakon prethodnih pokušaja sa random deck-om, u browseru je dostignut tie/split scenario. Result panel prikazao je 2 winner bloka: oba igrača imaju `Glavni pot +10`, isti hand rank `Straight`, a ukupni pot `20` je podeljen na po `10`. Time je ručno potvrđen browser tie/split prikaz. |

---

### 2. Side-pot — različiti pobednici

| Polje | Vrednost |
|-------|----------|
| **Status** | **PASS** |
| **Broj pokušaja** | 2 |
| **Broj winner blokova** | 2 |
| **Viewport (px)** | desktop |
| **Napomena** | U drugom pokušaju browser prikazao različite pobednike po potovima: `DvmN...5gWd` — `Glavni pot +150 · Flush`; `77Ky...KZpU` — `Side pot 1 +100 · Two Pair`. Oba winner seat-a highlightovana. Result panel jasno prikazao dva winner bloka i per-pot linije. |

---

### 3. Mobilni winner blokovi

| Polje | Vrednost |
|-------|----------|
| **Status** | **PASS** |
| **Broj pokušaja** | 1 |
| **Broj winner blokova** | 2 |
| **Viewport (px)** | mobile / uski ekran |
| **Napomena** | Na mobilnom/uskom prikazu 2 winner bloka vidljiva i čitljiva. `Glavni pot` i `Side pot` linije se nisu preklapale. Countdown ostao čitljiv. Nije bilo kritičnog horizontalnog sečenja. |

---

## Verdict

**Overall:** **PASS**

| Oblast | Rezultat |
|--------|----------|
| Automatski deo commit-6 (`npm run poker:test`) | 100/100 PASS |
| Regression build | PASS |
| Side-pot različiti pobednici | PASS |
| Mobile winner blokovi | PASS |
| Tie browser pokušaj | PASS — 2 winner bloka, split pot `20` → po `10`, isti rank `Straight` |

**Manual QA:** izvršeno 3/3 scenarija (tie: PASS; side-pot: PASS; mobile: PASS).

---

## Known residual risks / out of scope

- Tie u browseru sa random deck-om — retko dostižan (7. pokušaj); engine test ostaje dodatna pokrivenost
- Real Vault add-chips timing tokom result perioda — budući QA task
- Best-five / `bestCards` — van MR scope-a
