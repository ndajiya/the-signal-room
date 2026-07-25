import axios from 'axios'

export interface InstagramMetadata {
  creator_username?: string
  caption?: string
  thumbnail_url?: string
  content_type?: string
  visible_likes?: number
  visible_comments?: number
  visible_views?: number
  posted_at?: string
  raw_metadata?: any
}

export async function extractInstagramMetadata(url: string): Promise<InstagramMetadata> {
  try {
    // Note: In a production environment, you might use an official API or a specialized service.
    // For this MVP, we attempt to extract what's available via OpenGraph or public meta tags.
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })

    const html = response.data as string
    const metadata: InstagramMetadata = {}

    // Very basic extraction logic using regex for common meta tags
    const captionMatch = html.match(/<meta property="og:description" content="(.*?)"/)
    if (captionMatch) metadata.caption = captionMatch[1]

    const imageMatch = html.match(/<meta property="og:image" content="(.*?)"/)
    if (imageMatch) metadata.thumbnail_url = imageMatch[1]

    const titleMatch = html.match(/<meta property="og:title" content="(.*?)"/)
    if (titleMatch) {
      // Title often contains "Username on Instagram: 'Caption...'"
      const parts = titleMatch[1].split(' on Instagram:')
      if (parts.length > 0) metadata.creator_username = parts[0].replace(/[^\w]/g, '')
    }

    metadata.raw_metadata = { extracted_at: new Date().toISOString() }
    
    return metadata
  } catch (error) {
    console.error('Error extracting Instagram metadata:', error)
    return {
      raw_metadata: { error: (error as Error).message }
    }
  }
}
