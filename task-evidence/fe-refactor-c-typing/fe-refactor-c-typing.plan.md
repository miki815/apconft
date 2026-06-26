# Inicijativa C — Typing / `vite-env.d.ts` (Phase 1)

**Status:** implementirano — typing-only, bez runtime promene  
**Grana:** `feature/refactor-web-vite-env-typing`  
**Globalni roadmap:** `task-evidence/fe-global-refactor-roadmap/fe-global-refactor-roadmap.plan.md` (Inicijativa 1/7)

---

## Šta je urađeno

- Dopunjen [`solana/web/src/vite-env.d.ts`](../../solana/web/src/vite-env.d.ts) — **Opcija B**:
  - postojeća 3 polja ostaju `string` (required)
  - dodato: `VITE_POKER_WS_URL?: string`
  - dodato: `VITE_POKER_SKIP_VAULT_CHECK?: string`
- Bez komentara u `.d.ts`

## Šta nije dirano

- `App.tsx`, `vaultConfig.ts`, `wsConfig.ts`, `VaultPlay.tsx`
- `.env`, `.env.example`, `package.json`, `package-lock.json`, `tsconfig.json`
- WS/Vault runtime, poker server, Anchor

## Runtime promena

**Ne** — samo TypeScript augmentacija; svi `import.meta.env` izrazi u kodu nepromenjeni.

## Build / QA

| Provera | Rezultat |
|---------|----------|
| `npm run build --prefix solana/web` | **PASS** — vidi `frontend-build-pass-1-of-1.log` |
| Manual QA | **not required** (typing-only) |

## User odluke (finalne)

- Opcija B — postojeća 3 required, nova 2 optional
- Bez komentara u `vite-env.d.ts`

## Later ASK (van scope-a C)

- Retipizirati postojeća 3 polja na `?` (Opcija A)
- `noUnusedLocals`, centralni `env.ts`, Zod schema, F3 IDL hardening

## Verdict

**PASS** — Phase 1 implementirano. Commit/push nije urađen.

## Evidence tree

```txt
task-evidence/fe-refactor-c-typing/
├── fe-refactor-c-typing.plan.md
└── frontend-build-pass-1-of-1.log
```

Manual QA: **not required**
