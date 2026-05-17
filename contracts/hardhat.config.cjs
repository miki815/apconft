const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
require('@nomicfoundation/hardhat-toolbox')

const deployerKey = process.env.FULFILLER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY || ''
const rpcSepolia = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL || ''

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.20',
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  networks: {
    sepolia: {
      url: rpcSepolia,
      accounts: deployerKey ? [deployerKey] : [],
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
    },
  },
  // Single key = Etherscan API V2 (all chains including Sepolia). Per-network maps use deprecated V1.
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || '',
  },
}
