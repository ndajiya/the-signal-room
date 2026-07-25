import { getSupabaseClient } from './supabase'

export async function getSetting(key: string): Promise<string | null> {
  // First check in-memory store
  if (inMemorySettings.has(key)) {
    return inMemorySettings.get(key) || null
  }
  
  // Check if Supabase is configured (not using placeholder)
  const supabaseUrl = process.env.SUPABASE_URL || ''
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || ''
  
  if (!supabaseUrl.includes('placeholder') && !supabaseAnonKey.includes('placeholder') && supabaseUrl && supabaseAnonKey) {
    try {
      // Check DB
      const { data, error } = await getSupabaseClient()
        .from('settings')
        .select('value')
        .eq('key', key)
        .single()

      if (data && !error) {
        return data.value
      }
    } catch (error) {
      console.log(`Supabase query failed for ${key}, falling back to .env`)
    }
  }

  // Fallback to .env
  return process.env[key] || null
}

export async function isMessagingPlatformActive(
  platform: 'whatsapp' | 'telegram',
): Promise<boolean> {
  const configured = (await getSetting('ACTIVE_MESSAGING_PLATFORM'))?.trim().toLowerCase()
  // Keep existing deployments working until the admin explicitly chooses a channel.
  if (!configured || configured === 'both') return true
  if (configured !== 'whatsapp' && configured !== 'telegram') return true
  return configured === platform
}

// In-memory store for settings when Supabase isn't available
const inMemorySettings = new Map<string, string>()

export async function updateSetting(
  key: string,
  value: string,
): Promise<'database' | 'memory'> {
  // Update environment variable for immediate use
  process.env[key] = value
  
  // Special handling for Supabase configuration
  if (key === 'SUPABASE_URL' || key === 'SUPABASE_ANON_KEY') {
    console.log(`Supabase ${key} updated: ${value.substring(0, 20)}...`)
    
    // If we're updating Supabase config, we need to reinitialize the Supabase client
    // This will happen automatically on next import
    
    // After saving Supabase credentials, try to migrate any existing in-memory settings to DB
    if (!value.includes('placeholder')) {
      setTimeout(async () => {
        await migrateInMemorySettingsToDB()
      }, 1000)
    }
  }
  
  // Check if Supabase is configured (not using placeholder)
  const supabaseUrl = process.env.SUPABASE_URL || ''
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || ''
  
  if (supabaseUrl.includes('placeholder') || supabaseAnonKey.includes('placeholder') || !supabaseUrl || !supabaseAnonKey) {
    // Store in memory for initial setup
    inMemorySettings.set(key, value)
    console.log(`Setting ${key} stored in memory (Supabase not configured)`)
    return 'memory'
  }
  
  try {
    const { error } = await getSupabaseClient()
      .from('settings')
      .upsert({ key, value, updated_at: new Date().toISOString() })

    if (error) {
      throw new Error(`Error updating setting ${key}: ${error.message}`)
    }
    
    // Remove from in-memory store if successfully saved to DB
    inMemorySettings.delete(key)
    console.log(`Setting ${key} saved to database`)
    return 'database'
  } catch (error) {
    // Fallback to in-memory storage if Supabase connection fails
    inMemorySettings.set(key, value)
    console.log(`Setting ${key} stored in memory (Supabase connection failed: ${(error as Error).message})`)
    return 'memory'
  }
}

async function migrateInMemorySettingsToDB(): Promise<void> {
  if (inMemorySettings.size === 0) {
    return
  }
  
  const supabaseUrl = process.env.SUPABASE_URL || ''
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || ''
  
  if (supabaseUrl.includes('placeholder') || supabaseAnonKey.includes('placeholder') || !supabaseUrl || !supabaseAnonKey) {
    return
  }
  
  console.log(`Migrating ${inMemorySettings.size} in-memory settings to database...`)
  
  const settingsToMigrate = Array.from(inMemorySettings.entries()).map(([key, value]) => ({
    key,
    value,
    updated_at: new Date().toISOString()
  }))
  
  try {
    const { error } = await getSupabaseClient()
      .from('settings')
      .upsert(settingsToMigrate)
    
    if (error) {
      console.error('Failed to migrate settings to database:', error.message)
      return
    }
    
    // Clear in-memory store after successful migration
    inMemorySettings.clear()
    console.log('Successfully migrated all in-memory settings to database')
  } catch (error) {
    console.error('Error migrating settings to database:', error)
  }
}

export async function getAllSettings(): Promise<Record<string, string>> {
  let data, error;
  try {
    const result = await getSupabaseClient().from('settings').select('*');
    data = result.data;
    error = result.error;
  } catch (e) {
    console.error('Supabase connection failed:', e);
  }
  
  const settings: Record<string, string> = {}
  
  // Start with common env vars as defaults
  const keys = [
    'QUICK_NODE_URL',
    'MASTER_ENCRYPTION_KEY',
    'SPONSOR_PRIVATE_KEY',
    'TOKEN_CONTRACT_ADDRESS',
    'TOKEN_SYMBOL',
    'TOKEN_DECIMALS',
    'TOKEN_NAME',
    'LINKEDIN_ACCESS_TOKEN',
    'COMMENT_REWARD_AMOUNT',
    'MAX_COMMENTERS_TO_REWARD',
    'MAX_TOTAL_REWARD_PER_POST',
    'REWARD_ONLY_FIRST_UNIQUE_COMMENT',
    'ADMIN_SECRET',
    'OWNER_WHATSAPP_NUMBER',
    'ACTIVE_MESSAGING_PLATFORM',
    'TELEGRAM_BOT_TOKEN',
    'OWNER_TELEGRAM_CHAT_ID',
    'TELEGRAM_WEBHOOK_SECRET',
    'AI_PROVIDER',
    'OPENAI_API_KEY',
    'OPENAI_MODEL',
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_MODEL',
    'BRAND_NAME',
    'BRAND_TARGET_AUDIENCE',
    'BRAND_VALUE_PROPOSITION',
    'LINKEDIN_DRAFT_PROMPT',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY'
  ]
  
  for (const k of keys) {
    if (process.env[k]) {
      // For sensitive keys, mask the value
      if (k.includes('KEY') || k.includes('TOKEN') || k.includes('SECRET') || k.includes('PRIVATE')) {
        settings[k] = '********'
      } else {
        settings[k] = process.env[k] || ''
      }
    }
  }

  if (data && !error) {
    data.forEach(s => {
      settings[s.key] = s.value
    })
  }

  // Add in-memory settings (overwrites DB values if same key exists)
  for (const [key, value] of inMemorySettings.entries()) {
    settings[key] = value
  }

  return settings
}
