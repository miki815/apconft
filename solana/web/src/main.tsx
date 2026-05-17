/** Polyfills first — zavisnosti Solana SDK zahtevaju Buffer tokom init-a modula */
import './polyfills'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

const rootEl = document.getElementById('root')

function renderFatal(message: string) {
  if (!rootEl) return
  rootEl.innerHTML = `
    <div style="font-family:system-ui;padding:1.25rem;max-width:42rem;margin:auto;color:#721c24;background:#f8d7da;border-radius:8px;">
      <strong>Greška pri startu</strong>
      <pre style="white-space:pre-wrap;margin-top:0.75rem;font-size:13px;">${message}</pre>
    </div>`
}

try {
  if (!rootEl) {
    throw new Error('Nema elementa #root u index.html')
  }

  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
} catch (e: unknown) {
  console.error(e)
  renderFatal(e instanceof Error ? `${e.message}\n${e.stack || ''}` : String(e))
}
