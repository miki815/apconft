# Manual QA — Winner card UI polish 2A/A2 (commit-8)

**Task:** poker showdown result UX — winner card polish (2A/A2 + Winner receipt CSS)  
**Branch:** `feature/poker-showdown-result-ux`  
**Overall status:** **PASS**  
**Date verified:** 2026-06-23 (korisnički potvrđeno)

## Preconditions

- `npm run poker:server` — WS na `:3081`
- `npm run solana:web` — Vite na `:5173`
- Frontend build: vidi `frontend-build-pass.log` u istom folderu

---

## Scenarios — PASS

### 1. Single winner — drugi igrač winner

| Polje | Vrednost |
|-------|----------|
| **Status** | **PASS** |
| **Napomena** | Jedna kompaktna winner kartica; head sa `shortPk` + zelen total; pot red label + gold amount; rank ispod (showdown). |

### 2. Single winner — Ti winner

| Polje | Vrednost |
|-------|----------|
| **Status** | **PASS** |
| **Napomena** | `.winner-chip--you`: samo plavi `border-left` + plavo ime „Ti“, bez plavog tint-a i bez glow-a. Zelen total u head-u. |

### 3. Jedan winner — više potova

| Polje | Vrednost |
|-------|----------|
| **Status** | **PASS** |
| **Napomena** | Jedna kartica, više receipt pot redova (glavni + side); glavni pot bold label; rank po redu gde postoji. |

### 4. Dve winner kartice side-by-side

| Polje | Vrednost |
|-------|----------|
| **Status** | **PASS** |
| **Napomena** | Dve kompaktne kartice jedna do druge na desktop širini; prirodan wrap; bez horizontal scroll-a. |

### 5. Ti winner + side-pot

| Polje | Vrednost |
|-------|----------|
| **Status** | **PASS** |
| **Napomena** | Ti accent na winner kartici; side-pot linije čitljive; gold amount desno; rank ispod pot reda. |

### 6. Mobile responsive

| Polje | Vrednost |
|-------|----------|
| **Status** | **PASS** |
| **Napomena** | Wrap na uskim ekranima; tekst čitljiv; nema horizontal overflow-a. |

### 7. Fold result — bez rank reda

| Polje | Vrednost |
|-------|----------|
| **Status** | **PASS** |
| **Napomena** | Naslov `Rezultat ruke`; pot label + gold amount; `.winner-pot-rank` se ne renderuje. |

### 8. Winner receipt CSS korekcija

| Polje | Vrednost |
|-------|----------|
| **Status** | **PASS** |
| **Napomena** | Pot redovi više nisu plavi/tamni mini-boxovi; nema gold dot-a; receipt stil (gold top accent, dashed separatori); kartica kompaktnija posle vertikalnog padding tweak-a. Vizuelno različito od live Pot Breakdown iznad stola. |

---

## Regression checks (vizuelno)

- Countdown / `ShowdownBar` — nepromenjen
- Live Pot Breakdown tokom ruke — nepromenjen
- Seat `.winner` highlight — nepromenjen
- Winner banner pozicija dole — ista

---

## Out of scope (nije QA-ovano u ovom commit-u)

- Tie/split 3+ winner bloka u browseru (pokriveno engine testovima u ranijim commit-ima)
- 4+ winner kartice u jednom redu / wrap edge case
