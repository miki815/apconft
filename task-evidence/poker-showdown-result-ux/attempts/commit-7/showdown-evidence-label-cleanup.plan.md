# Showdown evidence label cleanup (commit-7)

**Branch:** `feature/poker-showdown-result-ux`  
**Tip:** docs / evidence cleanup — bez produkcijskih izmena

## Cilj

Cleanup internih oznaka iz showdown result UX evidence fajlova (radna tabela / roadmap brojevi), zamenom opisnim nazivima taska.

## Scope

Samo markdown evidence fajlovi u:

- `task-evidence/poker-showdown-result-ux/attempts/commit-1/`
- `task-evidence/poker-showdown-result-ux/attempts/commit-2/`
- `task-evidence/poker-showdown-result-ux/attempts/commit-3/`
- `task-evidence/poker-showdown-result-ux/attempts/commit-4/`

## Šta je promenjeno

- `Task 9` / `Taska 9` → `showdown result UX`
- Uklonjen `#8` iz smooth countdown manual QA naslova (`commit-4/manual-qa.md`)
- Uklonjena odustala referenca na countdown copy doradu / `#7` (`commit-2/manual-qa.md` — obrisan ceo bullet)
- Plan fajlovi commit-1 do commit-4 očišćeni od internih oznaka
- Manual QA fajlovi commit-1 do commit-4 očišćeni od internih oznaka

## Šta nije menjano

- Produkcijski kod
- Testovi
- Logovi
- Manual QA rezultati / statusi / datumi
- commit-5 / commit-6 evidence
- **EV-P01** — `Nizak —` regresioni opis rizika (commit-2 plan)
- **EV-P02** — `broadcast #1` / `#2` tehnički redosled emit-a (commit-2 plan)

## Verifikacija (`rg` kroz `task-evidence/`)

- Nema `Task 9`
- Nema `Taska 9`
- Nema internih `#7–#17` u `poker-showdown-result-ux/`
- Nema `Red N`, `stavka N`, `radna tabela`, `roadmap`, `tvoja/moja tabela`

## Remaining allowed references

- Taiga / MR / PR brojevi u drugim task folderima
- CSS hex boje (`#8fa3bb`, itd.)
- QA scenario numeracija (`| # | Scenario |`, Scenario A/B)
- `broadcast #1` / `#2` (commit-2 plan)
- `Nizak —` kao opis rizika (commit-2 plan)

## Status

Spremno za commit-7 (docs only). Commit samo na eksplicitni korisnički zahtev.
