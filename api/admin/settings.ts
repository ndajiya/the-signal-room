import type { VercelApiHandler, VercelResponse, VercelRequest } from '@vercel/node'
import { getAllSettings, updateSetting } from '../../lib/settings'

const handler: VercelApiHandler = async (req: VercelRequest, res: VercelResponse) => {
  const adminSecret = process.env.ADMIN_SECRET || 'admin' // Fallback for initial setup

  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${adminSecret}`) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }

  if (req.method === 'GET') {
    const settings = await getAllSettings()
    res.status(200).json(settings)
    return
  }

  if (req.method === 'POST') {
    const { key, value } = req.body
    if (!key || value === undefined) {
      res.status(400).json({ message: 'Key and value are required' })
      return
    }

    try {
      await updateSetting(key, value)
      res.status(200).json({ message: 'Setting updated successfully' })
      return
    } catch (error) {
      res.status(500).json({ message: (error as Error).message })
      return
    }
  }

  res.status(405).json({ message: 'Method not allowed' })
}

export default handler
