import { supabase } from '../supabase'

import { buildPrivateKey, getAddressFromPrivateKey } from '../crypto'
import { encryptPrivateKey, decryptPrivateKey } from '../utils/encryption'

export type User = {
  privateKey: string // This will be the encrypted one in DB, but decrypted in memory
  id: string
  createdAt: string
  phoneNumer: string
  name: string
  address: string
  isPinRequired?: boolean
  linkedinUrn?: string
  verificationCode?: string
}

export async function linkLinkedinUrn(userId: string, urn: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ linkedin_urn: urn, verification_code: null }) // Clear code once linked
    .eq('id', userId)

  if (error) {
    throw new Error(`Error linking LinkedIn URN: ${error.message}`)
  }
}

export async function setVerificationCode(userId: string): Promise<string> {
  const code = `CRYPTO-${Math.floor(1000 + Math.random() * 9000)}`
  const { error } = await supabase
    .from('users')
    .update({ verification_code: code })
    .eq('id', userId)

  if (error) {
    throw new Error(`Error setting verification code: ${error.message}`)
  }
  return code
}

export async function isUserRegistered(
  recipientPhone: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('phone_number')
    .eq('phone_number', recipientPhone)
  if (error) {
    throw new Error('Error checking if user is registered')
  }
  return data.length > 0
}

export async function getPrivateKeyByPhoneNumber(
  recipientPhone: string,
  pin: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('users')
    .select('private_key')
    .eq('phone_number', recipientPhone)

  if (error || data.length === 0) {
    throw new Error(
      `Error getting user address, ${JSON.stringify({
        error,
        recipientPhone,
      })} `,
    )
  }

  const decrypted = decryptPrivateKey(data[0].private_key, pin)
  if (!decrypted) {
    throw new Error('Incorrect PIN. Could not decrypt private key.')
  }

  return decrypted
}

export async function getAddressByPhoneNumber(
  recipientPhone: string,
): Promise<string> {
  const user = await getUserFromPhoneNumber(recipientPhone)

  if (!user) {
    throw new Error('User not found')
  }

  return user.address
}

export async function getUserFromId(userId: string): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)

  if (error || data.length === 0) {
    throw new Error(`Error getting user from id, ${JSON.stringify({ error })}`)
  }

  const [{ created_at, id, name, phone_number, private_key, address, linkedin_urn, verification_code }] = data

  return {
    createdAt: created_at,
    id,
    name,
    phoneNumer: phone_number,
    privateKey: private_key,
    address,
    linkedinUrn: linkedin_urn,
    verificationCode: verification_code,
  }
}

export async function getAddressByUserId(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('users')
    .select('address')
    .eq('id', userId)

  if (error || data.length === 0) {
    throw new Error(
      `Error getting user address, ${JSON.stringify({
        error,
        userId,
      })} `,
    )
  }
  return data[0].address
}

export async function createUser(
  recipientPhone: string,
  pin: string,
  recipientName?: string,
): Promise<string> {
  const privateKey = buildPrivateKey()
  const userAddress = getAddressFromPrivateKey(privateKey)
  const encryptedKey = encryptPrivateKey(privateKey, pin)

  const user = await supabase.from('users').insert({
    phone_number: recipientPhone,
    name: recipientName,
    private_key: encryptedKey,
    address: userAddress,
  })

  if (user.error) {
    throw new Error('Error creating user')
  }
  return userAddress
}

export async function getUserFromPhoneNumber(
  recipientPhone: string,
): Promise<User | null> {
  const sanitizedPhoneNumber = recipientPhone.replace(/[^0-9.]/g, '')

  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .like('phone_number', `%${sanitizedPhoneNumber}%`)

  if (error) {
    throw new Error(`Error getting user from phone number ${error}`)
  }

  if (users.length === 0) {
    return null
  }

  const [{ created_at, id, name, phone_number, private_key, address, linkedin_urn, verification_code }] = users

  return {
    createdAt: created_at,
    id,
    name,
    phoneNumer: phone_number,
    privateKey: private_key,
    address,
    linkedinUrn: linkedin_urn,
    verificationCode: verification_code,
  }
}

/** Exact lookup used by Telegram users. Telegram chat IDs must not use the
 * fuzzy phone-number lookup because a short numeric ID could match a phone. */
export async function getUserFromTelegramChatId(
  chatId: number | string,
): Promise<User | null> {
  const identifier = `telegram:${chatId}`
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .eq('phone_number', identifier)

  if (error) {
    throw new Error(`Error getting Telegram user ${error.message}`)
  }

  if (users.length === 0) return null

  const [{ created_at, id, name, phone_number, private_key, address, linkedin_urn, verification_code }] = users
  return {
    createdAt: created_at,
    id,
    name,
    phoneNumer: phone_number,
    privateKey: private_key,
    address,
    linkedinUrn: linkedin_urn,
    verificationCode: verification_code,
  }
}
