import { createClient } from '@supabase/supabase-js'

let supabaseClient: any = null
let currentSupabaseUrl = ''
let currentSupabaseAnonKey = ''

function initializeSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co'
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'placeholder'
  
  // Only recreate if credentials have changed
  if (supabaseUrl !== currentSupabaseUrl || supabaseAnonKey !== currentSupabaseAnonKey) {
    currentSupabaseUrl = supabaseUrl
    currentSupabaseAnonKey = supabaseAnonKey
    
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
    
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || 
        supabaseUrl.includes('placeholder') || supabaseAnonKey.includes('placeholder')) {
      console.warn('SUPABASE_URL or SUPABASE_ANON_KEY not set. Using placeholders.')
    } else {
      console.log('Supabase client initialized with new credentials')
    }
  }
  
  return supabaseClient
}

// Initialize on first import
initializeSupabase()

// Export a function that returns the current client
export function getSupabaseClient() {
  return initializeSupabase()
}

let settingsClient: any = null
let currentSettingsUrl = ''
let currentSettingsKey = ''

// Settings contain secrets and are written only by server-side admin routes.
// Prefer the service-role key so Supabase RLS policies do not block admin
// persistence. Fall back to the publishable key for existing deployments.
export function getSupabaseSettingsClient() {
  const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co'
  const settingsKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    'placeholder'

  if (supabaseUrl !== currentSettingsUrl || settingsKey !== currentSettingsKey) {
    currentSettingsUrl = supabaseUrl
    currentSettingsKey = settingsKey
    settingsClient = createClient(supabaseUrl, settingsKey)
  }

  return settingsClient
}

// For backward compatibility
export const supabase = getSupabaseClient()
