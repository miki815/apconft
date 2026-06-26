---
name: Vault TX Reliability
overview: "Plan za branch `fix/poker-vault-tx-verify-retry`: rešava samo server-side `Transaction not found or not confirmed` timing tako što `verifyTableVaultTx()` ne odbija svež signature prerano. `Blockhash not found` i frontend/no-signature handling ostaju poseban task/MR."
todos:
  - id: server-retry
    content: Implementirati konkretan retry/backoff u `poker/server/vaultTx.ts` bez prihvatanja TX-a bez `getTransaction()` i postojećeg dekodiranja
    status: pending
  - id: vaulttx-tests
    content: Dodati izolovan `verifyTableVaultTx retry` blok u `poker/server/room.test.ts` jer ga postojeći `npm run poker:test` već pokreće
    status: pending
  - id: qa-evidence
    content: Sačuvati finalni plan i raw `npm run poker:test` log u `task-evidence/vault-tx-verify-retry/`
    status: pending
isProject: false
---

# Vault TX Verify Retry Plan

## Zaključak
Ovaj MR rešava samo `Transaction not found or not confirmed`.

Potvrđen flow u aktivnom kodu:

- Frontend dobije signature iz `lockForTable()` / `releaseFromTable()` i šalje ga serveru kao `lockTx` / `releaseTx`.
- `PokerRoom.sit()`, `addChips()` i `stand()` pozivaju `verifyTableVaultTx()`.
- `verifyTableVaultTx()` trenutno radi jedan `connection.getTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 })`.
- Ako RPC još ne vrati TX, funkcija odmah vraća `Transaction not found or not confirmed`.

Evidence iz `task-evidence/poker-vault-stack-alignment/` podržava `manual QA BLOCKED`, ne FAIL prethodnog `releasableStack` / `standAndWait` MR-a: blocker se dešava pre add-chips i stand dela.

## Ispravljen Scope Za Ovaj MR

### Dirati

- `poker/server/vaultTx.ts`: glavni fix, retry/backoff samo za `getTransaction()` null rezultat.
- `poker/server/room.test.ts`: izolovan `describe('verifyTableVaultTx retry')` blok za retry ponašanje. Ovo je namerna korekcija plana jer `poker/package.json` eksplicitno pokreće samo postojeće test fajlove, a package fajl se ne menja.
- `task-evidence/vault-tx-verify-retry/`: finalni plan i raw test log posle implementacije.

### Ne dirati

- `poker/server/room.ts`: nije potrebno; već koristi `verifyTableVaultTx()` za `sit`, `addChips` i `stand`.
- `poker/package.json`: ne menjati; zato retry test ide u postojeći `room.test.ts`.
- `solana/web/src/poker/PokerPlay.tsx`: samo potvrđuje flow/granicu scope-a.
- `solana/web/src/vault/tableVault.ts`: ne menjati u ovom MR-u.
- `solana/programs/`, Anchor program, `.env`, `.env.example`, `package.json`, lock fajlove, dependency-je.
- Mint/RPC/program ID vrednosti.
- Poker engine u `poker/src/`.
- WS message contract.

## Retry/Backoff Predlog

- Broj pokušaja: 4 ukupno.
- Delay: rastući backoff posle null rezultata: 500ms, 1000ms, 1500ms.
- Maksimalno dodatno čekanje: oko 3000ms pre finalnog error-a.
- Finalni error: ako je i četvrti pokušaj `null`, vratiti isti postojeći tekst `Transaction not found or not confirmed`.
- Bezbednost: retry ne šalje novu transakciju, proverava istu signature, a TX se i dalje prihvata tek kad `getTransaction()` vrati pun TX i postojeće provere prođu.

Za lokalni/devnet QA 3 sekunde je dovoljno konzervativan minimalni korak: pokriva kratko RPC/indexing kašnjenje bez zamrzavanja WS flow-a na 10+ sekundi i bez promene frontend timeout modela.

## `getSignatureStatuses()` Odluka

Ne uključiti u prvi MR.

Razlog:

