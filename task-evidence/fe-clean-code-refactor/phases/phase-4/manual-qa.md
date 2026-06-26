# Manual QA — Phase 4 (Commits 4a + 4b)

**Task:** fe-clean-code-refactor — Phase 4 vault config / IDL / PDA cleanup  
**Commit 4a status:** **PASS — ACCEPTED**  
**Commit 4b status:** **PASS — ACCEPTED**  
**Commit 4.5 status:** **PASS — ACCEPTED**  
**Final Phase 4 acceptance:** **ACCEPTED**  
**Tester:** user (browser)  
**Date:** 2026-06-24

---

## Pre-commit verification (agent)

| Check | Result | Log |
|-------|--------|-----|
| `npm run build --prefix solana/web` | PASS | `frontend-build-pass.log` |

---

## Commit 4a browser QA checklist

Env for skip-vault poker items: `VITE_POKER_SKIP_VAULT_CHECK=1` + `POKER_SKIP_VAULT_CHECK=1` (services restarted)

### Poker tab

- [x] Poker tab load
- [x] Wallet connect
- [x] „Dostupno u vault-u“ prikaz
- [x] Refresh vault balance
- [x] Sit smoke (skip-vault)
- [x] Stand smoke — behaves as before
- [x] Hero actions regression
- [x] Countdown / winner banner smoke

### Vault tab

- [x] Vault tab load
- [x] Balance / osveži prikaz
- [x] Deposit / withdraw smoke (valid mint + SOL)

---

## Post-review edge (user decision)

**`VaultPlay null IDL edge`** — noted in post-review; user decision: **leave as-is**; not blocking 4a QA; no fix in 4a.

---

## Pending for final Phase 4 acceptance

- [x] Production vault: deposit → sit lock → stand release → vault balance update (covered in 4b QA)
- [ ] Sit recovery UI best-effort
- [ ] Final Phase 4 acceptance note (explicit sign-off)

## Do not FAIL 4a for

- Stand server timer / „Cannot leave during a hand“
- Countdown silent third state
- PDA-related flows not changed in 4a

---

## Results

| Area | PASS / FAIL / SKIP | Notes |
|------|-------------------|-------|
| Poker 4a smoke | PASS | All checklist items pass |
| Vault 4a smoke | PASS | Load, balance, deposit/withdraw |
| Production vault | PASS | Covered in 4b QA (lock/release, balance) |

**Final 4a verdict:** **PASS — READY FOR COMMIT 4a**

---

## Commit 4b browser QA results

### Vault tab

- [x] Vault load + refresh — PASS
- [x] Deposit smoke — PASS
- [x] Withdraw smoke — PASS

### Poker tab / production vault

Skip-vault je bio isključen:

- `POKER_SKIP_VAULT_CHECK=1` nije aktivan
- `VITE_POKER_SKIP_VAULT_CHECK=1` nije aktivan

Rezultati:

- [x] Poker vault balance prikaz — PASS
- [x] Sit with vault check / lock tx — PASS
- [x] Stand with vault release — PASS
  - mesto oslobođeno
  - novac vraćen

## Status

- Commit 4b implemented
- Build PASS
- Post-implementation review PASS
- Manual QA PASS
- No blocking bug found
- No push

**Final 4b verdict:** **PASS — READY FOR COMMIT 4b**

---

## Commit 4.5 browser QA results

**Scope:** StrictMode-safe IDL effect cleanup — console + regresija (skip-vault OK za ovaj test).

### Dev / StrictMode

- [x] Poker tab load — nema React unmounted setState warning u konzoli — PASS
- [x] Brzo prebacivanje Poker → Vault → Poker — nema konzola warning-a — PASS

### Vault tab (regresija)

- [x] Vault load + refresh — PASS
- [x] Deposit smoke — PASS
- [x] Withdraw smoke — PASS

### Poker tab (regresija)

- [x] Vault balance prikaz — PASS
- [x] Sit / stand smoke — PASS (skip-vault; 4.5 ne testira production lock/release)

### Not in 4.5 scope — do not FAIL 4.5 for

- Stand server timer / countdown / sit recovery UI
- VaultPlay null IDL pending edge (pre-existing)
- `response.ok` IDL handling

## Status

- Commit 4.5 implemented
- Build PASS
- Post-implementation review PASS
- Manual QA PASS
- No blocking bug found
- No push

**Final 4.5 verdict:** **PASS — READY FOR COMMIT 4.5**
