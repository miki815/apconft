# Frontend best practices reference — apconft

**Poslednje ažuriranje:** 2026-06-24  
**Obuhvat:** `solana/web` u `apconft` monorepo-u  
**Povezano pravilo:** `.cursor/rules/apconft-work-protocol.mdc` → *Tehnološki research pre implementacije*

---

## 1. Svrha dokumenta

Ovaj dokument je **zbirni living reference** za frontend best practices u `apconft` projektu.

Služi kao interni izvor **proverenih frontend praksi** za naš stvarni stack: React 18, TypeScript, Vite, WebSocket poker UI, Solana wallet/Vault flow i `solana/web` strukturu.

U njega ulaze samo zaključci provereni kroz relevantne izvore: official dokumentaciju, official release notes/changelog, official guides/API reference, validne use-case primere i primarne izvore za security/performance kada su relevantni.

Tehničke odluke u frontendu treba da se oslanjaju na **proverljive izvore** i **dobre prakse** usklađene sa ovim stackom — ne na opšte pretpostavke.

Ažurira se kada novi research potvrdi ili ispravi zaključak.

### Konflikt: dokument vs aktivni kod

| Situation | Pravilo |
|-----------|---------|
| Ponašanje aplikacije | **Aktivni kod** je izvor istine dok se eksplicitno ne dogovori promena |
| Dobra praksa vs trenutni kod | Postojeći kod je **kontekst**, ne automatski uzor; loš pattern se ne predstavlja kao preporuka |
| Promena ponašanja ili strukture | Eksplicitna odluka pre promene ponašanja |

### Mapiranje na protokol (*Tehnološki research pre implementacije*)

Svaka §4 podsekcija pokriva isti set pitanja iz `.cursor/rules/apconft-work-protocol.mdc`:

| Provera iz protokola | Gde u ovom doc-u |
|----------------------|------------------|
| Official docs / changelog / guides za **verziju koju koristimo** | §2 stack + §3 tabela + §4 po tehnologiji |
| Poznata ograničenja tehnologije | §4 **Nepotvrđeno** / napomene u telu |
| Preporučeni način implementacije | §4 **Proverena dobra praksa** |
| Anti-patterns i česte greške | §4 + §4.8 (clean code) |
| Security / performance / runtime posledice | §4.10 + relevantne §4 podsekcije |
| Jednostavnije ili standardnije rešenje | §4 **Arhitekturne opcije / tradeoff-i** |
| Frontend clean-code organizacija | §4.8 + §5 |

---

## 2. Naš frontend stack

**Provereno u aktivnom kodu** — `solana/web/package.json`, `tsconfig.json`, `vite.config.ts`, `src/main.tsx`, `src/App.tsx`, `src/poker/ws.ts`.

| Sloj | Tehnologija | Verzija / stanje |
|------|-------------|------------------|
| UI | React | `^18.3.1`, `createRoot`, `<React.StrictMode>` |
| Build | Vite | `^5.4.11`, port **5173**, `host: true` |
| Plugin | `@vitejs/plugin-react` | `^4.3.3` |
| Jezik | TypeScript | `~5.6.3`, **`strict: true`**, `noUnusedLocals: false` |
| Solana RPC / tx | `@solana/web3.js` | `^1.95.8` |
| Wallet | `@solana/wallet-adapter-react` + Phantom | `^0.15.35` / `^0.9.29` |
| Anchor client | `@coral-xyz/anchor` | **0.31.1** (pinned; legacy paket) |
| SPL | `@solana/spl-token` | `^0.4.9` |
| Poker realtime | native **WebSocket** | `poker/ws.ts` → `usePokerWs` |
| Styling | **jedan** `index.css` | globalne klase; `@media (max-width: 540px)` postoji |
| State | lokalni React hooks | nema Redux, Zustand, React Router |
| Polyfill | `buffer` | `polyfills.ts` pre ostalih importa u `main.tsx` |
| FE testovi | — | nema unit/e2e skripti u `package.json` |

### Struktura `solana/web/src/`

```
App.tsx              # wallet providers, tab shell
poker/               # PokerPlay orchestration, ws hook, UI komponente, helperi
vault/               # VaultPlay, useVaultBalance, on-chain helperi
index.css            # globalni stil
```

Feature folderi `poker/` i `vault/` odgovaraju tabovima — postojeća project organizacija.

---

## 3. Provereni izvori

