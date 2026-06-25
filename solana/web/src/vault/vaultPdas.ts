import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'

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

export function vaultConfigPda(programId: PublicKey, mint: PublicKey) {
  const [vaultConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from('config'), mint.toBuffer()],
    programId,
  )
  return vaultConfig
}

export function vaultPdas(programId: PublicKey, mint: PublicKey) {
  const vaultConfig = vaultConfigPda(programId, mint)
  const vaultToken = getAssociatedTokenAddressSync(mint, vaultConfig, true)
  return { vaultConfig, vaultToken }
}
