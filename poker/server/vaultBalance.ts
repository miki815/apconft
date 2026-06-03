import { AnchorProvider, BN, Program } from '@coral-xyz/anchor'
import type { Idl } from '@coral-xyz/anchor'
import { getMint } from '@solana/spl-token'
import { Connection, PublicKey } from '@solana/web3.js'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TABLE_VAULT_PROGRAM_ID } from './config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let cachedIdl: Idl | null = null

export function loadVaultIdl(): Idl | null {
  if (cachedIdl) return cachedIdl
  const candidates = [
    path.join(__dirname, '../../solana/target/idl/table_vault.json'),
    path.join(process.cwd(), '../solana/target/idl/table_vault.json'),
    path.join(process.cwd(), 'solana/target/idl/table_vault.json'),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      cachedIdl = JSON.parse(fs.readFileSync(p, 'utf8')) as Idl
      return cachedIdl
    }
  }
  return null
}

function userBalancePda(
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

/** Vault chip balance for player (whole chips, same unit as poker buy-in). */
export async function fetchVaultChipBalance(
  connection: Connection,
  user: PublicKey,
  mint: PublicKey,
): Promise<number> {
  const idl = loadVaultIdl()
  if (!idl) {
    throw new Error(
      'table_vault IDL not found — run: cd solana && anchor build',
    )
  }

  const provider = new AnchorProvider(connection, readOnlyWallet(), {
    commitment: 'confirmed',
  })
  const program = new Program(idl, provider)
  const mintInfo = await getMint(connection, mint)
  const ub = userBalancePda(TABLE_VAULT_PROGRAM_ID, user, mint)

  try {
    const row = await program.account.userBalance.fetch(ub)
    const amt = row.amount as BN
    const raw = typeof amt.toNumber === 'function' ? amt.toNumber() : Number(amt)
    return Math.floor(raw / 10 ** mintInfo.decimals)
  } catch {
    return 0
  }
}

function readOnlyWallet() {
  return {
    publicKey: PublicKey.default,
    signTransaction: async <T>(tx: T): Promise<T> => tx,
    signAllTransactions: async <T>(txs: T[]): Promise<T[]> => txs,
  }
}
