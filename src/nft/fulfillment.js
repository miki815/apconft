import { ethers } from 'ethers'
import { config } from '../config.js'

const contractIface = new ethers.Interface([
  'function mint(address to, string tokenUri) returns (uint256)',
])

const transferIface = new ethers.Interface(['event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'])

/**
 * Mints NFT to buyer after ApcoPay confirms payment.
 * Configure RPC_URL, FULFILLER_PRIVATE_KEY, NFT_CONTRACT_ADDRESS.
 *
 * @param {string} nftRecipient
 * @param {string} [tokenUri]
 * @returns {Promise<{ txHash?: string, tokenId?: string, skippedReason?: string }>}
 */
export async function fulfillNftAfterPayment(nftRecipient, tokenUri = '') {
  const { rpcUrl, fulfillerPrivateKey, contractAddress } = config.nft
  if (!rpcUrl || !fulfillerPrivateKey || !contractAddress) {
    return { skippedReason: 'NFT env not configured (RPC_URL / FULFILLER_PRIVATE_KEY / NFT_CONTRACT_ADDRESS)' }
  }
  if (!ethers.isAddress(nftRecipient)) {
    return { skippedReason: `Invalid nftRecipient address: ${nftRecipient}` }
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const wallet = new ethers.Wallet(fulfillerPrivateKey, provider)
  const contract = new ethers.Contract(contractAddress, contractIface, wallet)

  const uri = tokenUri || ''
  const tx = await contract.mint(nftRecipient, uri)
  const receipt = await tx.wait()
  let tokenId
  for (const log of receipt?.logs || []) {
    try {
      const parsed = transferIface.parseLog(log)
      if (parsed?.name === 'Transfer' && parsed.args.from === ethers.ZeroAddress) {
        tokenId = parsed.args.tokenId.toString()
        break
      }
    } catch {
      /* not this log */
    }
  }
  return { txHash: receipt?.hash, tokenId }
}
