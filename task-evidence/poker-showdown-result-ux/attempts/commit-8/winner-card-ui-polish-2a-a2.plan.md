# Winner card UI polish — 2A/A2

**Branch:** `feature/poker-showdown-result-ux`  
**Tip commit-a:** frontend UX polish (commit-8)  
**Prethodni kontekst:** showdown result UX osnova (commit-1–7), coverage QA (commit-6)

---

## 1. Summary

Frontend-only polish winner/result kartica u Poker tabu: **2A JSX struktura** + **Winner receipt + compact CSS** final, bez promene logike, grouping-a, countdown-a, servera ili WS contract-a.

**Finalni vizuelni stil:** Winner receipt — gold top accent na kartici, dashed separatori, flat pot linije (bez mini-boxova), kompaktan padding posle visual QA. **Nije** kopija live Pot Breakdown.

**Layout:** prirodan flex-wrap — kartice kompaktne (`flex: 0 1 auto`, `min-width: min(100%, 9rem)`), jedna do druge kad ima prostora; wrap na uže ekrane; **bez** full-width kartica na desktopu.

**Status:** **IMPLEMENTIRANO** — manual QA PASS (8 scenarija), frontend build PASS. **Commit:** čeka korisničku potvrdu.

---

## 1b. Finalni dizajn — verifikovano u aktivnom kodu (2026-06-23)

| Tačka | Status u kodu |
|-------|----------------|
| Winner receipt + compact CSS | **Da** — `index.css` L1186–1286 |
| Nema pot mini-boxova | **Da** — `.winner-pot-row` bez border/background box-a |
| Nema gold dot-a | **Da** — nema `.winner-pot-label::before` |
| Nema plavog background tint-a za `Ti` | **Da** — `.winner-chip--you` samo `border-left` |
| `Ti` accent: border-left + plavo ime | **Da** — L1202–1204, L1219–1221 |
| Flat receipt linije + dashed separatori | **Da** — head `border-bottom: dashed`; pot `border-top: dashed` između redova |
| Gold top accent na kartici | **Da** — `border-top: 2px solid rgba(240,193,75,0.45)` |
| Smanjen padding posle visual QA | **Da** — chip `0.4rem 0.55rem`; mobile `0.38rem 0.48rem` |
| Kompaktne kartice, prirodan wrap | **Da** — `.winner-banner-chips` flex-wrap |
| 1 winner nije full-width | **Da** — `flex: 0 1 auto`, nema `width: 100%` |
| 2 winnera side-by-side | **Da** (layout + manual QA PASS) |
| Mobile bez horizontal overflow | **Da** (manual QA PASS; `max-width: 100%`) |
| Manual QA | **PASS** — `manual-qa.md` |
| Frontend build | **PASS** — `frontend-build-pass.log` (`index-CMmiyopn.css`) |

---

## 2. Korisničke odluke

### Layout

- Zadržati položaj winner/result bannera dole (kao sada).
- Zadržati osećaj trenutnog layout-a — winner kartice kompaktne kao sada.
- Prirodan wrap: kartice idu jedna do druge kada ima prostora; ako nema, prirodno se wrap-uju.
- **Bez** forsiranja 3-column grid-a.
- **Bez** full-width kartica na desktopu.
- **1 winner:** kompaktna kartica, ne full width.
- **2 winnera:** jedna do druge (kao na screenshot-u) ako ima prostora.
- **3 winnera:** mogu stati u red ako realna širina panela dozvoljava (~488px inner zona).
- **4. kartica:** kompaktna, ide u novi red prirodno (ne full width).
- **Bez** horizontalnog scroll-a.
- **Mobile:** 1 po redu ako širina to zahteva.

### Vizuelni izbor (finalno — Winner receipt + compact)

- Pravac **2A** JSX + **Winner receipt** CSS (nakon visual QA korekcije, ne originalni A2 mini-box).
- Winner head: ime + **zeleni** total (`--success`); dashed gold separator ispod head-a.
- Pot amount: **gold** (`--gold`); pot linije **flat** (bez mini-boxova).
- Rank: **muted** tekst **ispod** pot reda (caption).
- Glavni pot: **samo bold label** (`--main`), bez posebnog box-a.
- **Ti** accent (samo kad sam winner): **samo** `border-left` + plavo ime — **bez** plavog tint-a, **bez** glow-a.
- Gold top accent na winner kartici (`border-top`).
- Nema gold dot-a na pot labeli.
- Nema eligible linija u winner kartici.
- Vizuelno **različito** od live Pot Breakdown (nema `.pot-breakdown-*` reuse).

### Funkcionalnost

- Nema promena logike, grouping-a, countdown-a, servera, WS-a, tekstualne logike.

---

## 3. Scope

### Dirati (posle odobrenja)

| Fajl | Opis |
|------|------|
| `solana/web/src/poker/PokerPlay.tsx` | Winner banner JSX (~L835–859) |
| `solana/web/src/index.css` | `.winner-*` blok (~L1158–1212) + `.winner-banner-chips` |

### Ne dirati

