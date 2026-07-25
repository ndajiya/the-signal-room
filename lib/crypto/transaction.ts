import { ethers } from 'ethers'

import { getTokenBalanceByAddress, getTokenConfig, quickNodeUrl } from '.'
import usdtBEP20 from './abis/usdtBEP20.json'

import {
  User,
  getAddressByPhoneNumber,
  getAddressByUserId,
  getUserFromId,
  getUserFromPhoneNumber,
} from '../user'
import { supabase } from '../../lib/supabase'

type Status =
  | 'ADDRESS_PENDING'
  | 'AMOUNT_PENDING'
  | 'PIN_PENDING'
  | 'BALANCE_PENDING'
  | 'REGISTRATION_PENDING'
  | 'LINKEDIN_PENDING'
  | 'LINKEDIN_CHOICE_PENDING'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'ERROR'

export type PaymentRequest = {
  id: string
  createdAt: string
  fromUserId: string
  to: string // address
  toUserId: string
  status: Status
  amount: number | null
}

export type Address = string
export type PhoneNumber = string

export async function getPendingPaymentRequest(
  userId: string,
): Promise<PaymentRequest | null> {
  const { data, error } = await supabase
    .from('payment_requests')
    .select('*')
    .eq('from_user_id', userId)
    .not('status', 'in', '["CONFIRMED","CANCELLED","ERROR"]')
    .order('created_at', { ascending: false })
    .limit(1)

  if (error || !data || data.length === 0) {
    return null
  }

  const { id, created_at, from_user_id, status, amount, to_user_id, to } =
    data[0]

  return {
    id,
    createdAt: created_at,
    fromUserId: from_user_id,
    toUserId: to_user_id,
    status: status as Status,
    to,
    amount,
  }
}

export async function isUserAwaitingPinInput(userId: string) {
  const pr = await getPendingPaymentRequest(userId)
  return pr?.status === 'PIN_PENDING'
}

export async function setPaymentRequestToPinPending({
  userId,
  amount,
}: {
  userId: string
  amount: number
}) {
  await supabase
    .from('payment_requests')
    .update({
      amount,
      status: 'PIN_PENDING',
    })
    .eq('from_user_id', userId)
    .eq('status', 'AMOUNT_PENDING')
}

export async function isUserAwaitingBalancePinInput(userId: string) {
  const pr = await getPendingPaymentRequest(userId)
  return pr?.status === 'BALANCE_PENDING'
}

export async function isUserAwaitingLinkedinInput(userId: string) {
  const pr = await getPendingPaymentRequest(userId)
  return pr?.status === 'LINKEDIN_PENDING'
}

export async function isUserAwaitingLinkedinChoice(userId: string) {
  const pr = await getPendingPaymentRequest(userId)
  return pr?.status === 'LINKEDIN_CHOICE_PENDING'
}

export async function setPaymentRequestToLinkedinChoicePending(userId: string) {
  await makePaymentRequest({
    amount: null,
    fromUserId: userId,
    to: 'LINKEDIN_CHOICE',
  })

  await supabase
    .from('payment_requests')
    .update({
      status: 'LINKEDIN_CHOICE_PENDING',
    })
    .eq('from_user_id', userId)
    .eq('status', 'ADDRESS_PENDING')
    .eq('to', 'LINKEDIN_CHOICE')
}

export async function setPaymentRequestToLinkedinPending(userId: string) {
  await makePaymentRequest({
    amount: null,
    fromUserId: userId,
    to: 'LINKEDIN_LINK',
  })

  await supabase
    .from('payment_requests')
    .update({
      status: 'LINKEDIN_PENDING',
    })
    .eq('from_user_id', userId)
    .eq('status', 'ADDRESS_PENDING')
    .eq('to', 'LINKEDIN_LINK')
}

export async function setRegistrationPending(phoneNumber: string) {
  await supabase.from('payment_requests').insert({
    status: 'REGISTRATION_PENDING',
    to: phoneNumber,
    from_user_id: null, // No user yet
  })
}