| Naziv | Link | Oblast | Zaključak za naš projekat | Status |
|-------|------|--------|---------------------------|--------|
| React — Rules of Hooks | https://react.dev/reference/rules/rules-of-hooks | React | Hook-ovi samo top-level; ne u uslovima/petljama/handlerima | **Official — provereno** |
| React — useEffect | https://react.dev/reference/react/useEffect | React effects | Effect + cleanup za eksterne sisteme | **Official — provereno** |
| React — Synchronizing with Effects | https://react.dev/learn/synchronizing-with-effects | React effects | Setup/cleanup simetrija; external sync | **Official — provereno** |
| React — You Might Not Need an Effect | https://react.dev/learn/you-might-not-need-an-effect | React state | Derivacije van Effect-a; event handler za user akcije | **Official — referencirano** |
| React — StrictMode | https://react.dev/reference/react/StrictMode | React dev | Dev-only double invoke Effects — cleanup obavezan | **Official — provereno** |
| React — useMemo | https://react.dev/reference/react/useMemo | React perf | Memo samo kad izračun spor / prop za `memo` / Hook dependency; ne ubrzava prvi render | **Official — provereno** |
| React — useCallback | https://react.dev/reference/react/useCallback | React perf | Cache funkcije između render-a; koristi se uz `memo` ili Hook deps | **Official — provereno** |
| React — memo | https://react.dev/reference/react/memo | React perf | Skip re-render kad su props isti; **ne** svuda; profiler pre optimizacije | **Official — provereno** |
| React — Custom Hooks | https://react.dev/learn/reusing-logic-with-custom-hooks | React hooks | Deljenje **stateful logike**, ne state-a; `use*` samo ako poziva Hook-ove | **Official — provereno** |
| React 18.3 release | https://github.com/facebook/react/releases/tag/v18.3.0 | React verzija | 18.2-compatible release sa dodatnim deprecation warning-ima za React 19 pripremu | **Official release — provereno** |
| React 19 Upgrade Guide (18.3 kontekst) | https://react.dev/blog/2024/04/25/react-19-upgrade-guide | React verzija | Preporuka upgrade na 18.3 pre 19 radi ranijih warning-a | **Official — referencirano** |
| Vite — Env Variables and Modes | https://vite.dev/guide/env-and-mode | Vite env | `VITE_*` u klijentu; string vrednosti; restart; bez tajni | **Official — provereno** |
| Vite CHANGELOG 5.4.x | https://github.com/vitejs/vite/blob/v5.4.14/packages/vite/CHANGELOG.md | Vite security/dev | 5.4.12+: `server.allowedHosts`, DNS rebinding fix; HMR WS token verify | **Official changelog — delimično provereno** (5.4.11–5.4.14 linija) |
| Vite — Server Options | https://vite.dev/config/server-options | Vite dev server | `allowedHosts`, `host`, `cors`, `fs.deny` — exposure i DNS rebinding rizik | **Official — provereno** |
| TypeScript — strict | https://www.typescriptlang.org/tsconfig#strict | TS | `strict: true` uključuje `strictNullChecks`, `noImplicitAny`, itd. | **Official — referencirano** |
| TypeScript — Narrowing | https://www.typescriptlang.org/docs/handbook/2/narrowing.html | TS | Guard pre upotrebe nullable/unknown vrednosti; discriminated unions za `msg.type` | **Official — referencirano** |
| TypeScript — Everyday Types (import type) | https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#import-types | TS | `import type` / type-only export — bez runtime importa | **Official — referencirano** |
| MDN — WebSocket | https://developer.mozilla.org/en-US/docs/Web/API/WebSocket | Browser WS | Native API lifecycle (open/message/close/error) | **Primary — referencirano** |
| MDN — WebSocket.close() | https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/close | Browser WS | Eksplicitno zatvaranje konekcije; cleanup u Effect return | **Primary — provereno** |
| OWASP — WebSocket Security | https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html | WS security | Untrusted messages, JSON.parse vs eval, input validation, WSS u prod | **Primary — provereno** |
| MDN — aria-live | https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live | a11y | Dinamički regioni: `polite` / `assertive` / `off` | **Primary — provereno** |
| W3C WCAG 2.1 — Contrast | https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html | a11y | Kontrast teksta (AA minimum) — relevantno za global CSS boje | **Primary — referencirano** |
| MDN — Performance.now() | https://developer.mozilla.org/en-US/docs/Web/API/Performance/now | Browser timing | Monotonic high-res timer; pogodan za elapsed/animation sync | **Primary — provereno** |
| OWASP — AJAX Security Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/AJAX_Security_Cheat_Sheet.html | Security | Ne oslanjati se na client logiku; ne slati tajne klijentu | **Primary — referencirano** |
| Solana Cookbook — Connect Wallet React | https://solana.com/developers/cookbook/wallets/connect-wallet-react | wallet-adapter | Provider pattern za React | **Primary — referencirano** |
| wallet-adapter APP.md | https://github.com/anza-xyz/wallet-adapter/blob/master/APP.md | wallet-adapter | ConnectionProvider → WalletProvider → UI | **Primary — referencirano** |
| Solana developers | https://solana.com/developers | web3.js | RPC, transakcije, devnet | **Official — referencirano** |
| Anchor — TypeScript client | https://www.anchor-lang.com/docs/clients/typescript | Anchor | Novi docs: `@anchor-lang/core`; naš stack: `@coral-xyz/anchor` 0.31.1 | **Official — delimično relevantno** |
| Anchor 0.31.1 release | https://github.com/coral-xyz/anchor/releases/tag/v0.31.1 | Anchor verzija | Patch: `proc-macro2` IDL build fix; naš pinned paket | **Official release — provereno** |
| `FRONTEND_BEST_PRACTICES.md` | repo | Project FE | Mapiranje izvora na fajlove | **Project doc** |
| `APCONFT_PROJECT_REFERENCE.md` | repo | Project facts | Env, WS poruke, flow | **Project doc** |
| `poker/src/protocol.ts`, `poker/server/hub.ts` | repo | WS contract | Oblik poruka | **Project contract** |

---

## 4. Dubinski research po oblastima

Za svaku oblast: **proverena dobra praksa** · **project-specific stanje** · **arhitekturne opcije / tradeoff-i** · **nepotvrđeno**.

### 4.1 React 18

**Proverena dobra praksa**