- `ShowdownBar.tsx`, `ws.ts`, `showdown.ts`
- `poker/` (engine, server, `room.ts`, `protocol.ts`)
- WS contract, countdown lifecycle
- Vault / lock / release, env, package/deps
- best-five / `bestCards`
- `groupWinners()`, `potLabel()`, `resultKind` / `resultPhase` uslovi
- Live `PotBreakdown` komponenta i `.pot-breakdown-*` stilovi

---

## 4. Šta se menja (finalno implementirano)

- DOM struktura winner pot linija: label + amount odvojeni; rank u posebnom redu ispod (2A JSX).
- **Winner receipt CSS:** gold top accent, dashed separatori, flat pot linije — **bez** mini-boxova i gold dot-a.
- **Compact CSS:** smanjen vertikalni padding/gap posle browser visual QA.
- `.winner-banner-chips` wrapper sa **flex-wrap**.
- `.winner-chip--you`: samo `border-left` + plavo ime (bez plavog background tint-a).
- Uklonjeno `.winner-pot-detail` (zamenjeno `.winner-pot-row` strukturom).

---

## 5. Šta se ne menja

- Render uslov: `resultPhase && table && winnerGroups.length > 0`
- `winnerGroups.map`, `key={group.playerId}`, `groupWinners()` grouping
- Tekstualni stringovi: `Showdown rezultat`, `Rezultat ruke`, `Glavni pot`, `Side pot N`, `handRank.name`, `Ti`, `shortPk()`
- Pozicija bannera u DOM-u (ispod `poker-table-section`)
- Spoljašnji `.winner-banner` gradient/border/title (zadržati)
- Countdown, seat `.winner` glow, showdown overlay
- Server, engine, WS payload

---

## 6. JSX mini-plan

Zamena bloka u `PokerPlay.tsx` (winner banner):

```tsx
{resultPhase && table && winnerGroups.length > 0 ? (
  <div className="winner-banner">
    <span className="winner-banner-title">
      {table.resultKind === 'showdown' ? 'Showdown rezultat' : 'Rezultat ruke'}
    </span>
    <div className="winner-banner-chips">
      {winnerGroups.map((group) => {
        const isYou = group.playerId === playerId
        return (
          <div
            key={group.playerId}
            className={[
              'winner-chip',
              isYou ? 'winner-chip--you' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="winner-chip-head">
              <span className="winner-chip-name">
                {isYou ? 'Ti' : shortPk(group.playerId)}
              </span>
              <strong className="winner-chip-total">+{group.total}</strong>
            </div>
            <div className="winner-chip-details">
              {group.wins.map((win) => (
                <div
                  key={`${win.playerId}-${win.potIndex}`}
                  className={[
                    'winner-pot-row',
                    win.potIndex === 0 ? 'winner-pot-row--main' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <div className="winner-pot-head">
                    <span className="winner-pot-label">
                      {potLabel(win.potIndex)}
                    </span>
                    <span className="winner-pot-amount">+{win.amount}</span>
                  </div>
                  {win.handRank ? (
                    <span className="winner-pot-rank">{win.handRank.name}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  </div>
) : null}
```

---

## 7. Finalni CSS — Winner receipt + compact

**Provereno u:** `solana/web/src/index.css` (`.winner-*` blok, ~L1158–1286)

### Layout — prirodan wrap (NE grid, NE full-width)

- `.winner-banner`: column layout; spoljašnji gradient/border nepromenjen.
- `.winner-banner-chips`: `display: flex; flex-wrap: wrap; gap: 0.5rem 0.75rem`.
- `.winner-chip`: `flex: 0 1 auto`; `min-width: min(100%, 9rem)`; `max-width: 100%` — kompaktno, ne full-width.

### Winner receipt — kartica

| Klasa | Finalno ponašanje |
|-------|-------------------|
| `.winner-chip` | `border-top: 2px solid rgba(240,193,75,0.45)` (gold receipt accent); padding **`0.4rem 0.55rem`**; gap `0.15rem` |
| `.winner-chip--you` | **Samo** `border-left: 3px solid var(--accent)` — **nema** background tint |
| `.winner-chip-head` | `border-bottom: 1px dashed rgba(240,193,75,0.2)`; padding-bottom `0.22rem` |
| `.winner-chip-name` | default; pod `--you`: `color: var(--accent)` |
| `.winner-chip-total` | `color: var(--success)`; `tabular-nums` |
| `.winner-chip-details` | `margin-top: 0.18rem`; bez gap između pot redova |

### Flat pot linije (bez mini-boxova)

| Klasa | Finalno ponašanje |
|-------|-------------------|
| `.winner-pot-row` | **Flat** — samo `padding: 0.18rem 0`; **nema** border/background box-a |
| `.winner-pot-row + .winner-pot-row` | `border-top: 1px dashed rgba(255,255,255,0.06)` |
| `.winner-pot-row--main` | **Samo** bold label (`.winner-pot-label` font-weight 700) — **nema** tamniji box |
| `.winner-pot-label` | **Nema** gold dot (`::before` uklonjen) |
| `.winner-pot-amount` | gold, bold, `flex-shrink: 0` |
| `.winner-pot-rank` | muted caption ispod; `margin-top: 0.05rem`; `padding-left: 0.12rem` |

