import type { VercelApiHandler, VercelRequest, VercelResponse } from '@vercel/node'
import {
  answerTelegramCallback,
  getTelegramWebhookSecret,
  isTelegramOwner,
  sendTelegramMessage,
  telegramOwnerMenu,
} from '../../lib/telegram'
import { isMessagingPlatformActive } from '../../lib/settings'
import { getLatestCandidate, processInstagramLink, updateDraftStatus } from '../../lib/viral-radar'
import {
  createUser,
  getAddressByUserId,
  getPrivateKeyByPhoneNumber,
  getUserFromTelegramChatId,
  linkLinkedinUrn,
  setVerificationCode,
} from '../../lib/user'
import { getAccountBalances } from '../../lib/crypto'
import {
  addReceiverToPayment,
  cancelPaymentRequest,
  confirmPaymentRequest,
  getPendingPaymentRequest,
  getPolygonScanUrlForAddress,
  getReceiverUserFromUncompletedPaymentRequest,
  getRecipientAddressFromUncompletedPaymentRequest,
  isReceiverInputPending,
  isRegistrationPending,
  isUserAwaitingAmountInput,
  isUserAwaitingBalancePinInput,
  isUserAwaitingLinkedinChoice,
  isUserAwaitingLinkedinInput,
  isUserAwaitingPinInput,
  makePaymentRequest,
  sendUsdtFromWallet,
  setPaymentRequestToBalancePending,
  setPaymentRequestToLinkedinChoicePending,
  setPaymentRequestToLinkedinPending,
  setPaymentRequestToPinPending,
  setRegistrationPending,
  clearRegistrationPending,
  updatePaymentRequestToError,
} from '../../lib/crypto/transaction'
import { transformStringToNumber } from '../../lib/utils/number'

type TelegramMessage = {
  chat: { id: number }
  text?: string
}

type TelegramUpdate = {
  message?: TelegramMessage
  callback_query?: {
    id: string
    data?: string
    message?: TelegramMessage
  }
}

const instagramRegex = /https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[a-zA-Z0-9_-]+\/?/

async function sendMenu(chatId: number) {
  await sendTelegramMessage(
    chatId,
    'Signal Room owner controls\n\nSend an Instagram post or Reel URL to run Viral Radar.',
    telegramOwnerMenu(),
  )
}

async function handleOwnerText(chatId: number, text: string) {
  const body = text.trim()
  const upperBody = body.toUpperCase()

  if (upperBody === '/START' || upperBody === '/MENU') {
    await sendMenu(chatId)
    return
  }

  if (upperBody === 'APPROVE' || upperBody === 'SKIP') {
    const latest = await getLatestCandidate(String(chatId))
    if (!latest) {
      await sendTelegramMessage(chatId, 'There is no recent Viral Radar candidate.')
      return
    }

    await updateDraftStatus(latest.id, upperBody === 'APPROVE' ? 'approved' : 'rejected')
    await sendTelegramMessage(
      chatId,
      upperBody === 'APPROVE'
        ? 'Draft approved and added to queue! ✅'
        : 'Candidate skipped. ❌',
    )
    await sendMenu(chatId)
    return
  }

  const match = body.match(instagramRegex)
  if (!match) {
    await sendTelegramMessage(chatId, 'Send an Instagram post/Reel URL, or use /menu.')
    return
  }

  const url = match[0]
  const note = body.replace(url, '').trim()
  await sendTelegramMessage(chatId, 'Processing your Viral Radar candidate... 📡')

  try {
    const { analysis, draft } = await processInstagramLink(url, String(chatId), note)
    let response = `Viral Radar Score: ${analysis.viral_score}/100\n\n`
    response += `Why it works:\n${analysis.why_it_worked}\n\n`
    response += `Best LinkedIn angle:\n${analysis.linkedin_angles[0]}`

    if (!draft) {
      await sendTelegramMessage(chatId, `${response}\n\nScore too low for automatic draft generation.`)
      return
    }

    await sendTelegramMessage(chatId, `${response}\n\nDraft:\n${draft.linkedin_post}`, [
      [
        { text: 'APPROVE', callback_data: 'approve_draft' },
        { text: 'SKIP', callback_data: 'skip_candidate' },
      ],
    ])
  } catch (error) {
    console.error('Telegram Viral Radar error:', error)
    await sendTelegramMessage(chatId, 'Error processing Instagram link. Please try again.')
  }
}

const walletMenu = [
  [{ text: 'Deposit funds', callback_data: 'check_address' }],
  [{ text: 'Send money', callback_data: 'send_money' }, { text: 'Check balance', callback_data: 'check_balance' }],
  [{ text: 'Link LinkedIn', callback_data: 'link_linkedin' }],
]

async function sendWalletMenu(chatId: number) {
  await sendTelegramMessage(chatId, 'What would you like to do?', walletMenu)
}

