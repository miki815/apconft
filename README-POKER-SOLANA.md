# ProofOfPoker — Poker & Solana

Texas Hold'em poker sa on-chain **table vault**-om na Solani. Igrači deponuju SPL tokene u vault, zaključavaju buy-in pri sedenju za sto, igraju preko WebSocket servera, a stanje stola se vodi off-chain.

## Arhitektura

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│  solana/web     │ ◄────────────────► │  poker/server    │
│  (React + Vite) │                    │  (Node + ws)     │
└────────┬────────┘                    └────────┬─────────┘
         │ Solana RPC                           │ verifikacija tx
         ▼                                      ▼
┌─────────────────────────────────────────────────────────┐
│  table_vault (Anchor program na devnet/localnet)        │
│  deposit · withdraw · lock_for_table · release_from_table │
└─────────────────────────────────────────────────────────┘
```

| Komponenta | Putanja | Port |
|------------|---------|------|
| Web UI | `solana/web/` | 5173 |
| Poker WS server | `poker/server/` | 3081 |
| Anchor program | `solana/programs/table-vault/` | — |

## Preduslovi

- **Node.js** 20+
- **Rust** + **Anchor** 0.31.1 (`avm install 0.31.1`)
- **Solana CLI** (`solana --version`)
- Wallet keypair: `~/.config/solana/id.json`
- Za devnet: SOL na wallet-u (`solana airdrop 2`)

Program mora biti deploy-ovan na cluster koji koristiš. Podrazumevani program ID:

`842JeffU95RE7xz8Bkdu2pQQ5GDNYhmKsQxusfeG9uzL`

## Instalacija

Iz root-a repozitorijuma:

```bash
cd solana && npm install && cd ..
cd solana/web && npm install && cd ../..
cd poker && npm install && cd ..
```

## 1. Build Solana programa

```bash
npm run solana:build
```

Kopiraj IDL u web frontend:

```bash
npm run solana:copy-idl-web
```

## 2. Deploy na devnet (prvi put)

```bash
cd solana
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
solana config set --url devnet
anchor deploy
cd ..
```

Ako program već postoji na devnet-u sa istim ID-jem, ovaj korak možeš preskočiti.

## 3. Vault setup (test mint + inicijalizacija)

Postavi RPC i pokreni `mint-setup` — kreira test SPL mint, inicijalizuje vault, mintuje tokene i deponuje 500 u vault:

```bash
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
npm run vault:mint-setup
```

Na kraju ispisuje snippet za `.env` fajlove. Sačuvaj **mint adresu**.

## 4. Konfiguracija (.env)

### `poker/.env`

```bash
cp poker/.env.example poker/.env
```

```env
POKER_WS_PORT=3081
SOLANA_RPC_URL=https://api.devnet.solana.com
POKER_TABLE_MINT=<mint iz mint-setup>
```

### `solana/web/.env`

```bash
cp solana/web/.env.example solana/web/.env
```

```env
VITE_SOLANA_RPC=https://api.devnet.solana.com
VITE_PROGRAM_ID=842JeffU95RE7xz8Bkdu2pQQ5GDNYhmKsQxusfeG9uzL
VITE_MINT=<isti mint kao POKER_TABLE_MINT>
VITE_POKER_WS_URL=ws://localhost:3081
```

**Važno:** `POKER_TABLE_MINT` i `VITE_MINT` moraju biti isti.

## 5. Pokretanje

Dva terminala iz root-a:

```bash
# Terminal 1 — poker WebSocket server
npm run poker:server

# Terminal 2 — web UI
npm run solana:web
```

Otvori http://localhost:5173

## Kako igrati

1. **Connect wallet** (Phantom) — wallet mora biti isti koji je koristio `mint-setup`, ili mintuj tokene drugom wallet-u:
   ```bash
   npm run vault:mint -- <MINT> 1000 <WALLET_PUBKEY>
   ```
2. Tab **Vault** — proveri balans; po potrebi **Deposit** u vault.
3. Tab **Poker** — izaberi sedište i buy-in, klikni **Sit** (on-chain `lock_for_table` tx).
4. Kada su bar dva igrača za stolom, pokreni ruku (**Start hand**).
5. Za izlazak: **Stand** (`release_from_table` tx).

Blindovi su podrazumevano **5 / 10** čipova. Sto ima do **6** sedišta.

## Brzi dev režim (bez on-chain provere)

Za testiranje samo poker logike, bez Solana transakcija:

**`poker/.env`:**
```env
POKER_SKIP_VAULT_CHECK=1
```

**`solana/web/.env`:**
```env
VITE_POKER_SKIP_VAULT_CHECK=1
```

Oba flag-a moraju biti uključena istovremeno.

## Testovi

```bash
# Poker engine + WS room logika
npm run poker:test

# Anchor program (table_vault)
npm run solana:test
```

## Vault CLI

Iz foldera `solana/` (posle `anchor build`):

```bash
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com

npm run vault -- mint-setup
npm run vault -- demo
npm run vault -- mint <MINT> <AMOUNT> [RECIPIENT]
npm run vault -- deposit <MINT> <AMOUNT_RAW>
npm run vault -- withdraw <MINT> <AMOUNT_RAW>
npm run vault -- init <MINT> <TREASURY> <FEE_BPS>
```

Env za CLI:

| Promenljiva | Opis |
|-------------|------|
| `ANCHOR_PROVIDER_URL` | RPC URL (default `http://127.0.0.1:8899`) |
| `ANCHOR_WALLET` | Putanja do keypair JSON-a |

## Struktura koda

```
poker/
  src/           # Poker engine (Hold'em, pot, hand eval)
  server/        # WebSocket hub + PokerRoom + vault tx verify

solana/
  programs/table-vault/   # Anchor program
  scripts/vault-play.ts     # CLI za vault
  tests/                    # Anchor testovi
  web/                      # React UI (Poker + Vault tabovi)
```

## Rešavanje problema

| Problem | Rešenje |
|---------|---------|
| `table_vault IDL not found` | `npm run solana:build && npm run solana:copy-idl-web` |
| `POKER_TABLE_MINT not set` | Postavi mint u `poker/.env` |
| Sit ne prolazi vault proveru | Proveri da je `SOLANA_RPC_URL` isti cluster; tx mora biti `lock_for_table` sa tačnim iznosom |
| Wallet nema tokene | `npm run vault:mint -- <MINT> 1000 <PUBKEY>` pa Deposit u Vault tabu |
| WS greška / nema konekcije | Poker server mora raditi na portu iz `VITE_POKER_WS_URL` |
| Program nije na chain-u | `cd solana && anchor deploy` na odgovarajućem cluster-u |

## Napomene

- Chipovi tokom ruke su **off-chain** na WS serveru; vault se koristi pri **sit** (lock) i **stand** (release).
- Za multiplayer test otvori dva browsera (ili incognito) sa različitim wallet-ima.
- ApcoPay / EVM / NFT deo monorepo-a je odvojen — vidi root `package.json` skripte `start`, `contracts:*`.
