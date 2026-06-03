import { BorshInstructionCoder, type Idl } from '@coral-xyz/anchor'
import { getMint } from '@solana/spl-token'
import {
  Connection,
  PublicKey,
  type VersionedTransactionResponse,
} from '@solana/web3.js'
import { TABLE_VAULT_PROGRAM_ID } from './config.js'
import { loadVaultIdl } from './vaultBalance.js'

export type TableVaultIx = 'lock_for_table' | 'release_from_table'

export async function chipsToRaw(
  connection: Connection,
  mint: PublicKey,
  chips: number,
): Promise<bigint> {
  const mintInfo = await getMint(connection, mint)
  return BigInt(chips) * BigInt(10 ** mintInfo.decimals)
}

export async function verifyTableVaultTx(
  connection: Connection,
  signature: string,
  user: PublicKey,
  mint: PublicKey,
  instruction: TableVaultIx,
  expectedChips: number,
): Promise<string | null> {
  const idl = loadVaultIdl()
  if (!idl) return 'table_vault IDL not found — run: cd solana && anchor build'

  const tx = await connection.getTransaction(signature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  })
  if (!tx) return 'Transaction not found or not confirmed'
  if (tx.meta?.err) return 'Transaction failed on-chain'

  const expectedRaw = await chipsToRaw(connection, mint, expectedChips)
  const coder = new BorshInstructionCoder(idl)
  const accountKeys = tx.transaction.message.getAccountKeys({
    accountKeysFromLookups: tx.meta?.loadedAddresses,
  })

  const signers = new Set(
    accountKeys.staticAccountKeys
      .filter((_, i) => tx.transaction.message.isAccountSigner(i))
      .map((k) => k.toBase58()),
  )
  if (!signers.has(user.toBase58())) {
    return 'Transaction must be signed by your wallet'
  }

  const instructions = collectInstructions(tx)
  let matched = false

  for (const { programId, data, accountIndexes } of instructions) {
    if (!programId.equals(TABLE_VAULT_PROGRAM_ID)) continue

    const decoded = coder.decode(data)
    if (!decoded || decoded.name !== instruction) continue

    const amount = decoded.data.amount as { toString(): string }
    if (BigInt(amount.toString()) !== expectedRaw) continue

    const ixUser = accountKeys.get(accountIndexes[0])
    if (!ixUser?.equals(user)) continue

    matched = true
    break
  }

  if (!matched) {
    return `Transaction must include ${instruction} for ${expectedChips} chips`
  }

  return null
}

function collectInstructions(tx: VersionedTransactionResponse) {
  const message = tx.transaction.message
  const accountKeys = message.getAccountKeys({
    accountKeysFromLookups: tx.meta?.loadedAddresses,
  })
  const out: {
    programId: PublicKey
    data: Buffer
    accountIndexes: number[]
  }[] = []

  for (const ix of message.compiledInstructions) {
    out.push({
      programId: accountKeys.get(ix.programIdIndex)!,
      data: Buffer.from(ix.data),
      accountIndexes: [...ix.accountKeyIndexes],
    })
  }

  if (tx.meta?.innerInstructions) {
    for (const inner of tx.meta.innerInstructions) {
      for (const ix of inner.instructions) {
        if ('data' in ix && typeof ix.data === 'string') {
          out.push({
            programId: accountKeys.get(ix.programIdIndex)!,
            data: Buffer.from(ix.data, 'base64'),
            accountIndexes: [...ix.accounts],
          })
        }
      }
    }
  }

  return out
}