export async function isRegistrationPending(phoneNumber: string) {
  const { data } = await supabase
    .from('payment_requests')
    .select('*')
    .eq('to', phoneNumber)
    .eq('status', 'REGISTRATION_PENDING')
    .limit(1)

  return data && data.length > 0
}

export async function clearRegistrationPending(phoneNumber: string) {
  await supabase
    .from('payment_requests')
    .delete()
    .eq('to', phoneNumber)
    .eq('status', 'REGISTRATION_PENDING')
}

export async function setPaymentRequestToBalancePending(userId: string) {
  await makePaymentRequest({
    amount: null,
    fromUserId: userId,
    to: 'BALANCE_CHECK',
  })

  await supabase
    .from('payment_requests')
    .update({
      status: 'BALANCE_PENDING',
    })
    .eq('from_user_id', userId)
    .eq('status', 'ADDRESS_PENDING')
    .eq('to', 'BALANCE_CHECK')
}

export async function makePaymentRequest({
  fromUserId,
  to,
  amount,
}: {
  fromUserId: string
  to: Address | PhoneNumber | null
  amount: number | null
}): Promise<PaymentRequest> {
  // Validate user has enough balance if amount is provided
  if (amount !== null && amount > 0) {
    try {
      const userAddress = await getAddressByUserId(fromUserId)
      const balance = await getTokenBalanceByAddress(userAddress)
      
      if (balance < amount) {
        throw new Error(`Insufficient balance. Your balance is ${balance}, but you tried to send ${amount}.`)
      }
    } catch (error) {
      // If balance check fails (e.g. network error), we might still want to allow the request
      // but here we'll rethrow to be safe
      console.error('Balance validation error:', error)
      throw error
    }
  }

  const paymentRequest = (await supabase.from('payment_requests').insert({
    status: 'ADDRESS_PENDING',
    amount,
    from_user_id: fromUserId,
    to: to,
  })) as unknown as PaymentRequest

  return paymentRequest
}

export async function sendUsdtFromWallet({
  tokenAmount,
  toAddress,
  privateKey,
  isSponsored = false,
}: {
  tokenAmount: number
  toAddress: string
  privateKey: string
  isSponsored?: boolean
}) {
  try {
    const tokenConfig = await getTokenConfig()
    const provider = new ethers.JsonRpcProvider(quickNodeUrl)
    const wallet = new ethers.Wallet(privateKey, provider)
    const walletSigner = wallet.connect(provider)

    // Sponsorship Logic (Simplified Paymaster)
    if (isSponsored) {
      const sponsorPrivateKey = process.env.SPONSOR_PRIVATE_KEY
      if (sponsorPrivateKey) {
        const sponsorWallet = new ethers.Wallet(sponsorPrivateKey, provider)
        const balance = await provider.getBalance(wallet.address)
        const gasPrice = (await provider.getFeeData()).gasPrice || ethers.parseUnits('30', 'gwei')
        
        // If user has less than 0.005 ETH, top them up from sponsor
        if (balance < ethers.parseEther('0.005')) {
          console.log(`Sponsoring gas for ${wallet.address}`)
          const tx = await sponsorWallet.sendTransaction({
            to: wallet.address,
            value: ethers.parseEther('0.005'),
            gasPrice
          })
          await tx.wait()
        }
      }
    }

    // general token send
    const contract = new ethers.Contract(
      tokenConfig.contractAddress,
      usdtBEP20,
      walletSigner,
    )

    // How many tokens?
    const numberOfTokens = ethers.parseUnits(
      String(tokenAmount),
      tokenConfig.decimals,
    )

    // Send tokens
    const transferResult = await contract.transfer(toAddress, numberOfTokens)
    return transferResult
  } catch (error) {
    const isInsufficientFunds = (error as Error).message.includes(
      'transfer amount exceeds balance',
    )

    if (isInsufficientFunds) {
      throw new Error('insufficient funds for gas')
    }

    const isInsufficientGas = (error as Error).message.includes(
      'insufficient funds for gas',
    )

    if (isInsufficientGas) {
      throw new Error("You don't have enough ETH to pay for gas")
    }

    throw error
  }
}

