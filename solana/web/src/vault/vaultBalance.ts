import { AnchorProvider, BN, Idl, Program } from '@coral-xyz/anchor'
import type { Idl as AnchorIdl } from '@coral-xyz/anchor'
import { getMint } from '@solana/spl-token'
import type { Connection } from '@solana/web3.js'
import { PublicKey } from '@solana/web3.js'
import type { AnchorWallet } from '@solana/wallet-adapter-react'

export function userBalancePda(
  programId: PublicKey,
  user: PublicKey,
  mint: PublicKey,
) {
  const [userBalance] = PublicKey.findProgramAddressSync(
    [Buffer.from('balance'), user.toBuffer(), mint.toBuffer()],
    programId,
  )
  return userBalance
}

/** Whole chips available in table vault (after deposit). */
export async function fetchVaultChipBalance(
  connection: Connection,
  wallet: AnchorWallet,
  programId: PublicKey,
  mint: PublicKey,
  idl: Idl,
): Promise<number> {
  const provider = new AnchorProvider(
    connection,
    wallet,
    AnchorProvider.defaultOptions(),
  )
  const program = new Program(idl as AnchorIdl, provider)
  const ub = userBalancePda(programId, wallet.publicKey, mint)

  try {
    const row = await program.account.userBalance.fetch(ub)
    const amt = row.amount as BN
    const raw = typeof amt.toNumber === 'function' ? amt.toNumber() : Number(amt)
    const mintInfo = await getMint(connection, mint)
    return Math.floor(raw / 10 ** mintInfo.decimals)
  } catch {
    return 0
  }
}