async function handleWalletText(chatId: number, text: string) {
  const identifier = `telegram:${chatId}`
  const user = await getUserFromTelegramChatId(chatId)
  const body = text.trim()

  const command = body.split(/\s+/)[0].toLowerCase()
  const commandCallbacks: Record<string, string> = {
    '/register': 'create_wallet',
    '/wallet': 'create_wallet',
    '/deposit': 'check_address',
    '/balance': 'check_balance',
    '/send': 'send_money',
    '/linkedin': 'link_linkedin',
    '/cancel': 'cancel_send_money',
  }

  if (command === '/help') {
    await sendTelegramMessage(chatId, 'Signal Room commands:\n\n/start or /wallet - Set up or open your wallet\n/deposit - Show your deposit address\n/balance - Check your ETH and token balance\n/send - Send tokens\n/linkedin - Link your LinkedIn account\n/cancel - Cancel the current action\n/help - Show this help')
    return
  }

  if (!user) {
    if (command === '/start' || command === '/register' || command === '/wallet') {
      await handleWalletCallback(chatId, 'create_wallet')
      return
    }
    if (await isRegistrationPending(identifier)) {
      if (body.length < 6) {
        await sendTelegramMessage(chatId, 'Your PIN must be at least 6 digits. Please try again:')
        return
      }
      await sendTelegramMessage(chatId, 'Creating your wallet... 🔨')
      try {
        const address = await createUser(identifier, body, undefined)
        await clearRegistrationPending(identifier)
        await sendTelegramMessage(chatId, `Your wallet was created! 🚀\n${address}\n\nUse /menu for wallet actions.`)
      } catch (error) {
        console.error('Telegram wallet creation error:', error)
        await sendTelegramMessage(chatId, 'Error creating wallet. Please try again.')
      }
      return
    }

    await sendTelegramMessage(chatId, 'Welcome to Signal Room. Create a secure Polygon zkEVM wallet to get started.', [
      [{ text: 'Create a wallet', callback_data: 'create_wallet' }],
    ])
    return
  }

  if (command === '/wallet') {
    await sendWalletMenu(chatId)
    return
  }

  if (commandCallbacks[command]) {
    await handleWalletCallback(chatId, commandCallbacks[command])
    return
  }

  if (body.toUpperCase() === '/START' || body.toUpperCase() === '/MENU') {
    await sendWalletMenu(chatId)
    return
  }

  if (await isReceiverInputPending(user.id)) {
    try {
      const receiver = await addReceiverToPayment({ userId: user.id, receiver: body })
      await sendTelegramMessage(chatId, `How many tokens do you want to send to ${receiver}?`, [[{ text: 'Cancel', callback_data: 'cancel_send_money' }]])
    } catch (error) {
      await sendTelegramMessage(chatId, `That recipient is not valid. Send a wallet address or a registered WhatsApp phone number.\n${(error as Error).message}`)
    }
    return
  }

  if (await isUserAwaitingAmountInput(user.id)) {
    try {
      const amount = transformStringToNumber(body)
      await setPaymentRequestToPinPending({ userId: user.id, amount })
      await sendTelegramMessage(chatId, 'Enter your 6-digit PIN to confirm the transaction 🔐')
    } catch {
      await sendTelegramMessage(chatId, 'Enter a valid integer or decimal amount.')
    }
    return
  }

  if (await isUserAwaitingLinkedinInput(user.id)) {
    try {
      await linkLinkedinUrn(user.id, body)
      await cancelPaymentRequest(user.id)
      await sendTelegramMessage(chatId, `Successfully linked your LinkedIn: ${body} ✅`)
      await sendWalletMenu(chatId)
    } catch {
      await cancelPaymentRequest(user.id)
      await sendTelegramMessage(chatId, 'Error linking LinkedIn.')
    }
    return
  }

  if (await isUserAwaitingBalancePinInput(user.id)) {
    try {
      const privateKey = await getPrivateKeyByPhoneNumber(identifier, body)
      const balances = await getAccountBalances(privateKey)
      await sendTelegramMessage(chatId, `${balances.ethBalance} ETH\n${balances.usdtBalance} ${balances.tokenSymbol}`)
    } catch {
      await sendTelegramMessage(chatId, 'Incorrect PIN or error loading balance.')
    }
    await cancelPaymentRequest(user.id)
    await sendWalletMenu(chatId)
    return
  }

  if (await isUserAwaitingPinInput(user.id)) {
    try {
      const pending = await getPendingPaymentRequest(user.id)
      if (!pending?.amount) throw new Error('No pending payment')
      const privateKey = await getPrivateKeyByPhoneNumber(identifier, body)
      const recipientAddress = await getRecipientAddressFromUncompletedPaymentRequest(user.id)
      await sendUsdtFromWallet({ tokenAmount: pending.amount, privateKey, toAddress: recipientAddress, isSponsored: true })
      const receiverUser = await getReceiverUserFromUncompletedPaymentRequest(user.id)
      await confirmPaymentRequest({ userId: user.id, amount: pending.amount })
      await sendTelegramMessage(chatId, `Payment successful! 🎉\n${getPolygonScanUrlForAddress(await getAddressByUserId(user.id))}`)
      if (receiverUser?.phoneNumer.startsWith('telegram:')) {
        await sendTelegramMessage(Number(receiverUser.phoneNumer.slice('telegram:'.length)), `You received ${pending.amount} tokens from ${user.name} 🌟`)
      }
    } catch (error) {
      await updatePaymentRequestToError(user.id)
      await sendTelegramMessage(chatId, `The payment could not be completed. ${(error as Error).message}`)
    }
    await sendWalletMenu(chatId)
    return
  }

  await sendTelegramMessage(chatId, 'Use /menu to see your wallet options.')
}

