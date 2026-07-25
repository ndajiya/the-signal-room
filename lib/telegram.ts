import axios from 'axios'
import { getSetting } from './settings'

type TelegramButton = {
  text: string
  callback_data: string
}

async function getTelegramConfig() {
  const token = await getSetting('TELEGRAM_BOT_TOKEN')
  const ownerChatId = await getSetting('OWNER_TELEGRAM_CHAT_ID')
  const webhookSecret = await getSetting('TELEGRAM_WEBHOOK_SECRET')

  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured')
  }

  return { token, ownerChatId, webhookSecret }
}

export async function getTelegramWebhookSecret(): Promise<string | null> {
  return (await getTelegramConfig()).webhookSecret
}

export async function isTelegramOwner(
  chatId: number | string,
  username?: string,
): Promise<boolean> {
  const { ownerChatId } = await getTelegramConfig()
  const configuredUsername = await getSetting('OWNER_TELEGRAM_USERNAME')
  const normalizedUsername = username?.replace(/^@/, '').toLowerCase()
  const expectedUsername = configuredUsername?.replace(/^@/, '').toLowerCase()

  return Boolean(
    (ownerChatId && String(chatId) === String(ownerChatId)) ||
    (expectedUsername && normalizedUsername === expectedUsername),
  )
}

export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  buttons?: TelegramButton[][],
): Promise<void> {
  const { token } = await getTelegramConfig()
  await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
    chat_id: chatId,
    text,
    ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
  })
}

export async function answerTelegramCallback(callbackQueryId: string): Promise<void> {
  const { token } = await getTelegramConfig()
  await axios.post(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    callback_query_id: callbackQueryId,
  })
}

export function telegramOwnerMenu() {
  return [
    [
      { text: 'Show Top 5', callback_data: 'show_top' },
      { text: 'Show Drafts', callback_data: 'show_drafts' },
    ],
  ]
}
