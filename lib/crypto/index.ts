import crypto from 'crypto'

import { ethers } from 'ethers'

import usdtBEP20 from './abis/usdtBEP20.json'
import { getSetting } from '../settings'

export const quickNodeUrl = process.env.QUICK_NODE_URL || 'https://placeholder.com'

if (!process.env.QUICK_NODE_URL) {
  console.warn('QUICK_NODE_URL is not defined. Using placeholder.')
}

export const defaultTokenContractAddress =
  '0x1E4a5D07ad2cd6dF2D458aD732e4371f97129551'
export const defaultTokenSymbol = 'USDT'
export const defaultTokenName = 'Tether USD'
export const defaultTokenDecimals = 18

type Numberish = number | bigint

/**
 * helper function to remove 18 decimals from a number
 * @param number
 * @returns
 */
function removeDecimals(number: Numberish, decimals: number): number {
  return Number(number) / 10 ** decimals
}

export async function getTokenConfig(): Promise<{
  contractAddress: string
  symbol: string
  name: string
  decimals: number
}> {
  const tokenContractAddress =
    (await getSetting('TOKEN_CONTRACT_ADDRESS')) || defaultTokenContractAddress
  const tokenSymbol = (await getSetting('TOKEN_SYMBOL')) || defaultTokenSymbol
  const tokenName = (await getSetting('TOKEN_NAME')) || defaultTokenName
  const tokenDecimalsRaw =
    (await getSetting('TOKEN_DECIMALS')) || String(defaultTokenDecimals)
  const parsedDecimals = Number.parseInt(tokenDecimalsRaw, 10)

  return {
    contractAddress: tokenContractAddress,
    symbol: tokenSymbol,
    name: tokenName,
    decimals: Number.isFinite(parsedDecimals)
      ? parsedDecimals
      : defaultTokenDecimals,
  }
}

export async function getAccountBalances(privateKey: string): Promise<{
  ethBalance: number
  tokenBalance: number
  tokenSymbol: string
  usdtBalance: number
}> {
  const tokenConfig = await getTokenConfig()
  const provider = new ethers.JsonRpcProvider(quickNodeUrl)

  const wallet = new ethers.Wallet(privateKey)

  const walletSigner = wallet.connect(provider)

  const tokenContract = new ethers.Contract(
    tokenConfig.contractAddress,
    usdtBEP20,
    walletSigner,
  )

  const ethBalance = await provider.getBalance(wallet.address, 'latest')

  const tokenBalance = await tokenContract.balanceOf(wallet.address)
  const normalizedTokenBalance = removeDecimals(
    tokenBalance,
    tokenConfig.decimals,
  )

  return {
    ethBalance: removeDecimals(ethBalance, 18),
    tokenBalance: normalizedTokenBalance,
    tokenSymbol: tokenConfig.symbol,
    usdtBalance: normalizedTokenBalance,
  }
}

export function buildPrivateKey(): string {
  const id = crypto.randomBytes(32).toString('hex')
  const privateKey = `0x${id}`
  return privateKey
}

export function getAddressFromPrivateKey(privateKey: string): string {
  const wallet = new ethers.Wallet(privateKey)
  return wallet.address
}