- Status može biti koristan signal/dijagnostika, ali nije dovoljan za acceptance TX-a.
- Ovaj MR može ostati manji i sigurniji ako samo ponovi isti `getTransaction(...confirmed)` koji je već autoritativan input za postojeće dekodiranje.
- Ako kasnije treba bolja observability poruka, `getSignatureStatuses()` može biti dodat kao dijagnostika bez menjanja acceptance pravila.

## Test Plan

Automatski:

- Dodati izolovan `verifyTableVaultTx retry` blok u `poker/server/room.test.ts`.
- Pokrenuti `npm run poker:test`.
- Ne pokretati frontend build ako se frontend ne dira.

Test case 1: retry uspeva

- Mock/fake `Connection` čiji `getTransaction()` vrati `null`, zatim validan fake `VersionedTransactionResponse`.
- Validan fake TX mora proći postojeći decode path: signer je user, program id je `TABLE_VAULT_PROGRAM_ID`, instruction name je `lock_for_table` ili `release_from_table`, amount odgovara `expectedChips`.
- Napomena: aktivni `verifyTableVaultTx()` ne proverava eksplicitno da instruction mint account odgovara očekivanom `mint`; očekivani `mint` se koristi za `getMint()` / decimals pri računanju raw iznosa. Ovaj MR ne menja tu postojeću validacionu granicu.
- Očekivanje: `verifyTableVaultTx()` vrati `null`, a broj `getTransaction()` poziva je 2.

Test case 2: retry exhaustion

- Mock/fake `Connection` čiji `getTransaction()` vrati `null` za sva 4 pokušaja.
- Očekivanje: funkcija vrati `Transaction not found or not confirmed`.
- Očekivanje: broj `getTransaction()` poziva je 4.

Minimalan način bez velikog refactora:

- Ne menjati `room.ts`.
- Ne menjati `package.json`.
- Testirati kroz `verifyTableVaultTx()` sa fake `Connection` u postojećem `room.test.ts`.
- Za validan fake TX koristiti postojeći `BorshInstructionCoder` i realni IDL, a za `getMint()` fake `getAccountInfo()` sa SPL `MintLayout`/`MINT_SIZE` iz postojeće dependency. Bez novih dependency-ja. Fake mint služi za decimals/raw amount izračunavanje, ne za tvrdnju da `verifyTableVaultTx()` validira instruction mint account.

## Evidence

- Folder: `task-evidence/vault-tx-verify-retry/`.
- Plan: `task-evidence/vault-tx-verify-retry/vault-tx-verify-retry.plan.md`.
- Test log: `task-evidence/vault-tx-verify-retry/poker-test-pass.log` ili, posle poznatog output-a, `poker-test-pass-<tests>-of-<tests>.log`.
- Postojeći repo pattern koristi oba oblika, ali najčešći evidence logovi imaju `poker-test-pass-<N>-of-<N>.log`; broj ne izmišljati pre stvarnog output-a.

## Rizici

- Retry može dodati oko 3s latencije na stvarno nepostojeći ili neindeksiran TX.
- Fake TX test mora proveriti decode/amount/signature path, ne samo helper retry. Ne tvrditi da test pokriva instruction mint-account validaciju jer aktivni kod to ne proverava.
- Ako RPC vrati failed TX, postojeći `tx.meta?.err` mora i dalje vratiti `Transaction failed on-chain`.
- Ne postoji automatski Phantom/devnet E2E; manual QA ostaje potreban.

## Dupli Lock/Release Analiza

Server-side retry ne pravi dupli lock/release:

- Ne šalje se nova transakcija.
- Proverava se ista signature.
- `usedVaultTxSigs` u `room.ts` se troši tek posle uspešne `verifyTableVaultTx()` validacije.
- Ako verify ostane `null`/error, signature se ne consume-uje i korisnik može ponovo pokušati isti server request bez novog on-chain TX-a gde frontend već čuva release signature za stand retry.

## Van Scope-a / Drugi MR

- `Blockhash not found`: frontend/Phantom/Anchor/RPC send-simulation problem; moguće bez signature-a.
- Frontend error handling za no-signature/blockhash poruke u `PokerPlay.tsx`.
- Eksplicitni frontend `confirmTransaction()` posle Anchor `.rpc()`.
- `getSignatureStatuses()` dijagnostika ako se pokaže potrebna.
