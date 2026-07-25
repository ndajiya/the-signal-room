import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const SALT_LENGTH = 16

const MASTER_KEY = process.env.MASTER_ENCRYPTION_KEY

if (!MASTER_KEY) {
  console.warn('MASTER_ENCRYPTION_KEY is not defined. Encryption will be weak.')
}

/**
 * Derives a key from the PIN and Master Key
 */
function deriveKey(pin: string, salt: Uint8Array): Uint8Array {
  const keyBuffer = crypto.pbkdf2Sync(
    `${pin}:${MASTER_KEY || 'default-secret'}`,
    salt,
    100000,
    32,
    'sha256',
  )
  return new Uint8Array(keyBuffer)
}

/**
 * Encrypts a private key using a user PIN
 * Returns a string in format: salt:iv:authTag:encryptedData
 */
export function encryptPrivateKey(privateKey: string, pin: string): string {
  const salt = new Uint8Array(crypto.randomBytes(SALT_LENGTH))
  const iv = new Uint8Array(crypto.randomBytes(IV_LENGTH))
  const key = deriveKey(pin, salt)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(privateKey, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const tag = cipher.getAuthTag()

  return `${Buffer.from(salt).toString('hex')}:${Buffer.from(iv).toString('hex')}:${tag.toString(
    'hex',
  )}:${encrypted}`
}

/**
 * Decrypts a private key using a user PIN
 */
export function decryptPrivateKey(
  encryptedData: string,
  pin: string,
): string | null {
  try {
    const [saltHex, ivHex, tagHex, encrypted] = encryptedData.split(':')
    const salt = new Uint8Array(Buffer.from(saltHex, 'hex'))
    const iv = new Uint8Array(Buffer.from(ivHex, 'hex'))
    const tag = new Uint8Array(Buffer.from(tagHex, 'hex'))
    const key = deriveKey(pin, salt)

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    console.error('Decryption failed:', error)
    return null
  }
}
