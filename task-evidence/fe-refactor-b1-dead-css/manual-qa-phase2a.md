# B.1 Phase 2a — Manual QA

**Datum:** 2026-06-27  
**Faza:** B.1 Phase 2a (B1-08–10, `index.css` only)  
**Verdict:** **PASS**

---

## Preduslov

- Frontend: `npm run solana:web`
- Poker server: korišćen (live hand)
- Screenshot baseline: nije rađen (nije blocker)

---

## Env / QA napomene

- Production Vault lock/release: **nije testiran** — van Phase 2a acceptance-a
- Sit/stand Vault E2E: **nije deo** Phase 2a acceptance-a
- B1-11 `.card-row--lg`: **nije diran** — closed / rejected by user decision

---

## Rezultati (korisnik potvrđen)

| # | Scenario | Rezultat |
|---|----------|----------|
| 1 | Poker tab — live hand | **PASS** |
| 2 | Board karte kroz hand/showdown | **PASS** |
| 3 | Hero `PlayingCard size="lg"` | **PASS** |
| 4 | Action UI / `.seat-action` | **PASS** |
| 5 | Showdown rezultat | **PASS** |
| 6 | Vault panel | **PASS** |
| 7 | Tab switch | **PASS** |

---

## Acceptance zaključak

Tokom manual smoke QA **nije uočena vizuelna regresija** u gore navedenim scenarijima.

**Manual QA: PASS** (korisnik potvrđen).
