import OpenAI from 'openai'
import { getSetting } from '../settings'

export interface ViralScoreResult {
  viral_score: number
  hook_score: number
  linkedin_transfer_score: number
  brand_relevance_score: number
  format_repeatability_score: number
  topic_heat_score: number
  comment_potential_score: number
  visible_popularity_score: number
  summary: string
  why_it_worked: string
  emotional_trigger: string
  content_pattern: string
  recommended_action: 'skip' | 'save' | 'draft' | 'urgent'
  linkedin_angles: string[]
}

export interface LinkedInDraft {
  draft_title: string
  angle: string
  target_audience: string
  linkedin_post: string
  why_this_should_work: string
  suggested_hashtags: string[]
  risk_notes: string
}

async function getOpenAIClient() {
  const apiKey = await getSetting('OPENAI_API_KEY')
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')
  return new OpenAI({ apiKey })
}

export async function scoreViralCandidate(data: {
  instagram_url: string
  creator_username?: string
  caption?: string
  visible_likes?: number
  visible_comments?: number
  visible_views?: number
  owner_note?: string
}): Promise<ViralScoreResult> {
  const openai = await getOpenAIClient()
  const brandName = (await getSetting('BRAND_NAME')) || 'BoardOS'
  const targetAudience = (await getSetting('BRAND_TARGET_AUDIENCE')) || 'pre-seed founders, startup operators, angel investors'

  const prompt = `
You are ${brandName} Viral Radar, a content intelligence system.

Your job is to analyze Instagram posts submitted by the owner and decide whether they should be transformed into LinkedIn content.

Input:
- Instagram URL: ${data.instagram_url}
- Creator username: ${data.creator_username || 'Unknown'}
- Caption: ${data.caption || 'No caption'}
- Visible likes: ${data.visible_likes || 'Unknown'}
- Visible comments: ${data.visible_comments || 'Unknown'}
- Visible views: ${data.visible_views || 'Unknown'}
- Owner note: ${data.owner_note || 'None'}
- Target brand: ${brandName}
- Target audience: ${targetAudience}

Score the post using this framework (0-100 total):
1. Hook Strength: 0–20
2. LinkedIn Transferability: 0–20
3. ${brandName} Relevance: 0–15
4. Format Repeatability: 0–15
5. Topic Heat: 0–10
6. Comment Potential: 0–10
7. Visible Popularity: 0–10 (If metrics are unknown, assign 5 and explain)

Return valid JSON only.
`

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' }
  })

  return JSON.parse(response.choices[0].message.content!) as ViralScoreResult
}

export async function generateLinkedInDraft(data: {
  instagram_url: string
  caption?: string
  owner_note?: string
  viral_radar_analysis: ViralScoreResult
}): Promise<LinkedInDraft> {
  const openai = await getOpenAIClient()
  const brandName = (await getSetting('BRAND_NAME')) || 'BoardOS'
  const valueProp = (await getSetting('BRAND_VALUE_PROPOSITION')) || 'helps pre-seed founders make better operating decisions'
  const targetAudience = (await getSetting('BRAND_TARGET_AUDIENCE')) || 'pre-seed founders'
  const customPrompt = await getSetting('LINKEDIN_DRAFT_PROMPT')

  const defaultPrompt = `
You are a strategic LinkedIn ghostwriter for ${brandName}.

${brandName} ${valueProp}.

Transform the submitted Instagram content into an original LinkedIn post.

Do not copy the Instagram caption.
Do not imitate the original creator directly.
Extract the underlying content pattern, emotional trigger, or strategic insight, then create a new LinkedIn post for ${brandName}.

Input:
- Instagram URL: ${data.instagram_url}
- Caption: ${data.caption || 'None'}
- Owner note: ${data.owner_note || 'None'}
- Viral Radar analysis: ${JSON.stringify(data.viral_radar_analysis)}
- Target audience: ${targetAudience}
- Brand: ${brandName}
- Desired tone: sharp, strategic, contrarian, useful, non-hype

The LinkedIn post should:
1. Start with a strong hook.
2. Make one clear argument.
3. Connect to a real founder operating problem.
4. Include a ${brandName}-relevant insight.
5. Avoid sounding like an ad.
6. End with a comment-worthy question or punchline.
7. Stay under 1,500 characters.

Return valid JSON only.
`

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [{ role: 'user', content: customPrompt || defaultPrompt }],
    response_format: { type: 'json_object' }
  })

  return JSON.parse(response.choices[0].message.content!) as LinkedInDraft
}