export async function getUserPaymentRequests(
  userId: string,
): Promise<PaymentRequest[]> {
  const { data, error } = await supabase
    .from('payment_requests')
    .select('*')
    .eq('from_user_id', userId)

  if (error) {
    throw new Error('Error getting user payment requests')
  }

  return data.map(
    ({ id, created_at, from_user_id, status, amount, to_user_id, to }) => ({
      id,
      createdAt: created_at,
      fromUserId: from_user_id,
      toUserId: to_user_id,
      status,
      to,
      amount,
    }),
  )
}

export async function isReceiverInputPending(userId: string) {
  const paymentRequests = await getUserPaymentRequests(userId)

  return paymentRequests.some(
    (paymentRequest) => paymentRequest.status === 'ADDRESS_PENDING',
  )
}

export async function getRecipientAddressFromUncompletedPaymentRequest(
  userId: string,
): Promise<string> {
  const paymentRequests = await getUserPaymentRequests(userId)

  const pendingPaymentRequest = paymentRequests.find(
    (paymentRequest) => paymentRequest.status === 'AMOUNT_PENDING',
  )

  if (!pendingPaymentRequest) {
    throw new Error('No pending payment requests found')
  }

  return pendingPaymentRequest.to
}

export async function getReceiverUserFromUncompletedPaymentRequest(
  userId: string,
): Promise<User | null> {
  const paymentRequests = await getUserPaymentRequests(userId)

  const pendingPaymentRequest = paymentRequests.find(
    (paymentRequest) => paymentRequest.status === 'AMOUNT_PENDING',
  )

  if (!pendingPaymentRequest) {
    throw new Error('No pending payment requests found')
  }

  const { toUserId } = pendingPaymentRequest

  if (!toUserId) {
    return null
  }

  return getUserFromId(toUserId)
}

export async function isUserAwaitingAmountInput(userId: string) {
  const paymentRequests = await getUserPaymentRequests(userId)

  return paymentRequests.some(
    (paymentRequest) => paymentRequest.status === 'AMOUNT_PENDING',
  )
}

export async function addReceiverToPayment({
  userId,
  receiver,
}: {
  userId: string
  receiver: string
}) {
  const isAddress = ethers.isAddress(receiver)
  const receiverUser = await getUserFromPhoneNumber(receiver)
  if (!isAddress && !receiverUser) {
    throw new Error(
      `Invalid remitent, must be a valid address or phone number of a registered user ${JSON.stringify(
        receiver,
      )}`,
    )
  }

  const receiverAddress = isAddress
    ? receiver
    : await getAddressByPhoneNumber(receiver)

  await supabase
    .from('payment_requests')
    .update({
      to: receiverAddress,
      to_user_id: receiverUser?.id || null,
      status: 'AMOUNT_PENDING',
    })
    .eq('from_user_id', userId)
    .eq('status', 'ADDRESS_PENDING')

  return receiverUser?.name || receiver
}

export async function confirmPaymentRequest({
  userId,
  amount,
}: {
  userId: string
  amount: number
}) {
  await supabase
    .from('payment_requests')
    .update({
      amount,
      status: 'CONFIRMED',
    })
    .eq('from_user_id', userId)
    .eq('status', 'AMOUNT_PENDING')
}

export async function cancelPaymentRequest(userId: string) {
  await supabase
    .from('payment_requests')
    .update({
      status: 'CANCELLED',
    })
    .eq('from_user_id', userId)
    .neq('status', 'CONFIRMED')
    .neq('status', 'CANCELLED')
    .neq('status', 'ERROR')
}
export function getPolygonScanUrlForAddress(address: string) {
  return `https://zkevm.polygonscan.com/address/${address}`
}

export async function updatePaymentRequestToError(userId: string) {
  await supabase
    .from('payment_requests')
    .update({
      status: 'ERROR',
    })
    .eq('from_user_id', userId)
    .eq('status', 'AMOUNT_PENDING')
}
