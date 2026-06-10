import { supabase } from '../supabase'
import { extractInstagramMetadata } from './metadata'
import { scoreViralCandidate, generateLinkedInDraft } from './ai'

export async function processInstagramLink(url: string, whatsappNumber: string, ownerNote?: string) {
  // 1. Extract Metadata
  const metadata = await extractInstagramMetadata(url)

  // 2. Store Candidate (Initial)
  const { data: candidate, error: insertError } = await supabase
    .from('viral_candidates')
    .insert({
      source_url: url,
      submitted_by_whatsapp: whatsappNumber,
      owner_note: ownerNote,
      creator_username: metadata.creator_username,
      caption: metadata.caption,
      thumbnail_url: metadata.thumbnail_url,
      content_type: metadata.content_type,
      visible_likes: metadata.visible_likes,
      visible_comments: metadata.visible_comments,
      visible_views: metadata.visible_views,
      raw_metadata: metadata.raw_metadata,
      status: 'received'
    })
    .select()
    .single()

  if (insertError) throw insertError

  // 3. Score Candidate
  const analysis = await scoreViralCandidate({
    instagram_url: url,
    creator_username: metadata.creator_username,
    caption: metadata.caption,
    visible_likes: metadata.visible_likes,
    visible_comments: metadata.visible_comments,
    visible_views: metadata.visible_views,
    owner_note: ownerNote
  })

  // 4. Update Candidate with Scores
  await supabase
    .from('viral_candidates')
    .update({
      viral_score: analysis.viral_score,
      hook_score: analysis.hook_score,
      linkedin_transfer_score: analysis.linkedin_transfer_score,
      brand_relevance_score: analysis.brand_relevance_score,
      format_repeatability_score: analysis.format_repeatability_score,
      topic_heat_score: analysis.topic_heat_score,
      comment_potential_score: analysis.comment_potential_score,
      visible_popularity_score: analysis.visible_popularity_score,
      status: 'analyzed'
    })
    .eq('id', candidate.id)

  // 5. Generate Draft if score is high enough
  let draft = null
  if (analysis.viral_score >= 70) {
    const draftContent = await generateLinkedInDraft({
      instagram_url: url,
      caption: metadata.caption,
      owner_note: ownerNote,
      viral_radar_analysis: analysis
    })

    const { data: insertedDraft, error: draftError } = await supabase
      .from('linkedin_drafts')
      .insert({
        candidate_id: candidate.id,
        draft_title: draftContent.draft_title,
        linkedin_post: draftContent.linkedin_post,
        angle: draftContent.angle,
        target_audience: draftContent.target_audience,
        status: 'draft'
      })
      .select()
      .single()

    if (draftError) throw draftError
    draft = insertedDraft
  }

  return { candidate, analysis, draft }
}

export async function getLatestCandidate(whatsappNumber: string) {
  const { data, error: _error } = await supabase
    .from('viral_candidates')
    .select('*, linkedin_drafts(*)')
    .eq('submitted_by_whatsapp', whatsappNumber)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  
  return data
}

export async function updateDraftStatus(candidateId: string, status: string) {
  const { data: draft } = await supabase
    .from('linkedin_drafts')
    .select('*')
    .eq('candidate_id', candidateId)
    .single()

  if (!draft) return null

  const { data, error: _error } = await supabase
    .from('linkedin_drafts')
    .update({ status })
    .eq('id', draft.id)
    .select()
    .single()
  
  return data
}
