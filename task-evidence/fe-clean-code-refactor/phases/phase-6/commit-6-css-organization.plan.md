# Phase 6 — Commit 6 — CSS organizacija (A1)

**Initiative:** FE clean-code refactor (`solana/web`)  
**Prior:** Phase 5 ACCEPTED — `cee463f`  
**Status:** DONE — BUILD PASS — manual QA PASS — ready for user commit decision  
**Date:** 2026-06-24

---

## Scope (A1 only)

| Action | Path |
|--------|------|
| MOD | `solana/web/src/index.css` — comment header-i + whitespace only |

## Changes summary

Dodati section/sub-section comment header-i (bez promene CSS pravila):

- `/* —— Base / tokens —— */` — pre reset (`*`), pokriva `*`, `:root`, `body`
- `/* —— Winner banner —— */` — pre `.winner-banner`
- `/* —— Showdown countdown bar —— */` — pre `.showdown-bar-wrap`
- `/* —— Poker controls —— */` — pre `.poker-controls`

## Unchanged (hard boundaries)

- 0 reorder rule blokova
- 0 brisanje CSS-a
- 0 split fajlova
- 0 promena selektora/vrednosti/boja/spacing/font-size/layout
- 0 promena `@media` / `@keyframes`
- 0 TSX / className izmena
- WS, Vault, wallet, poker runtime netaknuti

## Dead CSS (optional later — NOT in this commit)

- `.table-visual--vault` (+ child `.seat*` rules)
- `.panel--actions`, `.panel--waiting`
- `.action-hint`

## Diff guard (post-implementation)

- [x] Diff samo comment linije u `index.css` (+4 linije)
- [x] 0 declaration promena u `{ ... }`
- [x] 0 `@media` promena
- [x] 0 `@keyframes` promena
- [x] 0 TSX promena

## Build

```bash
npm run build --prefix solana/web
```

**Log:** `frontend-build-pass-6.log`

## Manual QA

**Minimum visual smoke:** **PASS** — see `manual-qa.md`  
Skip-vault OK; production vault/on-chain QA not required.

## Git

- **Commit:** NOT made (predložena poruka: `refactor(web): organizuj index.css sekcije`)
- **Push:** NOT done
