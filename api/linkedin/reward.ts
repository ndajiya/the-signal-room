import type { VercelApiHandler, VercelResponse, VercelRequest } from '@vercel/node'
import { rewardCommenters } from '../../lib/linkedin'

const handler: VercelApiHandler = async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' })
    return
  }

  const { postId, rewardAmount, limit, secret } = req.body

  // Simple security check
  if (secret !== process.env.ADMIN_SECRET) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }

  try {
    if (!postId) {
      res.status(400).json({ message: 'postId is required' })
      return
    }

    await rewardCommenters(postId, rewardAmount, limit)
    res.status(200).json({ message: 'Rewards processed successfully' })
  } catch (error) {
    res.status(500).json({ message: (error as Error).message })
  }
}

export default handler
