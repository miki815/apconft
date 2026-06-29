# Phase 4 — Shared Vault / IDL / PDA cleanup

**Initiative:** FE clean-code refactor (`solana/web`)  
**Phase 4 split:** Option C — two smaller commits  
**Prior:** Phase 1–3 ACCEPTED, Phase 3.5 DONE  
**Final Phase 4 acceptance:** **NOT YET** — Commit 4b pending

---

## Commit 4a — Vault config + IDL loader + SKIP_VAULT cleanup

**Status:** IMPLEMENTED + BUILD PASS + POST-REVIEW SCOPE-CLEAN + MANUAL QA PASS  
**Ready for:** user review / git commit 4a  
**Date:** 2026-06-24

Commit 4a is **not** final Phase 4 acceptance.

### Scope (4a only)

| Action | Path |
|--------|------|
| NEW | `solana/web/src/vault/vaultConfig.ts` |
| NEW | `solana/web/src/vault/loadTableVaultIdl.ts` |
| MOD | `solana/web/src/vault/useVaultBalance.ts` |
| MOD | `solana/web/src/vault/VaultPlay.tsx` |
| MOD | `solana/web/src/poker/PokerPlay.tsx` |
| MOD | `solana/web/src/poker/usePokerSeating.ts` |

### Changes summary

- **vaultConfig.ts:** shared program id, `TABLE_MINT`, `SKIP_VAULT`, `getTableVaultProgramId()`, `parseMintPublicKey()` — 1:1 from prior inline code
- **loadTableVaultIdl.ts:** pure async `/idl/table_vault.json`, catch → `null`
- **PokerPlay:** removed duplicate IDL fetch; uses `idl`, `programId` from `useVaultBalance`
- **usePokerSeating:** `SKIP_VAULT` import only — handlers unchanged
- **useVaultBalance / VaultPlay:** shared config + IDL loader

### Post-review

- **Scope-clean:** yes — no forbidden files; no 4b leakage
- **Blocking bug:** none found in 4a
- **`VaultPlay null IDL edge`:** accepted as-is by user; not blocking; no fix in 4a

### Unchanged (4a)

- `vaultTxReady`, `hasIdl`, `usePokerSeating` props wiring
- `lockForTable` / `releaseFromTable` / `fetchVaultChipBalance` bodies
- `tableVault.ts`, `vaultBalance.ts` (PDA — 4b)
- ws, server, Anchor, env, package, CSS

### Verification

| Check | Result | Evidence |
|-------|--------|----------|
| `npm run build --prefix solana/web` | PASS | `frontend-build-pass.log` (463 modules) |
| Post-implementation review | SCOPE-CLEAN | no blocking bugs |
| Manual QA 4a | **PASS** | `manual-qa.md` |
| Production vault QA | **PENDING** | after Commit 4b |
| Sit recovery UI | **WATCHLIST** | best-effort |

### Git

Commit 4a git commit made after evidence update (see commit hash in session output).

---

## Commit 4b — PDA helper cleanup (NOT STARTED)

Planned:

- NEW `solana/web/src/vault/vaultPdas.ts`
- MOD `vaultBalance.ts`, `tableVault.ts`, `VaultPlay.tsx` (remove local PDA copies)

Invariants: seeds `balance` / `config` 1:1; `getAssociatedTokenAddressSync(..., true)` unchanged; lock/release/fetchVaultChipBalance bodies unchanged.

**Do not start 4b until 4a is committed and user approves 4b scope.**

---

## Roadmap status

| Item | Status |
|------|--------|
| Vault / IDL / PDA cleanup | Phase 4 in progress — **4a QA PASS**, 4b pending |
| `shared-skip-vault-constant` | done in 4a |
| PDA cleanup | 4b pending |
| `seating-validation-helpers` | later, outside Phase 4 |
| `qa-seating-production-vault` | pending final acceptance after 4b |
| `response.ok` for IDL | pre-existing — separate ASK later |
| StrictMode IDL / AbortController | pre-existing — separate ASK later |
| Stand / countdown / sit recovery | pre-existing — out of Phase 4 scope |

---

## Next

1. Commit 4a (if not yet committed)
2. User approves Commit 4b scope
3. Implement 4b → build → QA → production vault for final Phase 4 acceptance
