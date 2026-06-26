/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOLANA_RPC: string
  readonly VITE_PROGRAM_ID: string
  readonly VITE_MINT: string
  readonly VITE_POKER_WS_URL?: string
  readonly VITE_POKER_SKIP_VAULT_CHECK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
