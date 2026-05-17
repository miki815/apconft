import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
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
import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

describe("table_vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const idlPath = path.join(__dirname, "..", "target", "idl", "table_vault.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8")) as anchor.Idl;
  const program = new anchor.Program(idl, provider);

  const wallet = provider.wallet as anchor.Wallet;
  const payer = wallet.payer;

  const treasury = Keypair.generate();
  const feeBps = 100; // 1%

  let mint: PublicKey;
  let vaultConfig: PublicKey;
  let vaultToken: PublicKey;

  const depositAmount = BigInt(1_000_000); // 1.0 token @ 6 decimals

  before(async () => {
    mint = await createMint(provider.connection, payer, wallet.publicKey, null, 6);

    [vaultConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("config"), mint.toBuffer()],
      program.programId,
    );
    vaultToken = getAssociatedTokenAddressSync(mint, vaultConfig, true);

    const sig = await provider.connection.requestAirdrop(treasury.publicKey, 1e9);
    await provider.connection.confirmTransaction(sig, "confirmed");

    await program.methods
      .initialize(feeBps)
      .accounts({
        authority: wallet.publicKey,
        mint,
        treasury: treasury.publicKey,
        vaultConfig,
        vaultToken,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  });

  it("deposit then withdraw; fee goes to treasury", async () => {
    const userAta = getAssociatedTokenAddressSync(mint, wallet.publicKey);

    const createUserAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      userAta,
      wallet.publicKey,
      mint,
    );
    await provider.sendAndConfirm(new Transaction().add(createUserAtaIx));

    await mintTo(
      provider.connection,
      payer,
      mint,
      userAta,
      wallet.publicKey,
      Number(depositAmount),
    );

    const [userBalance] = PublicKey.findProgramAddressSync(
      [Buffer.from("balance"), wallet.publicKey.toBuffer(), mint.toBuffer()],
      program.programId,
    );

    await program.methods
      .deposit(new anchor.BN(depositAmount.toString()))
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
      .rpc();

    const treasuryAta = getAssociatedTokenAddressSync(mint, treasury.publicKey);
    const createTreasuryAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      treasuryAta,
      treasury.publicKey,
      mint,
    );
    await provider.sendAndConfirm(new Transaction().add(createTreasuryAtaIx));

    const withdrawAmount = BigInt(500_000);
    const fee = (withdrawAmount * BigInt(feeBps)) / 10000n;
    const net = withdrawAmount - fee;

    const userBefore = BigInt((await getAccount(provider.connection, userAta)).amount);
    const treasuryBefore = BigInt((await getAccount(provider.connection, treasuryAta)).amount);
    const vaultBefore = BigInt((await getAccount(provider.connection, vaultToken)).amount);

    await program.methods
      .withdraw(new anchor.BN(withdrawAmount.toString()))
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
      .rpc();

    const userAfter = BigInt((await getAccount(provider.connection, userAta)).amount);
    const treasuryAfter = BigInt((await getAccount(provider.connection, treasuryAta)).amount);
    const vaultAfter = BigInt((await getAccount(provider.connection, vaultToken)).amount);

    assert.equal(vaultBefore - vaultAfter, withdrawAmount);
    assert.equal(userAfter - userBefore, net);
    assert.equal(treasuryAfter - treasuryBefore, fee);
  });
});
