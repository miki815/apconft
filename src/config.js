import dotenv from 'dotenv'

dotenv.config()

function req(name) {
  const v = process.env[name]
  if (v === undefined || v === '') {
    throw new Error(`Missing required env: ${name}`)
  }
  return v
}

function opt(name, fallback = '') {
  const v = process.env[name]
  return v === undefined || v === '' ? fallback : v
}

export const config = {
  port: Number(opt('PORT', '3080')),
  apcopay: {
    clientId: req('APCOPAY_CLIENT_ID'),
    clientSecret: req('APCOPAY_CLIENT_SECRET'),
    signatureSecret: req('APCOPAY_SIGNATURE_SECRET_KEY'),
    baseUrl: opt('APCOPAY_BASE_URL', 'https://payments.apcopay.tech/merchanttools').replace(/\/$/, ''),
    redirectUrl: req('REDIRECT_URL'),
    callbackUrl: req('CALLBACK_URL'),
    isTest: opt('IS_TEST', 'true') === 'true',
  },
  nft: {
    rpcUrl: opt('RPC_URL', ''),
    fulfillerPrivateKey: opt('FULFILLER_PRIVATE_KEY', ''),
    contractAddress: opt('NFT_CONTRACT_ADDRESS', ''),
  },
  battle: {
    rpcUrl: opt('RPC_URL', ''),
    escrowAddress: opt('BATTLE_ESCROW_ADDRESS', ''),
    /** Must be the private key for the escrow contract operator address */
    operatorPrivateKey: opt('BATTLE_OPERATOR_PRIVATE_KEY', ''),
    /** Required on POST …/resolve (header X-Battle-Resolve-Secret) */
    resolveSecret: opt('BATTLE_RESOLVE_SECRET', ''),
  },
}
