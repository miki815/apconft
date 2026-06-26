# Phase 4 — Commit 4b — PDA helper cleanup

**Initiative:** FE clean-code refactor (`solana/web`)  
**Prior commit (4a):** `a50d5a9` — `refactor(poker-ui): izdvoji vault config i IDL loader`  
**Status:** IMPLEMENTED · BUILD PASS · POST-REVIEW PASS · MANUAL QA PASS · **READY FOR COMMIT 4b**  
**Date:** 2026-06-24

---

## Scope (4b only)

| Action | Path |
|--------|------|
| NEW | `solana/web/src/vault/vaultPdas.ts` |
| MOD | `solana/web/src/vault/VaultPlay.tsx` |
| MOD | `solana/web/src/vault/tableVault.ts` |
| MOD | `solana/web/src/vault/vaultBalance.ts` |

## Changes summary

- **vaultPdas.ts:** shared `userBalancePda`, `vaultConfigPda`, `vaultPdas` — 1:1 seeds and `getAssociatedTokenAddressSync(mint, vaultConfig, true)` from prior inline code
- **VaultPlay.tsx:** removed local PDA helpers; import from `vaultPdas`
- **tableVault.ts:** removed local `vaultConfigPda`; import from `vaultPdas` (was importing `userBalancePda` from `vaultBalance`)
- **vaultBalance.ts:** removed exported `userBalancePda`; import from `vaultPdas`; `fetchVaultChipBalance` body unchanged

## Unchanged (1:1)

- PDA seeds: `'balance'` / `'config'`
- Vault token ATA: `allowOwnerOffCurve: true` (third arg)
- User ATA calls in VaultPlay: `(mint, pk)` without third arg
- `lockForTable`, `releaseFromTable`, `fetchVaultChipBalance` bodies
- All handler / UI logic in VaultPlay

## Not touched

- poker components, ws, server, Anchor, env, package files
- `vaultConfig.ts`, `loadTableVaultIdl.ts`, `useVaultBalance.ts`, `usePokerSeating.ts`
- CSS, other vault files

## Build

```bash
npm run build --prefix solana/web
```

**Result:** PASS — 464 modules, built in ~9s  
**Log:** `frontend-build-pass-4b.log`

## Post-implementation review

**Result:** PASS — scope-clean, PDA 1:1, no circular deps, no 4b-introduced bug

## Manual QA

**Result:** PASS — production vault (skip-vault off): deposit, withdraw, lock sit, stand release  
**Details:** `manual-qa.md` — Commit 4b browser QA results

## Git

- **Commit:** pending → user-approved commit 4b
- **Push:** NOT done

## Final Phase 4 acceptance

**NOT YET** — explicit final acceptance note still pending (Sit recovery UI best-effort optional)