async function handleWalletCallback(chatId: number, data: string) {
  const identifier = `telegram:${chatId}`
  const user = await getUserFromTelegramChatId(chatId)

  if (data === 'create_wallet' && !user) {
    await setRegistrationPending(identifier)
    await sendTelegramMessage(chatId, 'Choose a 6-digit PIN to secure your new wallet 🔐')
    return
  }
  if (!user) {
    await sendTelegramMessage(chatId, 'Create a wallet first.')
    return
  }

  switch (data) {
    case 'send_money':
      await makePaymentRequest({ amount: null, fromUserId: user.id, to: null })
      await sendTelegramMessage(chatId, 'Send the recipient phone number or wallet address.', [[{ text: 'Cancel', callback_data: 'cancel_send_money' }]])
      break
    case 'check_balance':
      await setPaymentRequestToBalancePending(user.id)
      await sendTelegramMessage(chatId, 'Enter your 6-digit PIN to check your balance 🔐')
      break
    case 'check_address':
      await sendTelegramMessage(chatId, `Deposit USDT or ETH via Polygon zkEVM to:\n${user.address}`)
      await sendWalletMenu(chatId)
      break
    case 'link_linkedin':
      await setPaymentRequestToLinkedinChoicePending(user.id)
      await sendTelegramMessage(chatId, 'How would you like to link LinkedIn?', [
        [{ text: 'Provide URN', callback_data: 'link_via_urn' }, { text: 'Get code', callback_data: 'link_via_code' }],
      ])
      break
    case 'link_via_urn':
      await cancelPaymentRequest(user.id)
      await setPaymentRequestToLinkedinPending(user.id)
      await sendTelegramMessage(chatId, 'Send your LinkedIn Profile URN (for example urn:li:person:XXXX).')
      break
    case 'link_via_code': {
      await cancelPaymentRequest(user.id)
      const code = await setVerificationCode(user.id)
      await sendTelegramMessage(chatId, `Your verification code is ${code}. Comment it on one of our LinkedIn posts to link your account.`)
      await sendWalletMenu(chatId)
      break
    }
    case 'cancel_send_money':
      await cancelPaymentRequest(user.id)
      await sendTelegramMessage(chatId, 'Transfer cancelled.')
      await sendWalletMenu(chatId)
      break
    default:
      await sendWalletMenu(chatId)
  }
}

const handler: VercelApiHandler = async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' })
    return
  }

  try {
    if (!(await isMessagingPlatformActive('telegram'))) {
      res.status(404).send('Not found')
      return
    }
    const configuredSecret = await getTelegramWebhookSecret()
    if (configuredSecret && req.headers['x-telegram-bot-api-secret-token'] !== configuredSecret) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }

    const update = req.body as TelegramUpdate
    const message = update.message || update.callback_query?.message
    const chatId = message?.chat.id
    if (!chatId) {
      res.status(200).send('ok')
      return
    }

    if (update.callback_query) {
      await answerTelegramCallback(update.callback_query.id)
      const owner = await isTelegramOwner(chatId)
      if (owner && (update.callback_query.data === 'approve_draft' || update.callback_query.data === 'skip_candidate')) {
        const latest = await getLatestCandidate(String(chatId))
        if (latest) {
          await updateDraftStatus(
            latest.id,
            update.callback_query.data === 'approve_draft' ? 'approved' : 'rejected',
          )
          await sendTelegramMessage(
            chatId,
            update.callback_query.data === 'approve_draft'
              ? 'Draft approved and added to queue! ✅'
              : 'Candidate skipped. ❌',
          )
        }
        await sendMenu(chatId)
      } else if (owner) {
        await sendMenu(chatId)
      } else if (update.callback_query.data) {
        await handleWalletCallback(chatId, update.callback_query.data)
      }
    } else if (update.message?.text) {
      if (await isTelegramOwner(chatId)) {
        await handleOwnerText(chatId, update.message.text)
      } else {
        await handleWalletText(chatId, update.message.text)
      }
    }

    res.status(200).send('ok')
  } catch (error) {
    console.error('Telegram webhook error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

export default handler
