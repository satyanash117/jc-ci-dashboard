/**
 * ai-post-analyzer.js — Per-post AI classification for dashboard
 *
 * Takes raw scraped posts and classifies each one with:
 *   hook_type, intent, cta_method, campaign_id,
 *   hook_text_english, body_summary_english
 *
 * Batches in groups of 10 to respect LLM token limits.
 * Reuses getLLMClient() from analysis/analyzer.js.
 */

const path = require('path')

// Reuse the existing LLM client
function getLLMClient() {
  try {
    const { getLLMClient: get } = require('../analysis/analyzer.js')
    return get()
  } catch {
    // Fallback: build our own
    const provider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase()
    if (provider === 'gemini') {
      const { GoogleGenerativeAI } = require('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      return {
        provider: 'gemini',
        async generate(prompt) {
          const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
          const result = await model.generateContent(prompt)
          return result.response.text()
        },
      }
    }
    throw new Error(`LLM provider "${provider}" not configured`)
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

function buildClassifyPrompt(posts) {
  const postList = posts.map((p, i) => {
    const text = p.caption || p.text || p.content || p.hook || ''
    const channel = p.platform || p.channel || 'unknown'
    return `POST ${i + 1} [${channel}]:
${text.slice(0, 500)}
---`
  }).join('\n\n')

  return `You are a social media content analyst. Classify each of the following social media posts.

For each post, return a JSON object with these fields:
- hook_type: one of ${HOOK_TYPES.join(', ')}
- intent: one of ${INTENT_TYPES.join(', ')}
- cta_method: one of ${CTA_TYPES.join(', ')}
- campaign_id: if posts seem related to a launch/campaign, use format CAMP-[TOPIC]-[MONTH][YEAR] (e.g. CAMP-Gemini-Mar26). Otherwise "STANDALONE"
- hook_text_english: the opening line of the post translated to English (max 120 chars)
- body_summary_english: 1-2 sentence summary in English

Return a JSON array with exactly ${posts.length} objects, one per post, in the same order.
Only return the JSON array, no other text.

POSTS TO CLASSIFY:
${postList}`
}

/**
 * Classifies an array of raw posts using AI.
 * @param {Array} posts - raw scraped posts (must have text/caption/content field)
 * @param {Object} options
 * @param {Function} options.onProgress - callback(message)
 * @returns {Array} posts with classification fields merged in
 */
async function classifyPosts(posts, { onProgress } = {}) {
  if (!posts || !posts.length) return []

  const client = getLLMClient()
  const BATCH_SIZE = 10
  const results = []

  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE)
    onProgress?.(`Classifying posts ${i + 1}–${Math.min(i + BATCH_SIZE, posts.length)} of ${posts.length}...`)

    try {
      const prompt = buildClassifyPrompt(batch)
      const response = await client.generate(prompt)

      // Extract JSON from response (LLMs sometimes add markdown fences)
      const jsonMatch = response.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error('No JSON array found in response')
      const classifications = JSON.parse(jsonMatch[0])

      if (!Array.isArray(classifications) || classifications.length !== batch.length) {
        throw new Error(`Expected ${batch.length} classifications, got ${classifications?.length ?? 0}`)
      }

      results.push(...batch.map((post, j) => ({
        ...post,
        ...sanitizeClassification(classifications[j]),
      })))
    } catch (err) {
      console.error(`[AI Analyzer] Batch ${i}–${i + BATCH_SIZE} failed:`, err.message)
      // Fall back to unclassified posts for this batch
      results.push(...batch.map(post => ({ ...post, ...emptyClassification() })))
    }

    // Rate limit: small pause between batches
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
    hook_type:           validateEnum(raw.hook_type, HOOK_TYPES, 'OTHER'),
    intent:              validateEnum(raw.intent, INTENT_TYPES, 'GIVE-VALUE'),
    cta_method:          validateEnum(raw.cta_method, CTA_TYPES, 'NONE'),
    campaign_id:         sanitizeString(raw.campaign_id, 'STANDALONE'),
    hook_text_english:   sanitizeString(raw.hook_text_english, ''),
    body_summary_english:sanitizeString(raw.body_summary_english, ''),
  }
}

function emptyClassification() {
  return {
    hook_type: 'OTHER', intent: 'GIVE-VALUE', cta_method: 'NONE',
    campaign_id: 'STANDALONE', hook_text_english: '', body_summary_english: '',
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
