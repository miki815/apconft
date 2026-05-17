/**
 * CLI za table_vault: initialize | deposit | withdraw | demo
 *
 * Pokretanje iz foldera solana/ (mora postojati target/idl/table_vault.json → anchor build):
 *
 *   export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com   # ili http://127.0.0.1:8899
 *   npm run vault -- demo
 *
 *   npm run vault -- init <MINT_PUBKEY> <TREASURY_OWNER_PUBKEY> <FEE_BPS>
 *   npm run vault -- deposit <MINT_PUBKEY> <AMOUNT_RAW>
 *   npm run vault -- withdraw <MINT_PUBKEY> <AMOUNT_RAW>
 *
 * Opciono: ANCHOR_WALLET=/put/do/id.json
 */

import * as anchor from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  mintTo,
} from "@solana/spl-token";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

function usage(): never {
  console.error(`
Usage (from ./solana):
  npm run vault -- demo
  npm run vault -- init <mint> <treasury_owner_pubkey> <fee_bps>
  npm run vault -- deposit <mint> <amount_raw_u64>
  npm run vault -- withdraw <mint> <amount_raw_u64>

Env:
  ANCHOR_PROVIDER_URL   RPC (default http://127.0.0.1:8899)
  ANCHOR_WALLET         keypair json (default ~/.config/solana/id.json)
`)
  process.exit(1)
}

function loadWallet(): anchor.Wallet {
  const p =
    process.env.ANCHOR_WALLET ||
    path.join(process.env.HOME || "", ".config/solana/id.json")
  const secret = JSON.parse(fs.readFileSync(p, "utf8")) as number[]
  const kp = Keypair.fromSecretKey(Uint8Array.from(secret))
  return new anchor.Wallet(kp)
}

function loadConnection(): Connection {
  const url = process.env.ANCHOR_PROVIDER_URL || "http://127.0.0.1:8899"
  return new Connection(url, "confirmed")
}

function loadProgram(provider: anchor.AnchorProvider): anchor.Program {
  const idlPath = path.join(process.cwd(), "target", "idl", "table_vault.json")
  if (!fs.existsSync(idlPath)) {
    console.error("Nema IDL-a. Pokreni: anchor build")
    process.exit(1)
  }
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8")) as anchor.Idl
  return new anchor.Program(idl, provider)
}

function vaultPdas(programId: PublicKey, mint: PublicKey) {
  const [vaultConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("config"), mint.toBuffer()],
    programId,
  )
  const vaultToken = getAssociatedTokenAddressSync(mint, vaultConfig, true)
  return { vaultConfig, vaultToken }
}

function userBalancePda(programId: PublicKey, user: PublicKey, mint: PublicKey) {
  const [userBalance] = PublicKey.findProgramAddressSync(
    [Buffer.from("balance"), user.toBuffer(), mint.toBuffer()],
    programId,
  )
  return userBalance
}

async function ensureAta(
  provider: anchor.AnchorProvider,
  payer: Keypair,
  owner: PublicKey,
  mint: PublicKey,
): Promise<PublicKey> {
  const ata = getAssociatedTokenAddressSync(mint, owner)
  const ix = createAssociatedTokenAccountIdempotentInstruction(
    payer.publicKey,
    ata,
    owner,
    mint,
  )
  await provider.sendAndConfirm(new Transaction().add(ix))
  return ata
}

