# Manual QA — Phase 4 Commit 4a

**Task:** fe-clean-code-refactor — Phase 4a vault config + IDL loader  
**Overall status:** **PASS — Commit 4a manual QA ACCEPTED**  
**Final Phase 4 acceptance:** pending Commit 4b + production vault QA  
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

## Pending for final Phase 4 acceptance (after 4b)

- [ ] Production vault: deposit → sit lock → stand release → vault balance update
- [ ] Sit recovery UI best-effort

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
| Production vault | SKIP / pending | Final after 4b |

**Final 4a verdict:** **PASS — READY FOR COMMIT 4a**
