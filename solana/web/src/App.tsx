import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react'
import {
  WalletModalProvider,
  WalletMultiButton,
} from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'
import { useMemo, useState, type ReactNode } from 'react'

import '@solana/wallet-adapter-react-ui/styles.css'
import { PokerPlay } from './poker/PokerPlay'
import { VaultPlay } from './vault/VaultPlay'

const DEFAULT_RPC =
  import.meta.env.VITE_SOLANA_RPC || 'https://api.devnet.solana.com'

type Tab = 'poker' | 'vault'

function endpointNetwork(): WalletAdapterNetwork {
  if (DEFAULT_RPC.includes('mainnet')) return WalletAdapterNetwork.Mainnet
  return WalletAdapterNetwork.Devnet
}

function RootProviders({ children }: { children: ReactNode }) {
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter({
        network: endpointNetwork(),
      }),
    ],
    [],
  )

  return (
    <ConnectionProvider endpoint={DEFAULT_RPC}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}

function AppShell() {
  const [tab, setTab] = useState<Tab>('poker')

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">
          <span className="app-logo">♠</span>
          <div>
            <h1 className="app-title">Apconft Table</h1>
            <p className="app-subtitle">Solana vault · Texas Hold&apos;em</p>
          </div>
        </div>
        <WalletMultiButton />
      </header>

      <nav className="app-tabs" aria-label="Glavna navigacija">
        <button
          type="button"
          className={`app-tab ${tab === 'poker' ? 'app-tab--active' : ''}`}
          onClick={() => setTab('poker')}
        >
          Poker
        </button>
        <button
          type="button"
          className={`app-tab ${tab === 'vault' ? 'app-tab--active' : ''}`}
          onClick={() => setTab('vault')}
        >
          Vault
        </button>
      </nav>

      <main className="app-main">
        {tab === 'poker' ? <PokerPlay /> : <VaultPlay />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <RootProviders>
      <AppShell />
    </RootProviders>
  )
}