async function cmdInit(
  provider: anchor.AnchorProvider,
  program: anchor.Program,
  mintStr: string,
  treasuryStr: string,
  feeBps: number,
) {
  const mint = new PublicKey(mintStr)
  const treasury = new PublicKey(treasuryStr)
  const wallet = provider.wallet as anchor.Wallet
  const { vaultConfig, vaultToken } = vaultPdas(program.programId, mint)

  const sig = await program.methods
    .initialize(feeBps)
    .accounts({
      authority: wallet.publicKey,
      mint,
      treasury,
      vaultConfig,
      vaultToken,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc()
  console.log("initialize tx:", sig)
}

async function cmdDeposit(
  provider: anchor.AnchorProvider,
  program: anchor.Program,
  mintStr: string,
  amountStr: string,
) {
  const mint = new PublicKey(mintStr)
  const amount = new anchor.BN(amountStr)
  const wallet = provider.wallet as anchor.Wallet
  const payer = wallet.payer
  const { vaultConfig, vaultToken } = vaultPdas(program.programId, mint)
  const userAta = await ensureAta(provider, payer, wallet.publicKey, mint)
  const userBalance = userBalancePda(program.programId, wallet.publicKey, mint)

  const sig = await program.methods
    .deposit(amount)
    .accounts({
      user: wallet.publicKey,
      mint,
      vaultConfig,
      vaultToken,
      userToken: userAta,
      userBalance,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc()
  console.log("deposit tx:", sig)
}

async function cmdWithdraw(
  provider: anchor.AnchorProvider,
  program: anchor.Program,
  mintStr: string,
  amountStr: string,
) {
  const mint = new PublicKey(mintStr)
  const amount = new anchor.BN(amountStr)
  const wallet = provider.wallet as anchor.Wallet
  const payer = wallet.payer

  const cfgAcc = await program.account.vaultConfig.fetch(
    vaultPdas(program.programId, mint).vaultConfig,
  )
  const treasuryOwner = cfgAcc.treasury as PublicKey

  const { vaultConfig, vaultToken } = vaultPdas(program.programId, mint)
  const userAta = getAssociatedTokenAddressSync(mint, wallet.publicKey)
  const userBalance = userBalancePda(program.programId, wallet.publicKey, mint)
  const treasuryAta = await ensureAta(provider, payer, treasuryOwner, mint)

  const sig = await program.methods
    .withdraw(amount)
    .accounts({
      user: wallet.publicKey,
      mint,
      vaultConfig,
      vaultToken,
      userToken: userAta,
      userBalance,
      treasuryToken: treasuryAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc()
  console.log("withdraw tx:", sig)
}

async function cmdDemo(provider: anchor.AnchorProvider, program: anchor.Program) {
  const wallet = provider.wallet as anchor.Wallet
  const payer = wallet.payer

  console.log("Wallet:", wallet.publicKey.toBase58())
  const mint = await createMint(provider.connection, payer, wallet.publicKey, null, 6)
  console.log("Test mint (6 decimals):", mint.toBase58())

  const treasury = wallet.publicKey
  const feeBps = 100 // 1%
  await cmdInit(provider, program, mint.toBase58(), treasury.toBase58(), feeBps)

  const userAta = await ensureAta(provider, payer, wallet.publicKey, mint)
  await mintTo(provider.connection, payer, mint, userAta, wallet.publicKey, 10_000_000)
  console.log("Minted 10.0 tokens to user ATA")

  await cmdDeposit(provider, program, mint.toBase58(), "5000000")
  console.log("Deposited 5.0")

  const { vaultToken } = vaultPdas(program.programId, mint)
  const v = await getAccount(provider.connection, vaultToken)
  console.log("Vault balance after deposit:", v.amount.toString())

  await cmdWithdraw(provider, program, mint.toBase58(), "2000000")
  console.log("Withdrew 2.0 (fee 1% → treasury / user split)")

  const userBal = await getAccount(provider.connection, userAta)
  const vaultAfter = await getAccount(provider.connection, vaultToken)
  const treasuryAta = getAssociatedTokenAddressSync(mint, treasury)
  const tr = await getAccount(provider.connection, treasuryAta)
  console.log("User ATA amount:", userBal.amount.toString())
  console.log("Vault amount:", vaultAfter.amount.toString())
  console.log("Treasury ATA (fee) amount:", tr.amount.toString())
  console.log("\nZa ručne korake dalje koristi isti mint:", mint.toBase58())
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.length === 0) usage()

  const wallet = loadWallet()
  const connection = loadConnection()
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  })
  anchor.setProvider(provider)
  const program = loadProgram(provider)

  const cmd = argv[0]
  if (cmd === "demo") {
    await cmdDemo(provider, program)
    return
  }
  if (cmd === "init") {
    if (argv.length < 4) usage()
    await cmdInit(provider, program, argv[1], argv[2], parseInt(argv[3], 10))
    return
  }
  if (cmd === "deposit") {
    if (argv.length < 3) usage()
    await cmdDeposit(provider, program, argv[1], argv[2])
    return
  }
  if (cmd === "withdraw") {
    if (argv.length < 3) usage()
    await cmdWithdraw(provider, program, argv[1], argv[2])
    return
  }
  usage()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
