# Manual QA — Showdown coverage i preostali QA (commit-6)

**Task:** poker showdown result UX — preostali coverage / manual QA  
**Branch:** `feature/poker-showdown-result-ux`  
**Overall status:** **PASS with tie NOT REACHED random deck**  
**Date verified:** 2026-06-23 (korisnički potvrđeno)

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
| **Status** | **NOT REACHED random deck** |
| **Broj pokušaja** | 6 |
| **Broj winner blokova** | 1 |
| **Viewport (px)** | desktop |
| **Napomena** | Posle 6 HU check/call showdown pokušaja nije postignut split/tie. Rezultati su bili single-winner: Two Pair; Four of a Kind; Flush; Flush; Pair; Two Pair. **Nije MR FAIL** — tie/split logika pokrivena engine testom `board-play split winners share the same handRank`. UI multi-winner rendering indirektno potvrđen side-pot PASS scenarijem (2 winner bloka). |

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

**Overall:** **PASS with tie NOT REACHED random deck**

| Oblast | Rezultat |
|--------|----------|
| Automatski deo commit-6 (`npm run poker:test`) | 100/100 PASS |
| Regression build | PASS |
| Side-pot različiti pobednici | PASS |
| Mobile winner blokovi | PASS |
| Tie browser pokušaj | NOT REACHED random deck — **nije MR FAIL** (engine test + multi-winner UI potvrđen side-pot scenarijem) |

**Manual QA:** izvršeno 3/3 scenarija (tie: NOT REACHED; side-pot: PASS; mobile: PASS).

---

## Known residual risks / out of scope

- Tie u browseru sa random deck-om — retko dostižan bez rig/deck alata; logika pokrivena engine testom
- Real Vault add-chips timing tokom result perioda — budući QA task
- Best-five / `bestCards` — van MR scope-a