### Mobile (≤540px)

- `.winner-chip` padding: **`0.38rem 0.48rem`**

### Uklonjeno (potvrđeno u kodu)

- `.winner-pot-detail`
- `.winner-pot-label::before` (gold dot)
- pot row mini-box border/background (bivši A2 pristup)
- plavi background tint na `.winner-chip--you`

---

## 8. Responsive / layout pravila

**Provereno u aktivnom kodu:**

| Sloj | Pravilo | Efektivna širina |
|------|---------|------------------|
| `.app-shell` | `max-width: 560px`, padding `1.25rem` L/R | sadržaj ~520px |
| `.winner-banner` | padding `1rem` L/R | zona kartica ~488px |
| `.winner-chip` (trenutno) | `min-width: 9rem` | 3×144 + gap ≈ 448px → **staje** u max panel |

**Očekivano wrap ponašanje (flex-wrap + min-width 9rem):**

| Inner širina | Tipično | Kartice u redu |
|--------------|---------|----------------|
| ~488px (max panel) | 3 winnera | do 3 u redu |
| ~488px | 2 winnera | 2 u redu (screenshot) |
| ~300–470px | 2+ winnera | 2 u redu, ostatak ispod |
| ~<296px | bilo koji | 1 po redu |

**Kompromis ako A2 padding učini 3-u-redu tesnim:** prvo smanjiti horizontal padding chip-a; ne uvoditi grid ni full-width.

---

## 9. Rizici

| Rizik | Nivo | Mitigacija |
|-------|------|------------|
| Horizontal overflow | Srednji | `min-width: 0` na label, `flex-shrink: 0` na amount, `max-width: 100%` |
| 3 kartice tijesne na max panelu | Nizak–srednji | zadržati kompaktan padding; ne full-width |
| Kolizija sa Pot Breakdown | Nizak | odvojene `winner-pot-*` klase |
| Ti accent + seat `.you`/`.winner` | Nizak | samo border-left + plavo ime; banner ispod stola |
| Mrtav CSS `.winner-pot-detail` | **Zatvoreno** | uklonjeno iz koda |
| Funkcionalna regresija | Nizak | isti uslovi, map, keys, stringovi |

---

## 10. QA checklist — **PASS** (vidi `manual-qa.md`)

### Screenshot scenario — 2 winnera, Ti nije winner

- [x] Banner dole — ista pozicija
- [x] 2 kartice jedna do druge (~560px viewport)
- [x] Nijedna kartica nema plavi tint (`.winner-chip--you` absent)
- [x] Head: `shortPk` + zelen total
- [x] Pot: label + gold amount; rank ispod (showdown)
- [x] Glavni pot bold label (bez box-a)
- [x] Nema horizontal scroll
- [x] Pot Breakdown / countdown / seat glow nepromenjeni

### Ti winner scenario

- [x] Samo tvoja kartica ima `.winner-chip--you`
- [x] Ime **Ti** plavo; **samo** border-left; **bez** tint-a i glow-a
- [x] Total zelen; pot gold; rank ispod

### 1 winner

- [x] Kompaktna kartica (~9rem+), **ne** full width

### 3 winnera

- [ ] Do 3 u redu na max panelu — **nije eksplicitno QA-ovano u browseru** (layout podržava; nije blocker)

### 4+ winnera

- [ ] 4. kartica kompaktna u novom redu — **nije eksplicitno QA-ovano** (nije blocker)

### Side-pot

- [x] 2 winnera različitih potova (main + side)
- [x] 1 winner, više pot redova unutar jedne kartice

### Fold result

- [x] Naslov `Rezultat ruke`; nema `.winner-pot-rank`

### Mobile ≤540px

- [x] Wrap; rank prelom; nema horizontal scroll

### Receipt CSS korekcija

- [x] Pot redovi više nisu plavi/tamni mini-boxovi; receipt stil potvrđen

---

## 11. Build / evidence — **URAĐENO**

| Artefakt | Status |
|----------|--------|
| `frontend-build-pass.log` | **PASS** — vite build; CSS `index-CMmiyopn.css` (posle receipt + compact CSS) |
| `manual-qa.md` | **PASS** — 8 scenarija |
| `winner-card-ui-polish-2a-a2.plan.md` | Ažuriran na finalni Winner receipt + compact dizajn |

Poker test: **nije pokretan** (nema `poker/` izmena).

### Evidence folder (commit-8)

```txt
task-evidence/poker-showdown-result-ux/attempts/commit-8/
  winner-card-ui-polish-2a-a2.plan.md
  frontend-build-pass.log
  manual-qa.md
```

Finalni root evidence folder ostaje poseban korak pri zatvaranju celog MR-a.

---

## 12. Status

- **Implementacija:** URAĐENA — 2A JSX + Winner receipt + compact CSS
- **Manual QA:** PASS (`manual-qa.md`)
- **Frontend build:** PASS (`frontend-build-pass.log`)
- **Plan:** ažuriran na finalno stanje (2026-06-23)
- **Commit / push:** čeka korisničku potvrdu
