import { AnchorProvider, BN, Idl, Program } from '@coral-xyz/anchor'
import { getMint } from '@solana/spl-token'
import type { Connection } from '@solana/web3.js'
import { PublicKey } from '@solana/web3.js'
import type { AnchorWallet } from '@solana/wallet-adapter-react'
import { userBalancePda, vaultConfigPda } from './vaultPdas'

async function chipsToRaw(
  connection: Connection,
  mint: PublicKey,
  chips: number,
): Promise<BN> {
  const mintInfo = await getMint(connection, mint)
  return new BN(chips).mul(new BN(10).pow(new BN(mintInfo.decimals)))
}

export async function lockForTable(
  connection: Connection,
  wallet: AnchorWallet,
  programId: PublicKey,
  mint: PublicKey,
  idl: Idl,
  chips: number,
): Promise<string> {
  const provider = new AnchorProvider(
    connection,
    wallet,
    AnchorProvider.defaultOptions(),
  )
  const program = new Program(idl, provider)
  const raw = await chipsToRaw(connection, mint, chips)

  return program.methods
    .lockForTable(raw)
    .accounts({
      user: wallet.publicKey,
      mint,
      vaultConfig: vaultConfigPda(programId, mint),
      userBalance: userBalancePda(programId, wallet.publicKey, mint),
    })
    .rpc()
}

export async function releaseFromTable(
  connection: Connection,
  wallet: AnchorWallet,
  programId: PublicKey,
  mint: PublicKey,
  idl: Idl,
  chips: number,
): Promise<string> {
  const provider = new AnchorProvider(
    connection,
    wallet,
    AnchorProvider.defaultOptions(),
  )
  const program = new Program(idl, provider)
  const raw = await chipsToRaw(connection, mint, chips)

  return program.methods
    .releaseFromTable(raw)
    .accounts({
      user: wallet.publicKey,
      mint,
      vaultConfig: vaultConfigPda(programId, mint),
      userBalance: userBalancePda(programId, wallet.publicKey, mint),
    })
    .rpc()
}
