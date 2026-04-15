/**
 * ai-campaign-grouper.js — Global campaign-ID coherence pass
 *
 * Problem this solves:
 *   The per-post classifier (ai-post-analyzer.js) processes posts in batches
 *   of 10, so a 14-post launch arc that ran over 3 weeks gets 2–3 different
 *   campaign_id values depending on which batch each post fell into.
 *
 * What this does:
 *   After all posts are classified, takes the FULL post list for one competitor
 *   and runs a single LLM call that sees a compressed summary of every post
 *   (date + channel + dest_ultimate + hook_text_english + sequence_position).
 *   The LLM groups them into coherent campaigns and returns a mapping of
 *   post_index → campaign_id that we apply on top of the per-batch labels.
 *
 * Campaign definition used in the prompt:
 *   A campaign = 3 or more posts across ≤60 days that share the same
 *   ultimate destination OR the same clear promotional theme/series.
 *   e.g. "all 8 posts promoting a webinar launch", "5 posts in a YouTube
 *   series with the same CTA to subscribe", "10 posts building up to a
 *   course open-cart period".
 *
 * Usage:
 *   const { groupCampaigns } = require('./ai-campaign-grouper')
 *   const updatedPosts = await groupCampaigns(competitorName, classifiedPosts, { onProgress })
 */

'use strict'

// Dashboard campaign grouping uses Claude Sonnet — needs strong reasoning to
// identify coherent campaign arcs across a full post history.
function getLLMClient() {
  const Anthropic = require('@anthropic-ai/sdk')
  const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY })
  return {
    provider: 'claude',
    async generate(prompt) {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      })
      return msg.content[0].text
    },
  }
}

/**
 * Builds the prompt. We compress each post to one line to stay within token
 * limits even for 126-post histories.
 */
function buildGroupingPrompt(competitorName, posts) {
  // One line per post: index | date | channel | sequence_position | dest_ultimate | hook summary
  const lines = posts.map((p, i) => {
    const date  = p.date_normalized || p.date || p.timestamp || '?'
    const ch    = p.channel || p._platform || '?'
    const seq   = p.sequence_position || '?'
    const dest  = (p.dest_ultimate || 'unknown').slice(0, 60)
    const hook  = (p.hook_text_english || p.caption || p.text || '').slice(0, 80)
    return `${i}\t${date}\t${ch}\t${seq}\t${dest}\t${hook}`
  }).join('\n')

  return `You are a social media campaign analyst. Below is every post from competitor "${competitorName}", one per line.

Format: INDEX\tDATE\tCHANNEL\tSEQUENCE_POSITION\tDEST_ULTIMATE\tHOOK_SUMMARY

${lines}

Your task: identify coherent CAMPAIGNS and assign consistent campaign IDs.

Rules:
1. A campaign = 3 or more posts that share the same ultimate destination OR the same clear promotional series/theme, posted within a 60-day window.
2. Campaign ID format: CAMP-[SHORT-TOPIC]-[Mon][YY]  e.g. CAMP-AI-Webinar-Mar26, CAMP-YouTube-Series-Jan26
3. Posts that don't belong to any campaign: assign "STANDALONE"
4. Be conservative — only group posts you are confident share a campaign. Do not force groupings.
5. Each campaign must have at least 3 posts; if a group you identified has fewer than 3, assign those posts "STANDALONE".

Return a JSON object mapping each post INDEX (as a string key) to its campaign_id string.
Example: {"0": "CAMP-YouTube-Series-Jan26", "1": "STANDALONE", "2": "CAMP-YouTube-Series-Jan26", ...}

Return ONLY the JSON object, no markdown fences, no commentary.`
}

/**
 * Runs the global campaign grouping pass for one competitor's posts.
 *
 * @param {string}   competitorName - human-readable name for logging
 * @param {Array}    posts          - array of classified post objects (must have date, channel, dest_ultimate, hook_text_english)
 * @param {Object}   options
 * @param {Function} options.onProgress - optional callback(message)
 * @returns {Array} same posts array with campaign_id overwritten by globally coherent IDs
 */
async function groupCampaigns(competitorName, posts, { onProgress } = {}) {
  if (!posts || posts.length < 3) {
    // Not enough posts to form even one campaign
    return posts
  }

  onProgress?.(`[Campaign Grouper] Grouping ${posts.length} posts for ${competitorName}...`)

  try {
    const client   = getLLMClient()
    const prompt   = buildGroupingPrompt(competitorName, posts)
    const response = await client.generate(prompt)

    // Strip markdown fences if present
    let jsonStr = response.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    // Extract the first {...} block
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON object in response')

    const mapping = JSON.parse(jsonMatch[0])

    // Validate: should be an object with string keys that are integers
    if (typeof mapping !== 'object' || Array.isArray(mapping)) {
      throw new Error('Response is not a plain object')
    }

    // Apply the mapping — overwrite campaign_id on each post
    let updated = 0
    const result = posts.map((post, i) => {
      const newId = mapping[String(i)]
      if (!newId || typeof newId !== 'string') return post
      const clean = sanitizeCampaignId(newId)
      if (clean !== post.campaign_id) updated++
      return { ...post, campaign_id: clean }
    })

    onProgress?.(`[Campaign Grouper] ${competitorName}: ${updated} posts reassigned to coherent campaigns`)
    logCampaignSummary(competitorName, result)
    return result

  } catch (err) {
    console.error(`[Campaign Grouper] Failed for ${competitorName}:`, err.message)
    onProgress?.(`[Campaign Grouper] Skipped for ${competitorName} (${err.message}) — per-batch IDs kept`)
    return posts // fall back to whatever per-batch labelled
  }
}

/** Log a quick summary of detected campaigns for debugging */
function logCampaignSummary(competitorName, posts) {
  const counts = {}
  for (const p of posts) {
    const id = p.campaign_id || 'STANDALONE'
    counts[id] = (counts[id] || 0) + 1
  }
  const campaigns = Object.entries(counts)
    .filter(([id]) => id !== 'STANDALONE')
    .sort((a, b) => b[1] - a[1])
  if (campaigns.length) {
    console.log(`[Campaign Grouper] ${competitorName} — detected campaigns:`)
    campaigns.forEach(([id, n]) => console.log(`  ${id}: ${n} posts`))
  } else {
    console.log(`[Campaign Grouper] ${competitorName} — no campaigns detected (all STANDALONE)`)
  }
}

function sanitizeCampaignId(raw) {
  const s = String(raw).trim()
  // Must be STANDALONE or match CAMP-...-... pattern (allow reasonable chars)
  if (s === 'STANDALONE') return 'STANDALONE'
  if (/^CAMP-[A-Za-z0-9]/.test(s)) return s.slice(0, 60)
  return 'STANDALONE'
}

module.exports = { groupCampaigns }
