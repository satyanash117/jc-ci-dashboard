/**
 * ai-post-analyzer.js — Per-post AI classification for dashboard
 *
 * Takes raw scraped posts and classifies each one with:
 *   hook_type, intent, cta_method, campaign_id,
 *   dest_ultimate, dest_immediate, sequence_position,
 *   hook_text_english, body_summary_english
 *
 * Batches in groups of 10 to respect LLM token limits.
 * Reuses getLLMClient() from analysis/analyzer.js.
 *
 * NOTE: campaign_id assigned here is a PROVISIONAL label per batch.
 * The ai-campaign-grouper.js pass that runs afterwards overwrites
 * these with globally coherent IDs across the full post history.
 */

const path = require('path')

// Dashboard classification uses Claude Haiku — fast and cost-effective for
// high-volume batched classification.
function getLLMClient() {
  const Anthropic = require('@anthropic-ai/sdk')
  const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY })
  return {
    provider: 'claude',
    async generate(prompt) {
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      })
      return msg.content[0].text
    },
  }
}

const HOOK_TYPES = [
  'NEWS-BREAK', 'CURIOSITY-GAP', 'PERSONAL-STORY', 'SHOCK', 'FOMO',
  'AUTHORITY', 'NUMBER-LISTICLE', 'QUESTION', 'CONTRARIAN', 'SOCIAL-PROOF',
  'HOW-TO', 'NOVELTY', 'VALUE-OFFER', 'CHALLENGE', 'CULTURAL-MOMENT',
  'PAIN-POINT', 'CTA-HOOK', 'HUMOR', 'OTHER',
]

const INTENT_TYPES = [
  'GIVE-VALUE', 'SOFT-SELL', 'HARD-SELL', 'WARM-UP',
  'SOCIAL-PROOF', 'COMMUNITY-BUILDING', 'AUTHORITY', 'URGENCY',
]

const CTA_TYPES = [
  'COMMENT-KEYWORD', 'COMMENT-TO-RECEIVE', 'LINK-IN-COMMENT', 'LINK-IN-POST',
  'ENGAGEMENT-QUESTION', 'NONE', 'SHARE-CTA', 'WHATSAPP-JOIN', 'DM-AUTOMATION',
]

const SEQUENCE_POSITIONS = [
  'TEASER',    // hints something is coming, no hard sell yet
  'LAUNCH',    // announces the product/offer for the first time
  'VALUE',     // free value post supporting an active launch arc
  'URGENCY',   // deadline/scarcity push within an active campaign
  'SOFT-SELL', // gentle promotion without hard pitch
  'STANDALONE', // not part of any campaign arc
]

function buildClassifyPrompt(posts) {
  const postList = posts.map((p, i) => {
    const text    = p.caption || p.text || p.content || p.hook || ''
    const channel = p.platform || p.channel || 'unknown'
    const date    = p.date || p.timestamp || p.date_normalized || ''
    return `POST ${i + 1} [${channel}${date ? ' | ' + date : ''}]:
${text.slice(0, 600)}
---`
  }).join('\n\n')

  return `You are a social media content analyst. Classify each of the following posts.

For each post return a JSON object with these exact fields:
- hook_type: one of ${HOOK_TYPES.join(', ')}
- intent: one of ${INTENT_TYPES.join(', ')}
- cta_method: one of ${CTA_TYPES.join(', ')}
- campaign_id: if the post is clearly part of a named launch/campaign, use CAMP-[TOPIC]-[MONTH][YEAR] (e.g. CAMP-Gemini-Mar26). Otherwise "STANDALONE". This is a rough hint — a global grouper will refine it.
- dest_ultimate: the CATEGORY of final destination being promoted. Use one of these standard buckets — pick the closest match: "Paid course / program", "Paid community membership", "Newsletter / Substack signup", "Free community (WhatsApp/Telegram)", "YouTube channel growth", "Podcast listen", "Webinar / workshop registration", "Free guide / resource download", "Tool adoption (free)", "Tool adoption (paid)", "Brand / awareness only", "Other paid product". Do NOT invent new categories. If the post promotes a specific creator-owned newsletter, guide site, or Substack — use "Newsletter / Substack signup". If unclear write "Brand / awareness only".
- dest_immediate: the very next action the viewer is directed to take. Examples: "Comment keyword for DM link", "Link in bio → YouTube", "Link in post → landing page", "Follow account", "Watch video", "No CTA". Be concise (max 60 chars).
- sequence_position: one of ${SEQUENCE_POSITIONS.join(', ')} — where does this post sit in a campaign arc?
- hook_text_english: opening line of the post translated to English, max 120 chars
- body_summary_english: 1–2 sentence summary of the full post in English

Return a JSON array with exactly ${posts.length} objects in the same order as the posts above.
Return ONLY the JSON array, no markdown fences, no other text.

POSTS:
${postList}`
}

