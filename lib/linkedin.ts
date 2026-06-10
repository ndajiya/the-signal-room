import axios from 'axios'
import { supabase } from './supabase'
import { sendUsdtFromWallet } from './crypto/transaction'
import { getSetting } from './settings'
import { linkLinkedinUrn } from './user'

interface LinkedInCommentElement {
  id: string
  message: {
    text: string
  }
  actor: string
}

interface LinkedInCommentsResponse {
  elements?: LinkedInCommentElement[]
}

const LINKEDIN_API_URL = 'https://api.linkedin.com/v2'

export interface LinkedInComment {
  id: string
  text: string
  author: string // urn:li:person:XXXX
}

/**
 * Fetches the first 25 comments from a LinkedIn post
 * Note: Requires LinkedIn Marketing Solutions or Community Management API access
 */
export async function getPostComments(
  postId: string,
  accessToken: string,
  count = 25,
): Promise<LinkedInComment[]> {
  try {
    const response = await axios.get<LinkedInCommentsResponse>(
      `${LINKEDIN_API_URL}/socialActions/${postId}/comments`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
        params: {
          count,
        },
      },
    )

    return response.data.elements?.map((el: LinkedInCommentElement) => ({
      id: el.id,
      text: el.message.text,
      author: el.actor,
    })) || []
  } catch (error) {
    console.error('Error fetching LinkedIn comments:', error)
    return []
  }
}

async function getNumberSetting(
  key: string,
  fallback: number,
): Promise<number> {
  const rawValue = await getSetting(key)
  if (!rawValue) return fallback

  const parsedValue = Number.parseFloat(rawValue)
  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

async function getBooleanSetting(
  key: string,
  fallback: boolean,
): Promise<boolean> {
  const rawValue = await getSetting(key)
  if (!rawValue) return fallback

  const normalized = rawValue.trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  return fallback
}

function buildRewardQueue(
  comments: LinkedInComment[],
  maxCommenters: number,
  rewardOnlyFirstUniqueComment: boolean,
): LinkedInComment[] {
  if (!rewardOnlyFirstUniqueComment) {
    return comments.slice(0, maxCommenters)
  }

  const seenAuthors = new Set<string>()
  const queue: LinkedInComment[] = []

  for (const comment of comments) {
    if (seenAuthors.has(comment.author)) {
      continue
    }

    seenAuthors.add(comment.author)
    queue.push(comment)

    if (queue.length >= maxCommenters) {
      break
    }
  }

  return queue
}

/**
 * Logic to reward the first N commenters
 * This would be called by a cron job or a webhook
 */
export async function rewardCommenters(
  postId: string,
  rewardAmount?: number,
  limit?: number,
) {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN
  const sponsorKey = process.env.SPONSOR_PRIVATE_KEY
  const masterPin = process.env.ADMIN_MASTER_PIN // A master PIN for admin-triggered rewards

  if (!accessToken) throw new Error('LINKEDIN_ACCESS_TOKEN not set')
  if (!sponsorKey) throw new Error('SPONSOR_PRIVATE_KEY not set')
  if (!masterPin) throw new Error('ADMIN_MASTER_PIN not set')

  const configuredRewardAmount = await getNumberSetting('COMMENT_REWARD_AMOUNT', 1)
  const configuredLimit = await getNumberSetting('MAX_COMMENTERS_TO_REWARD', 25)
  const configuredMaxTotalReward = await getNumberSetting(
    'MAX_TOTAL_REWARD_PER_POST',
    Number.POSITIVE_INFINITY,
  )
  const rewardOnlyFirstUniqueComment = await getBooleanSetting(
    'REWARD_ONLY_FIRST_UNIQUE_COMMENT',
    true,
  )
  const effectiveRewardAmount = rewardAmount ?? configuredRewardAmount
  const requestedLimit = Math.max(1, Math.floor(limit ?? configuredLimit))
  const payoutCapFromBudget = Number.isFinite(configuredMaxTotalReward)
    ? Math.max(0, Math.floor(configuredMaxTotalReward / effectiveRewardAmount))
    : requestedLimit
  const effectiveLimit = Math.max(0, Math.min(requestedLimit, payoutCapFromBudget))

  if (!(effectiveRewardAmount > 0)) {
    throw new Error('COMMENT_REWARD_AMOUNT must be greater than 0')
  }

  if (effectiveLimit === 0) {
    console.log(`No commenter rewards processed for post ${postId} because the payout cap is 0`)
    return
  }

  const fetchCount = Math.max(25, requestedLimit)
  const comments = await getPostComments(postId, accessToken, fetchCount)
  const rewardQueue = buildRewardQueue(
    comments,
    effectiveLimit,
    rewardOnlyFirstUniqueComment,
  )

  console.log(
    `Rewarding ${rewardQueue.length} commenters for post ${postId} at ${effectiveRewardAmount} tokens each`,
  )

  for (const comment of rewardQueue) {
    const commenterUrn = comment.author
    console.log(`Processing comment from ${commenterUrn}: "${comment.text}"`)
    
    // 1. Try to find user by LinkedIn URN
    let { data: user, error: _error } = await supabase
      .from('users')
      .select('*')
      .eq('linkedin_urn', commenterUrn)
      .single()

    // 2. If not found by URN, check if the comment contains a verification code
    if (!user) {
      const codeMatch = comment.text.match(/CRYPTO-\d{4}/)
      if (codeMatch) {
        const code = codeMatch[0]
        console.log(`Found verification code ${code} in comment.`)
        
        const { data: userWithCode, error: codeError } = await supabase
          .from('users')
          .select('*')
          .eq('verification_code', code)
          .single()

        if (userWithCode && !codeError) {
          user = userWithCode
          if (user && user.phone_number && user.id) {
            console.log(`Matching code ${code} to user ${user.phone_number}. Linking URN...`)
            await linkLinkedinUrn(user.id, commenterUrn)
          } else {
            console.log(`User data incomplete for verification code ${code}`)
          }
        }
      }
    }

    if (!user) {
      console.log(`User with URN ${commenterUrn} not found or not linked.`)
      continue
    }

    // Deduplicate rewards for the same post
    // (Logic to ensure we only reward once per person per post would go here)

    try {
      // Use the sponsor key to send the reward
      await sendUsdtFromWallet({
        tokenAmount: effectiveRewardAmount,
        privateKey: sponsorKey,
        toAddress: user.address,
        isSponsored: true,
      })
      console.log(
        `Sent ${effectiveRewardAmount} tokens to ${user.phone_number} (${user.address})`,
      )
    } catch (e) {
      console.error(`Failed to reward ${user.phone_number}:`, e)
    }
  }
}
