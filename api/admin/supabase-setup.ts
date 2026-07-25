import type { VercelApiHandler, VercelResponse, VercelRequest } from '@vercel/node'
import { updateSetting } from '../../lib/settings'

const handler: VercelApiHandler = async (req: VercelRequest, res: VercelResponse) => {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) {
    res.status(500).json({ message: 'ADMIN_SECRET not configured in environment' })
    return
  }

  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${adminSecret}`) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' })
    return
  }

  const { supabaseUrl, supabaseAnonKey } = req.body
  
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(400).json({ message: 'Supabase URL and Publishable Key are required' })
    return
  }

  if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
    res.status(400).json({ message: 'Invalid Supabase URL format. Should start with https:// and contain .supabase.co' })
    return
  }

  if (!supabaseAnonKey.startsWith('eyJ') && !supabaseAnonKey.startsWith('sb_publishable_')) {
    res.status(400).json({ message: 'Invalid Supabase Publishable Key format. Expected sb_publishable_... or an older eyJ... key' })
    return
  }

  try {
    // First update environment variables so the Supabase client gets reinitialized
    process.env.SUPABASE_URL = supabaseUrl
    process.env.SUPABASE_ANON_KEY = supabaseAnonKey
    
    console.log(`Supabase environment variables updated: URL=${supabaseUrl.substring(0, 30)}..., Key=${supabaseAnonKey.substring(0, 20)}...`)
    
    // Now save to database using the NEW credentials
    const urlStorage = await updateSetting('SUPABASE_URL', supabaseUrl)
    const keyStorage = await updateSetting('SUPABASE_ANON_KEY', supabaseAnonKey)
    const storage = urlStorage === 'database' && keyStorage === 'database'
      ? 'database'
      : 'memory'
    
    console.log(`Supabase configuration saved to database`)
    
    res.status(200).json({ 
      message: 'Supabase configuration saved successfully',
      supabaseUrl: supabaseUrl.substring(0, 30) + '...',
      supabaseAnonKey: supabaseAnonKey.substring(0, 20) + '...',
      storage,
      status: 'configured'
    })
    return
  } catch (error) {
    console.error('Error saving Supabase configuration:', error)
    
    // Even if saving to DB fails, keep the env vars updated for this session
    process.env.SUPABASE_URL = supabaseUrl
    process.env.SUPABASE_ANON_KEY = supabaseAnonKey
    
    res.status(500).json({ 
      message: (error as Error).message,
      note: 'Environment variables updated for current session, but database save failed.'
    })
    return
  }
}

export default handler