- **Rules of Hooks** — hook-ovi samo na top-level komponente/custom hook-ove ([Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)).
- **Effects za eksterne sisteme** — WebSocket, fetch IDL; uvek **cleanup** u return funkciji ([useEffect](https://react.dev/reference/react/useEffect), [Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)).
- **StrictMode** — u dev-u Effects se **pokreću dvaput** da otkriju missing cleanup; production nema double invoke ([StrictMode](https://react.dev/reference/react/StrictMode)).
- **Derived state vs Effect** — izračunavanja iz props/state u renderu ili `useMemo`, ne Effect ([You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)).
- **Event handlers vs Effects** — klik → transakcija/WS akcija; ne pokretati tx u Effect-u bez user intent-a.
- **Component composition** — orchestration parent + presentation children sa props/callback props; state “lift” samo kad je opravdano; JSX `children` smanjuje nepotrebne re-render-e ([memo — minimizing props](https://react.dev/reference/react/memo#minimizing-props-changes)).
- **Custom Hooks (official)** — enkapsulirati eksterni sistem (`usePokerWs`, `useVaultBalance`) sa jasnim return API-jem; deliti **stateful logiku**, ne shared state ([Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)).
- **Imenovanje Hook-ova** — `use` prefiks **samo** ako funkcija poziva druge Hook-ove; pure funkcija bez Hook-ova → obična funkcija (`formatPot`, ne `useFormatPot`).
- **Anti-pattern Hook-ovi** — generički “lifecycle” wrapperi (`useMount`, `useEffectOnce`) — React ih ne preporučuje; linter ne vidi dependency greške unutar wrapper-a.
- **`useMemo` (official)** — ne ubrzava **prvi** render; vredan kad je izračun spor, prop ide u `memo` child, ili je Hook dependency ([useMemo](https://react.dev/reference/react/useMemo)). Coarse UI (tabovi, cela sekcija) obično **ne treba** memo.
- **`useCallback` (official)** — cache funkcije između render-a; smislen uz `memo` child ili kao `useEffect` dependency ([useCallback](https://react.dev/reference/react/useCallback)). Nova inline funkcija u renderu **nije bug** sama po sebi.
- **`memo` (official)** — skip re-render kad su props shallow-equal; **ne svuda**; ako kod ne radi bez `memo`, prvo popraviti bug; profiler pre optimizacije ([memo](https://react.dev/reference/react/memo)).
- **Alternativa memo stack-u** — lokalni state, manje Effect lanaca, čista render logika, funkcija unutar Effect-a umesto memo deps.
- **Velike komponente** — anti-pattern: mešanje JSX, async orchestration, domain derivacija i WS u jednom fajlu bez granica; bezbedno razdvajanje **presentation** od **orchestration** ne menja ponašanje ako se wiring održi 1:1.

**Project-specific stanje**

- `main.tsx`: StrictMode uključen.
- `PokerPlay.tsx`: orchestration + composition child komponenti; `useMemo` za `raiseBounds`, `potDisplay`, itd.
- `ws.ts`: Effect otvara/zatvara WS; cleanup zatvara socket i pending.
- React **18.3.1** — prema [v18.3.0 release](https://github.com/facebook/react/releases/tag/v18.3.0): 18.2-compatible release sa dodatnim deprecation warning-ima za React 19 pripremu.

**Arhitekturne opcije / tradeoff-i**

- Orchestration hook (npr. `usePokerSeating`) — manji parent fajl vs veći rizik async/wallet flow-a; zahteva širu browser verifikaciju.
- `React.memo` na seat/table komponente — samo ako profiling pokaže problem; nije default.

**Nepotvrđeno official izvorom**

- Detaljan React **18.3.1** patch changelog (koristi se 18.3.0 release notes + general React 18 docs).
- `useMemo`/`useCallback` performanse u našim konkretnim komponentama (nije rađen profiling).

---

### 4.2 TypeScript

**Proverena dobra praksa**

- **`strict: true`** — uključuje `strictNullChecks`, `noImplicitAny`, itd. ([tsconfig strict](https://www.typescriptlang.org/tsconfig#strict)).
- **`strictNullChecks` / guard clauses** — nullable vrednosti (`wallet?.publicKey`, `idl | null`) moraju biti sužene pre upotrebe; early return u handlerima (`if (!wallet) return`) je i TS i clean-code pattern ([Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)).
- **Narrowing** — `typeof`, truthiness, discriminated union po `kind`/`type` polju — pogodno za WS `msg.type` grananje pre pristupa poljima ([Narrowing — discriminated unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions)).
- **`unknown` vs `any` / catch** — `unknown` zahteva sužavanje pre upotrebe; u `catch`: `e instanceof Error ? e.message : String(e)`. `any` isključuje provere i **ne** sme biti default za eksterni input ([Narrowing handbook](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)). Za JSON sa WS-a: parse → provera oblika → tek onda tip.
- **`import type` / type-only export** — tipovi bez runtime importa (npr. `PublicKey`, domain tipovi); manji bundle rizik i jasnija granica ([Everyday Types — import types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#import-types)).
- **Shared/public types** — centralizovati domain tipove (npr. iz `ws.ts`) umesto dupliranja interfejsa u više fajlova.
- **Tip ≠ runtime validacija** — TS ne štiti od lošeg JSON-a sa WS-a.
- **Anti-patterns:** `any`, `as` bez guard-a, `@ts-ignore` bez razloga, duplirani interfejsi sa divergentnim poljima.

**Project-specific stanje**

- `tsconfig.json`: `strict: true`; `noUnusedLocals: false` (unused simboli **ne** fail-uju build).
- `ws.ts`: runtime guard funkcije (`isValidServerNow`, `isValidClockAnchor`, …) pored TS tipova.
- Duplikati tipova (`SitRecoveryState`, `WinnerGroup`) mogu postojati u parent + child — **nije idealna praksa**, ali trenutno stanje.

**Arhitekturne opcije / tradeoff-i**

- Uključiti `noUnusedLocals: true` — bolja higijena, ali može zahtevati širi cleanup diff.
- Shared `types.ts` vs lokalni interface — DRY vs coupling.

**Nepotvrđeno official izvorom**

- TS **5.6.3** patch-level release notes za naše specifične compiler opcije.

---

### 4.3 Vite

**Proverena dobra praksa**

- **`VITE_*` prefiks** — samo te promenljive u klijent bundle-u ([Env guide](https://vite.dev/guide/env-and-mode)).
- **Env su stringovi** — eksplicitna numerička konverzija (`parseInt`, `parseFloat`).
- **Restart dev servera** posle `.env` izmene.
- **Bez tajni u `VITE_*`** — bundle exposure; usklađeno sa OWASP “never transmit secrets to client”.
- **Build** — `import.meta.env.*` statički zamenjen u production bundle-u (tree-shake friendly).
- **Dev server** — `host: true` izlaže LAN; u production deploy-u koristiti odgovarajući host/CORS/allowedHosts (Vite 5.4.12+ hardening — **pre oslanjanja proveriti stvarnu resolved verziju u lockfile-u / installed dependency**).
- **`server.allowedHosts` (official, Vite 5.4+)** — default `[]`; `localhost`, `.localhost` i IP adrese dozvoljene; **`true` je opasno** (DNS rebinding — source code exposure, GHSA-vg6x-rcgg-rjx6). Eksplicitna lista hostova koje kontrolišete ([Server Options — allowedHosts](https://vite.dev/config/server-options#server-allowedhosts)). Važi samo ako je instalirana verzija ≥ 5.4.12 (proveriti lockfile).
- **`server.cors` (official)** — default dozvoljava localhost origin; `cors: true` (bilo koji origin) **opasno** za dev server — isti rizik izlaganja koda ([Server Options — cors](https://vite.dev/config/server-options#server-cors)).
- **`server.fs.deny` (official)** — Vite dev server po defaultu blokira serviranje `.env`, `.env.*`, key/cert fajlova ([Server Options — fs.deny](https://vite.dev/config/server-options#server-fs-deny)). **Ne zamenjuje** pravilo da tajne ne idu u `VITE_*`.

**Project-specific stanje**

- `vite.config.ts`: port 5173, `host: true`, `global: 'globalThis'`, `buffer` alias.
- Env čitanje: `import.meta.env.VITE_*` sa fallback stringovima u kodu.
- Nema custom `server.allowedHosts` u config-u (default Vite ponašanje za naš lokalni dev).

**Arhitekturne opcije / tradeoff-i**

- Eksplicitno postaviti `server.allowedHosts` za shared dev/preview okruženja — security hardening vs lokalna fleksibilnost.
- `vite-env.d.ts` augmentacija za `ImportMetaEnv` — bolji IntelliSense; odvojena mala izmena tipova.

**Nepotvrđeno official izvorom**

- Pun diff **5.4.11 → 5.4.20** changelog entry-by-entry za naš tačan lockfile (pregledana 5.4.12–5.4.14 security linija u changelog-u, ne svaki patch).
- `@vitejs/plugin-react` **4.3.3** release notes.

**Napomena iz changelog-a (Vite 5.4.12+, official):** uvedeni `server.allowedHosts`, DNS rebinding zaštita, HMR WebSocket token verify — relevantno ako dev server izložen van localhost-a. **Pre oslanjanja na ove feature-e proveriti stvarnu resolved Vite verziju u lockfile-u / `node_modules`.**

---

### 4.4 WebSocket frontend

**Proverena dobra praksa**

- **Lifecycle** — `open` → handshake (`join`); `message` parse; `close`/`error` → UI offline + cleanup ([MDN WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)).
- **Eksplicitno zatvaranje** — `WebSocket.close()` u Effect cleanup-u; ako je već `CLOSED`, no-op ([MDN close()](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/close)).
- **Cleanup u Effect return** — `ws.close()`, clear pending, null ref (StrictMode-safe).
- **Message parsing** — `try/catch` oko `JSON.parse`; nevalidan payload → kontrolisana greška, ne crash. OWASP: uvek `JSON.parse`, **nikad** `eval` ([OWASP WS — Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html#input-validation)).
- **Discriminated handling** — grananje po `msg.type` pre upotrebe polja (paralela TS discriminated union + runtime guard).
- **Runtime validation** — za kritična numerička/polja (`serverNow`, deadline polja) pre UI countdown-a; OWASP: tretirati sve poruke kao **untrusted input** — struktura i tip polja moraju biti provereni pre UI logike.
- **Timeout na request/response** — sprečava beskonačno čekanje (`WS_TIMEOUT_MS`).
- **Single-flight pending** — jedan pending request u isto vreme smanjuje race stanja.
- **Warning spam zaštita** — ograničen `console.warn` (npr. ref po `showdownEndsAt`) umesto loga na svaku poruku; OWASP: ne logovati kompletan sadržaj poruka ni token-e.
- **Trust boundary** — server kontroliše `table` state; klijent ne veruje tipove kao validaciju; ne izvršava privilegovanu logiku na osnovu neproverenog JSON-a.
- **Transport (OWASP)** — produkcija: **`wss://`**, ne `ws://`; lokalni dev `ws://localhost` je dev okruženje, ne produkcioni pattern.
- **CSWSH / Origin (OWASP, server-side)** — Cross-Site WebSocket Hijacking se sprečava **origin validacijom na serveru**; FE ne može zameniti server proveru — relevantno za server-side hardening poker WS-a.
- **Reconnect/backoff** — validna arhitekturalna opcija; **nije fiksna preporuka** dok se eksplicitno ne definiše ponašanje i ne verifikuje u browseru.

**Project-specific stanje**

- `usePokerWs`: pattern gore; nema auto-reconnect.
- `onclose` → `clearPending`, `connected=false`.
- Invalid JSON → `setError('Bad server message')`.
- Validators: `isValidServerNow`, `isValidShowdownEndsAt`, `isValidClockAnchor`, …
- `invalidServerNowWarnedForEndsAtRef` — jednom warn po deadline-u.

**Arhitekturne opcije / tradeoff-i**

- Auto-reconnect + exponential backoff — UX vs složenost + server stanje.
- Split `ws.ts` na module — održivost vs regression rizik.
- Jača runtime schema validacija (npr. zod) — **zahteva dependency** → korisnička odluka.

**Nepotvrđeno official izvorom**

- Konkretna WS reconnect best practice za poker state sync (nema implementacije u kodu).
- Server-side stand pravila — backend domen.

---

### 4.5 Solana wallet / Vault UI

**Proverena dobra praksa**

- **Provider pattern** — `ConnectionProvider` → `WalletProvider` → `WalletModalProvider` ([Cookbook](https://solana.com/developers/cookbook/wallets/connect-wallet-react), [APP.md](https://github.com/anza-xyz/wallet-adapter/blob/master/APP.md)).
- **User-action-only transactions (project/security praksa)** — wallet potpis samo iz handlera na user klik, ne u Effect-u; oslanja se na React user-event pattern ([You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)) i security reasoning za naš vault flow — **nije** direktan citat jednog Solana official pravila.
- **Nikad private key/seed u UI** (OWASP AJAX cheat sheet). **PublicKey / wallet adresa** su javne — prikaz u UI (`shortPk`) je OK.
- **Tri različita balansa u UI (ne mešati u copy/logici):**
  - **SOL** — native token za transaction fee (wallet SOL balance).
  - **Wallet SPL** — chip/token u wallet ATA (pre deposit-a u vault).
  - **Vault kredit** — `userBalance` PDA / „Dostupno u vault-u" — izvor za buy-in max (`maxBuyIn = vaultChips`), ne direktno wallet SPL.
- **Public adrese OK** — `shortPk`, wallet button; nisu tajne.
- **RPC constraints** — rate limits, cluster mismatch (devnet/mainnet) moraju biti usklađeni frontend ↔ server ↔ on-chain.

**Project-specific stanje**

- `App.tsx`: Phantom, `autoConnect`, RPC iz `VITE_SOLANA_RPC`.
- `PokerPlay`: `handleSit` / `handleStand` — check → on-chain lock/release (ako nije skip) → WS.
- `VaultPlay`: deposit/withdraw preko Anchor helper-a.
- Skip-vault dev flag mora biti usklađen sa poker serverom.

**Arhitekturne opcije / tradeoff-i**

- Dodatni wallet adapteri osim Phantom-a.
- BFF za API tajne — root Express (`src/`) nije deo standardnog poker UI flow-a; Solana tx namerno idu kroz wallet potpis.

**Nepotvrđeno official izvorom**

- `@solana/wallet-adapter-react` **^0.15.35** patch changelog.
- `@solana/web3.js` **^1.95.8** changelog entry-by-entry.

---

### 4.6 Anchor TypeScript client

**Proverena dobra praksa**

- Koristiti **IDL + Program** API usklađen sa **stvarnom verzijom paketa** u projektu.
- **`@coral-xyz/anchor` 0.31.1** — patch release (2025-04-19): fix `proc-macro2` IDL build grešaka ([v0.31.1 release](https://github.com/coral-xyz/anchor/releases/tag/v0.31.1)); naš lockfile pinned na ovu verziju.
- Official novi docs ([TypeScript client](https://www.anchor-lang.com/docs/clients/typescript)) targetiraju `@anchor-lang/core` — **ne kopirati** importe/metode slepo.

**Project-specific stanje**

- `@coral-xyz/anchor` **0.31.1** pinned.
- IDL: `fetch('/idl/table_vault.json')` → `Idl` tip.
- Transakcije u `tableVault.ts` / `VaultPlay.tsx` — postojeći instruction/account redosled je **izvor istine**.

**Arhitekturne opcije / tradeoff-i**

- Migracija na `@anchor-lang/core` / web3.js v2 — veliki arhitekturalni scope; odvojena odluka od FE organizacije koda.

**Nepotvrđeno official izvorom**

- Kompletan migration guide `@coral-xyz/anchor` 0.31.1 → `@anchor-lang/core` za naš `table_vault` program.

**Šta ne sme slepo iz newer docs**

- Paket `@anchor-lang/core` umesto `@coral-xyz/anchor`.
- `Program` konstruktor/signatures iz novijih primera bez verifikacije protiv našeg IDL-a i lockfile-a.

---

### 4.7 CSS / UI organizacija

**Proverena dobra praksa (generalno, project-agnostic gde nema framework official izvora)**

- **Global CSS** — prihvatljiv za manje aplikacije sa jednim vizuelnim jezikom; skala i coupling rastu sa brojem ekrana.
- **CSS modules / Tailwind / split fajlovi** — arhitekturalna odluka, ne podrazumevani korak.
- **Responsive** — media queries za mobile; postojeći `@media (max-width: 540px)` u `index.css`.
- **`aria-live` (MDN, primary)** — dinamički regioni (showdown, status): `polite` = obavesti bez prekida; `assertive` = odmah (retko, samo hitno); `off` = ne najavljuj dok korisnik nije fokusiran ([aria-live](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live)).
- **Kontrast (W3C WCAG 2.1, primary)** — tekst mora imati dovoljan kontrast u odnosu na pozadinu (AA minimum za normalan tekst) — relevantno pri menjanju boja u global CSS ([Contrast Minimum](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)).
- **Accessibility osnove** — semantički HTML gde moguće; fokus/disabled na interaktivnim elementima; keyboard dostupnost za akcije (check/call/fold) — **nije** sistematski auditiran u repou.
- **Animacije** — ne smeju blokirati akcije ili odlažati prikaz rezultata na način koji menja poker flow; countdown/result mora ostati funkcionalan bez animacije (CSS `transition` ne sme biti jedini način da korisnik vidi rezultat).
- **CSS framework** — Tailwind/Bootstrap/shadcn uvodi dependency i arhitekturu — **samo** eksplicitna korisnička odluka; trenutni pattern je jedan globalni `index.css`.

**Project-specific stanje**

- Jedan `index.css`, BEM-like klase.
- Nema sistematskog a11y audit-a dokumentovanog u repou.
- Showdown/poker UI koristi CSS klase iz globalnog fajla.

**Arhitekturne opcije / tradeoff-i**

- Split CSS po feature-u, CSS modules, ili framework — eksplicitna arhitekturalna promena.
- Formalni a11y audit (axe, manual keyboard nav) — odvojena verifikaciona aktivnost.

**Nepotvrđeno official izvorom**

- WCAG compliance nivo za ceo poker UI (nije auditiran u ovom research-u).
- Optimalna CSS arhitektura za našu veličinu app-a (nema jedinstvenog official izvora).

---

### 4.8 Frontend clean code

**Proverena dobra praksa**

#### Struktura po fajlovima

- Jasna podela: **komponenta (UI + props)** · **hook (React state + Effect + eksterni sync)** · **helper (pure)** · **types/constants**.
- Jedna odgovornost po modulu; fajl ne raste bez razloga — ako raste, prvo identifikovati granicu (presentation vs orchestration vs pure logic).
- Feature folderi po domenu (`poker/`, `vault/`) — polaziti od postojeće domenske podele, ali ne propagirati loše pattern-e. Nova hijerarhija (`features/`, `shared/`) traži eksplicitnu odluku.

#### Kada izdvajati custom hook

Izdvojiti hook kada ([Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)):

- logika koristi **Hook-ove** (`useState`, `useEffect`, …) i treba je **deliti** između komponenti ili izolirati eksterni sistem (WS, vault read, countdown sync);
- ime hook-a jasno opisuje **namenu** (`usePokerWs`, `useVaultBalance`, eventualno `usePokerSeating`);
- hook enkapsulira **konkretan high-level use case**, ne generički lifecycle.

Primeri u našem kodu koji odgovaraju ovome: `usePokerWs`, `useVaultBalance`.

#### Kada **NE** izdvajati u hook

- **Pure/format/business logika** bez React state-a → **helper** (`pots.ts`, `showdown.ts`), ne `use*` ([Custom Hooks — should all functions use prefix?](https://react.dev/learn/reusing-logic-with-custom-hooks#should-all-functions-called-during-rendering-start-with-the-use-prefix)).
- Logika se koristi **samo na jednom mestu** i izdvajanje samo dodaje indirekciju (fajl + import + prop drilling) bez smanjenja kompleksnosti.
- **Presentation-only** JSX blok → komponenta sa props, ne hook (npr. `PokerHeroBar`, `PokerControlsPanel` — handlers ostaju u parentu).
- Generički Effect wrapperi (`useMount`, `useEffectOnce`) — anti-pattern (React docs).
- Ako ne možeš jasno imenovati hook (`useStuff`, `useLogic`) — verovatno nije spreman za ekstrakciju.
- Async orchestration sa wallet + WS + recovery — hook može smanjiti fajl, ali **povećava rizik regresije**; zahteva eksplicitnu odluku i širu browser verifikaciju.

#### Kada izdvajati helper

- Funkcija je **pure** (isti input → isti output, bez side-effect-a).
- Formatiranje prikaza (`potDisplay`, winner grouping, card labels).
- Domain izračunavanja korišćena u više komponenti ili testabilna van React-a.
- Helper može biti pozvan uslovno u renderu — unlike Hook-ovi.

#### Early return, tipizacija, imenovanje

- **Early return** u handlerima pre async/side-effect-a (`if (!connected) return`, `if (!wallet?.publicKey) return`) — smanjuje duboko grananje i pomaže TS narrowing.
- **Konkretni tipovi** — domain tipovi centralizovani (`ws.ts` export); izbegavati `any`; `unknown` + guard za eksterni input.
- **Opisna imena** — handleri `handle*`, callback props `on*`, boolean `is*`/`has*`/`can*` (`countdownReady`, `onPickSeat`); komponente `Poker*` prefix za poker UI.

#### Project-specific stanje vs dobra praksa

| Stanje u kodu | Dobra praksa | Propagirati dalje? |
|---------------|--------------|-------------------|
| `PokerPlay.tsx` orchestration + `useMemo` derivacije | Presentation komponente + hook za eksterne sisteme | Orchestration u parentu je validan pattern |
| Duplirani tipovi (`SitRecoveryState`, `WinnerGroup`) u parent + child | Shared `types.ts` ili re-export iz `ws.ts` | **Ne** — DRY je bolji dugoročno |
| `noUnusedLocals: false` | Striktnija TS higijena | **Ne** automatski — širi diff |
| Global `index.css` | OK za trenutnu skalu aplikacije | OK dok nema CSS arhitekturalne odluke |
| `useMemo` za `raiseBounds`, `potDisplay` | U skladu sa React derivacije guidance | **Da** |
| Runtime WS validators u `ws.ts` | Obavezno pored TS tipova | **Da** — tip ≠ runtime |

- Postojeći pattern **prvo razumeti** — loš pattern **ne propagirati** u nove fajlove (npr. dupliranje interfejsa).
- **Lokalni cleanup** — ukloniti suvišne importe/dead code u okviru konkretne izmene; izbegavati nesrodan „spring clean“.

**Project-specific stanje**

- Hookovi za WS i vault; helperi (`pots.ts`, `showdown.ts`, …).
- Presentation komponente (`PokerHeroBar`, `PokerControlsPanel`, …) sa handlerima/effect-ima u parentu — validan separation pattern.
- `PokerPlay` centralni orchestration fajl — stabilan pattern; veličina fajla može biti razlog za dalju organizaciju uz odluku.

**Arhitekturne opcije / tradeoff-i**

- Orchestration hook, ws split, shared types, CSS split — vidi §7.

**Nepotvrđeno official izvorom**

- Idealna maksimalna veličina fajla/komponente (nema React/Vite official broja — engineering judgment).

---

### 4.9 Verifikacija: build i browser

**Proverena dobra praksa (za naš repo)**

#### Šta `npm run build --prefix solana/web` proverava

- TypeScript compile (`strict: true` provere u build pipeline-u).
- Vite production bundle — import graph, tree-shaking, `import.meta.env` statička zamena.
- Očigledne broken import/export greške i većina type error-a.

#### Šta build ne proverava

- Runtime WebSocket handshake, reconnect, message flow, StrictMode double-mount edge cases u browseru.
- Phantom/wallet potpis, on-chain lock/release, vault deposit/withdraw.
- UI/UX: countdown timing, showdown overlay, seat selection, responsive layout na stvarnim uređajima.
- Accessibility (keyboard nav, screen reader, kontrast) — nema automated a11y u build-u.
- Multi-player E2E (dva Chrome profila, dva wallet-a).
- Server-side vault verifikacija i WS protokol usklađenost — to testira `poker/` server/engine, ne FE build.

#### Kada je manual browser test neophodan

- Bilo koja izmena koja dira **WS**, **wallet tx**, **countdown/showdown UI**, **sit/stand/buy-in**, ili **vault balance prikaz**.
- Presentation-only reorganizacija koda — build + ciljana browser provera wiring-a (props/handlers 1:1); pun 2-player vault E2E nije uvek obavezan za svaku izmenu, ali zavisi od obuhvata promene.
- Skip-vault dev path ≠ vault lock path — oba ne smeju se pretpostaviti bez eksplicitne browser verifikacije.

#### FE test framework — research opcije (ne odluka)

Ako se uvodi FE test stack, tipične opcije (svaka zahteva dependency + održavanje + **korisničku odluku**):

| Opcija | Oblast | Napomena za naš stack |
|--------|--------|------------------------|
| **Vitest** | unit/integration u Node | Pure helperi (`pots`, validators) — ne pokriva wallet/WS bez mock-a |
| **React Testing Library** | komponente u jsdom | Wallet/Anchor/WebSocket zahtevaju heavy mock; korisno za pure UI props wiring |
| **Playwright** | browser E2E | Jedini pristup bliži realnom Phantom + WS flow; sporiji, flaky rizik bez CI discipline |

**Nije provereno official izvorom** koji stack je optimalan za Solana wallet + native WS + Anchor u našem monorepo-u — zahteva dodatni targeted research pre uvođenja.

- **Ne tvrditi test coverage** bez konkretnog test fajla/loga.

**Project-specific stanje**

- Nema `test` skripte u `solana/web/package.json`.
- Poker engine/server testovi postoje u `poker/` — **ne** zamenjuju FE UI testove.
- Za FE promene: build + browser verifikacija relevantnih flow-ova (detalji u `FRONTEND_BEST_PRACTICES.md` / `AGENTS.md`).

**Arhitekturne opcije / tradeoff-i**

- Uvođenje bilo kog FE test framework-a — zahteva dependency, CI i održavanje; arhitekturalna odluka.

**Nepotvrđeno official izvorom**

- Benchmark Vitest vs Playwright za wallet E2E u 2026 ekosistemu (nije istraženo za naš repo).

---

### 4.10 Security / performance

**Proverena dobra praksa**

- **Trust boundaries** — browser (untrusted UI + user input) ↔ poker WS server (authoritative game state) ↔ Solana RPC/on-chain ↔ wallet signer (user-controlled keys). Klijent **ne drži** server tajne; wallet **ne izlaže** private key UI kodu.
- **No secrets in frontend** — OWASP AJAX/WS: ne slati tajne klijentu; Vite: `VITE_*` nije za secrets; RPC URL / program ID / mint su **javni** u dev/test kontekstu.
- **Runtime payload validation** — WS JSON guard + fail-safe (`Bad server message`, timeout clear); OWASP WS: sve poruke untrusted — `JSON.parse`, ne `eval`; validacija strukture pre UI logike.
- **Invalid input fail-safe** — nevalidan buy-in ne pokreće tx; `parseInt` + validacija pre WS/vault.
- **Transport** — produkcija: `wss://` (OWASP); lokalni `ws://localhost:3081` je dev pattern.
- **Client ne zamenjuje server auth** — CSWSH, origin check, message-level authorization su **server** odgovornost (OWASP WS cheat sheet).
- **CPU/memory** — izbegavati tight loop/polling bez backoff; `setTimeout` pending mora imati cleanup; countdown preko `performance.now()` anchor-a ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now)) — monotonic timer, pogodan za elapsed bez wall-clock drift u kratkim intervalima.
- **Developer warnings** — ograničiti ponavljane warn logove; ne logovati sensitive payload (private keys, pun WS body, tx secrets) — OWASP logging guidance.
- **Dev server exposure (Vite)** — `host: true` + default `allowedHosts` OK za lokalni LAN dev; **`allowedHosts: true` ili `cors: true` ne sme** u shared/devops okruženjima bez analize (DNS rebinding).

**Project-specific stanje**

- Env javne vrednosti (RPC, program id, mint) — **namerno public** u dev/test; nisu recovery phrases.
- WS validators + single pending + timeout.
- `console.warn` za invalid `serverNow` — throttled per `showdownEndsAt` ref.

**Arhitekturne opcije / tradeoff-i**

- Jača client-side schema validacija, CSP headers, SRI — odvojene security odluke van osnovne FE organizacije koda.

**Nepotvrđeno official izvorom**

- Formalni threat model za poker WS (nije dokumentovan u ovom research-u).
- Performance profiling pod load (nije rađen).

---

## 5. Dobri patterni u postojećem kodu

| Pattern | Gde | Zašto je dobar / prihvatljiv |
|---------|-----|------------------------------|
| Custom hook za WebSocket | `usePokerWs` | Eksterni sistem + cleanup + tipovi |
| Custom hook za vault read | `useVaultBalance` | Reuse, jasna granica |
| Wallet provider shell | `App.tsx` | Usklađeno sa wallet-adapter vodičima |
| Runtime WS validators | `ws.ts` | Fail-safe + countdown guard |
| Pending request + timeout | `ws.ts` | Sprečava hang UI |
| Throttled dev warn | `invalidServerNowWarnedForEndsAtRef` | Manje log spama |
| `useMemo` za derived state | `PokerPlay`, `VaultPlay` | React preporuka za derivacije |
| Early return u handlerima | sit/stand/vault | Guard pre async |
| `unknown` u catch | poker/vault | TS preporuka |
| Kontrolisan buy-in input | cifre + clamp | Invalid input ne ide u flow |
| Domain tipovi u `ws.ts` | poker tipovi | Jedan izvor za UI/hook |
| Polyfill pre SDK | `main.tsx` | Stabilan Solana init |
| Feature folderi | `poker/`, `vault/` | Razumljiva podela |
| busy/txMsg/err/loading UI | poker/vault | Korisnik vidi status |

---

## 6. Stabilnost ponašanja pri organizaciji koda

Reorganizacija koda (split komponenti, hook-ovi, helperi) **ne sme nenamerno promeniti** ponašanje aplikacije. Sledeće oblasti su stabilne granice frontend sistema:

| Oblast | Zašto je osetljiva | Izvor istine |
|--------|-------------------|--------------|
| WS message flow i parsing | Realtime poker state | `poker/ws.ts`, server `hub.ts`, `poker/src/protocol.ts` |
| Vault/wallet transaction flow | On-chain lock/release redosled | `tableVault.ts`, `VaultPlay.tsx`, handler redosled u `PokerPlay.tsx` |
| UI ponašanje i uslovi prikaza | disabled/enabled, countdown, overlay | aktivni JSX + postojeći guard-ovi (`countdownReady`, `ShowdownBar key`, …) |
| Public exports / API između fajlova | import graph, potpisi | exporti iz `ws.ts`, vault helpera, poker komponenti |
| Env handling | `VITE_*` vrednosti u bundle-u | `import.meta.env`, `.env` (restart servisa posle izmene) |
| Runtime validation guard-ovi | fail-safe na loš WS JSON | `isValidServerNow`, `isValidShowdownEndsAt`, pending timeout, … |
| Accessibility / status behavior | dinamički regioni, fokus | postojeći `aria-live`, disabled stanja na akcijama |
| Build / import graph | production bundle | `npm run build --prefix solana/web` |

**Osetljive tačke** (promena samo uz analizu ponašanja): `ShowdownBar key`, `countdownReady` guard, `RebuyGraceBar key`, buy-in max iz vault-a, skip-vault usklađenost frontend ↔ poker server.

Organizaciona promena (presentation split, premestanje helpera) mora zadržati isti wiring: `className`, `disabled`, callback props i redosled side-effect-a u handlerima.

---

## 7. Arhitekturne odluke i tradeoff-i

Organizacione promene treba da čuvaju isti wiring, isti handler redosled, iste runtime guard-ove i istu browser-verifikabilnu funkcionalnost.

Kada postoji više validnih arhitekturalnih opcija (orchestration hook, ws split, shared types, CSS arhitektura, env TS augmentacija, reconnect, FE test stack), dokumentovati opcije i tradeoff-e pre promene.

Nepotvrđen izvor ne sme se predstavljati kao činjenica — eksplicitno navesti „Nisam proverio official izvore za X“.

**Pomoćni project docs:** `FRONTEND_BEST_PRACTICES.md`, `APCONFT_AI_RULES.md`, `AGENTS.md`, `APCONFT_PROJECT_REFERENCE.md`.

---

## 8. Nepotvrđeno official izvorom

| Oblast | Status |
|--------|--------|
| React **18.3.1** patch notes (van 18.3.0 release summary) | Nije entry-by-entry provereno |
| Vite **5.4.11** pun changelog do latest 5.4.x patch | Delimično (5.4.12–5.4.14 security); ne svaki patch |
| `@vitejs/plugin-react` **^4.3.3** changelog | Nije provereno |
| `@solana/wallet-adapter-react` **^0.15.35** changelog | Nije provereno |
| `@solana/web3.js` **^1.95.8** changelog | Nije provereno |
| Migracija `@coral-xyz/anchor` → `@anchor-lang/core` | Nije istraženo za naš program |
| WS auto-reconnect / backoff strategija | Nije u kodu; nije fiksna preporuka ovog dokumenta |
| FE unit/e2e framework izbor | Nije istraženo |
| WCAG/a11y pun audit poker UI | Nije urađen — delimično referencirano (`aria-live` MDN, kontrast W3C); nema axe/manual audit (keyboard, focus order, sve komponente) |
| CSS arhitektura (ideal za našu skalu) | Nema official jedinstvenog izvora |
| Poker server stand/business rules | Backend domen |
| Performance profiling pod real load | Nije urađen |
| React `useMemo`/`memo` impact na naš UI | Nije profilisan |
| Optimalan FE test stack (Vitest/RTL/Playwright) za wallet+WS | Nije istraženo za naš monorepo |
| Poker server origin validation / CSWSH hardening | Server domen; OWASP dokumentovano, kod servera nije proveren u ovom research-u |
| TS `unknown` vs `any` — sve catch/granice u kodu | Official TS handbook; nije line-by-line audit svih catch blokova |

Ove oblasti zahtevaju dodatni targeted research pre nego što se koriste kao osnova za tehničku odluku. Potvrđeni zaključci dopunjavaju §3 i odgovarajuće §4 podsekcije.

---

## Održavanje

- Dodavati samo nove proverene zaključke.
- Ako se aktivni kod i dokument razlikuju, proveriti aktivni kod pre odluke.
- Zastarele stavke uklanjati samo kada su zamenjene novim proverenim zaključkom.