/**
 * Classifies an array of raw posts using AI.
 * @param {Array}    posts      - raw scraped posts
 * @param {Object}   options
 * @param {Function} options.onProgress - callback(message)
 * @returns {Array} posts with classification fields merged in
 */
async function classifyPosts(posts, { onProgress } = {}) {
  if (!posts || !posts.length) return []

  const client    = getLLMClient()
  const BATCH_SIZE = 10
  const results   = []

  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE)
    onProgress?.(`Classifying posts ${i + 1}–${Math.min(i + BATCH_SIZE, posts.length)} of ${posts.length}...`)

    const MAX_RETRIES = 3
    let batchDone = false
    for (let attempt = 1; attempt <= MAX_RETRIES && !batchDone; attempt++) {
      try {
        const prompt   = buildClassifyPrompt(batch)
        const response = await client.generate(prompt)

        // Strip markdown fences if present
        let jsonStr = response.trim()
        if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
        }
        const jsonMatch = jsonStr.match(/\[[\s\S]*\]/)
        if (!jsonMatch) throw new Error('No JSON array found in response')
        const classifications = JSON.parse(jsonMatch[0])

        if (!Array.isArray(classifications) || classifications.length !== batch.length) {
          throw new Error(`Expected ${batch.length} classifications, got ${classifications?.length ?? 0}`)
        }

        results.push(...batch.map((post, j) => ({
          ...post,
          ...sanitizeClassification(classifications[j]),
        })))
        batchDone = true
      } catch (err) {
        const is503 = err.message && err.message.includes('503')
        if (is503 && attempt < MAX_RETRIES) {
          const delay = attempt * 8000 // 8s, 16s
          console.warn(`[AI Analyzer] Batch ${i}–${i + BATCH_SIZE} got 503, retrying in ${delay / 1000}s (attempt ${attempt}/${MAX_RETRIES})...`)
          await new Promise(r => setTimeout(r, delay))
        } else {
          console.error(`[AI Analyzer] Batch ${i}–${i + BATCH_SIZE} failed:`, err.message)
          results.push(...batch.map(post => ({ ...post, ...emptyClassification() })))
          batchDone = true
        }
      }
    }

    if (i + BATCH_SIZE < posts.length) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  onProgress?.(`Classification complete: ${results.length} posts`)
  return results
}

function sanitizeClassification(raw) {
  if (!raw || typeof raw !== 'object') return emptyClassification()
  return {
    hook_type:            validateEnum(raw.hook_type, HOOK_TYPES, 'OTHER'),
    intent:               validateEnum(raw.intent, INTENT_TYPES, 'GIVE-VALUE'),
    cta_method:           validateEnum(raw.cta_method, CTA_TYPES, 'NONE'),
    campaign_id:          sanitizeString(raw.campaign_id, 'STANDALONE'),
    dest_ultimate:        sanitizeString(raw.dest_ultimate, 'Awareness only'),
    dest_immediate:       sanitizeString(raw.dest_immediate, ''),
    sequence_position:    validateEnum(raw.sequence_position, SEQUENCE_POSITIONS, 'STANDALONE'),
    hook_text_english:    sanitizeString(raw.hook_text_english, ''),
    body_summary_english: sanitizeString(raw.body_summary_english, ''),
  }
}

function emptyClassification() {
  return {
    hook_type: 'OTHER', intent: 'GIVE-VALUE', cta_method: 'NONE',
    campaign_id: 'STANDALONE', dest_ultimate: 'Awareness only',
    dest_immediate: '', sequence_position: 'STANDALONE',
    hook_text_english: '', body_summary_english: '',
  }
}

function validateEnum(value, options, fallback) {
  if (typeof value === 'string' && options.includes(value.toUpperCase())) return value.toUpperCase()
  return fallback
}

function sanitizeString(value, fallback) {
  return typeof value === 'string' ? value.trim() : fallback
}

module.exports = { classifyPosts }
