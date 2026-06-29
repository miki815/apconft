# B.1 Phase 1 — Manual QA

**Datum:** 2026-06-27  
**Faza:** B.1 Phase 1 (dead CSS removal, `index.css` only)  
**Verdict:** **PASS**

---

## Preduslov

- Frontend: `npm run solana:web` → `http://localhost:5173`
- Poker server: korišćen za prošireni smoke (aktivna ruka, showdown, all-in)
- Screenshot baseline: **nije rađen** (nije blocker za Phase 1 acceptance)
- Korisnik je dostavio QA screenshots lokalno; putanje nisu u repou

---

## Env / QA napomene

| Stavka | Vrednost |
|--------|----------|
| `POKER_SKIP_VAULT_CHECK` | `1` (poker server) |
| `VITE_POKER_SKIP_VAULT_CHECK` | uključen na frontendu |
| Frontend prikaz | Vault provera isključena (skip-vault dev path) |
| Production poker lock/release | **Nije testiran** — van Phase 1 acceptance-a |
| Sit/stand Vault E2E | **Nije deo** Phase 1 acceptance-a |
| Dva Chrome profila | **Nisu potrebna** |

---

## Rezultati

| # | Scenario | Rezultat |
|---|----------|----------|
| 1 | App / Poker tab load | **PASS** |
| 2 | Šest poker mesta, hero i kontrole | **PASS** |
| 3 | Aktivna poker ruka i action UI | **PASS** |
| 4 | All-in prikaz | **PASS** |
| 5 | Result / showdown ekran, countdown i pot prikaz | **PASS** |
| 6 | Vault tab i forme | **PASS** |
| 7 | Tab switch Poker ↔ Vault | **PASS** |
| 8 | Viewport ≤540px | **PASS** |
| 9 | Browser console bez novih grešaka | **PASS** |
| 10 | Vault Deposit | **PASS** — dodatna provera izvan minimalnog CSS smoke-a |

---

## Acceptance zaključak

Tokom manual smoke QA **nije uočena vizuelna regresija** u gore navedenim scenarijima.

Bez screenshot baseline-a ne tvrdimo apsolutno 0 vizuelne razlike u svim mogućim stanjima — samo da provera nije našla regresiju.

**Manual QA: PASS** (korisnik potvrđen).
