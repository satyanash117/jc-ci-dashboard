/**
 * ai-summary-generator.js — Generates ai_summary.json for a competitor
 *
 * Produces:
 *   - funnel nodes (for Executive Summary)
 *   - campaignIntel (for Campaigns view)
 *   - opportunities.channelGaps / topicGaps / structuralGaps (for Opportunity view)
 *   - campaignNames / campaignSells (for Executive Summary campaign headers)
 *
 * Regeneration rules:
 *   - Always generates on first run (no existing ai_summary.json)
 *   - Regenerates if 10+ new posts since last generation (was 20, lowered for
 *     smaller competitors like Ruben Hassid / Jeff Su)
 *   - Regenerates if campaign structure changed (new campaign IDs detected)
 */

const fs   = require('fs')
const path = require('path')

const DASH_DATA = path.join(__dirname, '..', 'output', 'dashboard')
// Min new posts before forcing a regeneration on an already-summarised competitor
const REGEN_THRESHOLD = 10

// Dashboard summaries use Claude Sonnet — needs strong analytical reasoning to
// generate accurate funnel maps, campaign intel, and opportunity analysis.
function getLLMClient() {
  const Anthropic = require('@anthropic-ai/sdk')
  const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY })
  return {
    provider: 'claude',
    async generate(prompt) {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 32000,
        messages: [{ role: 'user', content: prompt }],
      })
      return msg.content[0].text
    },
  }
}

function buildSummaryPrompt(competitorName, posts) {
  const channels     = {}
  const intents      = {}
  const hooks        = {}
  const ctas         = {}
  const campaigns    = {}
  const destinations = {}
  const sequences    = {}

  for (const p of posts) {
    if (p.channel)    channels[p.channel]   = (channels[p.channel]   || 0) + 1
    if (p.intent && p.intent !== 'GIVE-VALUE')
                      intents[p.intent]     = (intents[p.intent]     || 0) + 1
    if (p.hook_type && p.hook_type !== 'OTHER')
                      hooks[p.hook_type]    = (hooks[p.hook_type]    || 0) + 1
    if (p.cta_method && p.cta_method !== 'NONE')
                      ctas[p.cta_method]    = (ctas[p.cta_method]    || 0) + 1
    if (p.sequence_position && p.sequence_position !== 'STANDALONE')
                      sequences[p.sequence_position] = (sequences[p.sequence_position] || 0) + 1

    if (p.campaign_id && p.campaign_id !== 'STANDALONE') {
      if (!campaigns[p.campaign_id]) campaigns[p.campaign_id] = { count: 0, posts: [] }
      campaigns[p.campaign_id].count++
      campaigns[p.campaign_id].posts.push(p)
    }

    // dest_ultimate: use the richer field if available, fall back to dest_url
    const dest = p.dest_ultimate || ''
    if (dest && dest !== 'Awareness only' && dest !== 'NONE' && dest !== 'False') {
      destinations[dest] = (destinations[dest] || 0) + 1
    }
  }

  const topChannels = Object.entries(channels).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const topDests    = Object.entries(destinations).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const topHooks    = Object.entries(hooks).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const topCTAs     = Object.entries(ctas).sort((a, b) => b[1] - a[1]).slice(0, 4)

  // Campaigns with 3+ posts, richly described
  const topCamps = Object.entries(campaigns)
    .filter(([, d]) => d.count >= 3)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)

  const campSummaries = topCamps.map(([id, d]) => {
    const dests    = [...new Set(d.posts.map(p => p.dest_ultimate).filter(Boolean))].slice(0, 2).join(' / ')
    const immed    = [...new Set(d.posts.map(p => p.dest_immediate).filter(Boolean))].slice(0, 2).join(' / ')
    const chans    = [...new Set(d.posts.map(p => p.channel))].join(', ')
    const seqs     = d.posts.map(p => p.sequence_position).filter(Boolean)
    const seqSet   = [...new Set(seqs)].join(', ')
    const dates    = d.posts.map(p => p.date_normalized).filter(Boolean).sort()
    const dateRange = dates.length ? `${dates[0]} → ${dates[dates.length - 1]}` : 'unknown dates'
    const sampleHook = (d.posts[0]?.hook_text_english || d.posts[0]?.hook_text_hebrew || '').slice(0, 100)
    return `- ${id}: ${d.count} posts | ${dateRange} | channels: ${chans} | sequence beats: ${seqSet} | ultimate dest: ${dests || 'unknown'} | immediate CTA: ${immed || 'unknown'} | sample hook: "${sampleHook}"`
  }).join('\n')

  return `You are a competitive intelligence analyst. Analyse this competitor's social media data and produce a structured JSON summary.

COMPETITOR: ${competitorName}
TOTAL POSTS: ${posts.length}

TOP CHANNELS (by post count):
${topChannels.map(([ch, n]) => `- ${ch}: ${n} posts`).join('\n')}

TOP DESTINATIONS (ultimate product/service posts drive to):
${topDests.map(([d, n]) => `- ${d}: ${n} posts`).join('\n')}

TOP HOOK TYPES:
${topHooks.map(([h, n]) => `- ${h}: ${n} posts`).join('\n')}

TOP CTA METHODS:
${topCTAs.map(([c, n]) => `- ${c}: ${n} posts`).join('\n')}

CAMPAIGNS DETECTED (3+ posts each):
${campSummaries || 'No campaigns detected — all posts are standalone value content'}

Generate a JSON object with EXACTLY this structure:

{
  "funnel": [
    {
      "id": "step1",
      "label": "Short label (3-5 words)",
      "sublabel": "Platform or detail (1 line)",
      "color": "#hexcolor",
      "desc": "2-3 sentences explaining what this funnel step does — be specific to this competitor's actual strategy"
    }
  ],
  "campaignIntel": {
    "CAMP-ID": {
      "title": "Human-readable campaign name (e.g. 'January YouTube Series Launch')",
      "description": "2-3 sentences describing the campaign: what it promoted, how it was structured across the arc (teaser → launch → value → urgency), what CTA mechanics were used",
      "sells": "Specific product or destination being sold",
      "arc": [
        {
          "beat": "Phase name matching sequence_position (e.g. 'TEASER', 'LAUNCH', 'VALUE', 'URGENCY')",
          "color": "#hexcolor",
          "desc": "1-2 sentences on what happened in this phase and how many posts"
        }
      ]
    }
  },
  "campaignNames": {
    "CAMP-ID": "Human-readable campaign name"
  },
  "campaignSells": {
    "CAMP-ID": "What specific product/service is being sold"
  },
  "opportunities": {
    "channelGaps": [
      {
        "id": "unique_id",
        "title": "Gap title (1 line)",
        "type": "channel",
        "severity": "high|medium|low",
        "insight": "2-3 sentences describing the gap based on actual data",
        "opportunity": "1-2 sentences on the opportunity this creates for Eden Bibas",
        "how": "1-2 sentences on how to act on it",
        "evidence": []
      }
    ],
    "topicGaps": [
      {
        "id": "unique_id",
        "title": "Topic gap title",
        "severity": "high|medium|low",
        "insight": "2-3 sentences",
        "opportunity": "1-2 sentences",
        "how": "1-2 sentences",
        "evidence": []
      }
    ],
    "structuralGaps": [
      {
        "id": "unique_id",
        "title": "Structural gap title",
        "insight": "2-3 sentences",
        "opportunity": "1-2 sentences"
      }
    ]
  }
}

Rules:
- funnel: 3-6 nodes. Show the real flow this competitor uses from awareness to conversion based on the data above.
- campaignIntel: only for campaigns with 3+ posts. The arc beats MUST match the actual sequence_position values seen in that campaign. Be factual.
- opportunities: 2-4 items per category. Base every item on the actual patterns in this competitor's data. Each opportunity should be actionable for Eden Bibas.
- Use hex colors from: #38BDF8 #34D399 #FBBF24 #F43F5E #A78BFA #F97316 #22D3EE #F472B6 #60A5FA #4ADE80
- Return ONLY valid JSON, no markdown fences, no extra text`
}

/**
 * Determines whether the summary needs to be regenerated.
 * Returns { shouldRegen: bool, reason: string }
 */
function checkRegenNeeded(outPath, posts) {
  // Always generate if no file exists yet
  if (!fs.existsSync(outPath)) {
    return { shouldRegen: true, reason: 'first run' }
  }

  let existing
  try {
    existing = JSON.parse(fs.readFileSync(outPath, 'utf8'))
  } catch {
    return { shouldRegen: true, reason: 'corrupt existing file' }
  }

  // Regenerate if enough new posts
  const prevCount = existing._postCount || 0
  const newPosts  = posts.length - prevCount
  if (newPosts >= REGEN_THRESHOLD) {
    return { shouldRegen: true, reason: `${newPosts} new posts since last run` }
  }

  // Regenerate if new campaign IDs have appeared that weren't in the last summary
  const currentCampIds = new Set(
    posts.map(p => p.campaign_id).filter(id => id && id !== 'STANDALONE')
  )
  const summarisedCampIds = new Set(Object.keys(existing.campaignIntel || {}))
  const newCamps = [...currentCampIds].filter(id => !summarisedCampIds.has(id))
  if (newCamps.length > 0) {
    return { shouldRegen: true, reason: `${newCamps.length} new campaign(s) detected: ${newCamps.join(', ')}` }
  }

  return { shouldRegen: false, reason: `only ${newPosts} new post(s) since last run, campaign structure unchanged` }
}

/**
 * Generates or updates ai_summary.json for a competitor.
 * @param {string} competitorSlug
 * @param {string} competitorName
 * @param {Array}  posts - current full post list for this competitor
 * @returns {Object|null} the generated summary, or null if skipped
 */
async function generateAISummary(competitorSlug, competitorName, posts) {
  if (!posts || posts.length < 10) {
    console.log(`[Summary] ${competitorName}: too few posts (${posts?.length ?? 0}) — skipping`)
    return null
  }

  const outDir  = path.join(DASH_DATA, competitorSlug)
  const outPath = path.join(outDir, 'ai_summary.json')

  const { shouldRegen, reason } = checkRegenNeeded(outPath, posts)
  if (!shouldRegen) {
    console.log(`[Summary] ${competitorName}: skipping regeneration — ${reason}`)
    return JSON.parse(fs.readFileSync(outPath, 'utf8'))
  }

  console.log(`[Summary] ${competitorName}: regenerating (${reason}) — ${posts.length} posts...`)

  try {
    const client   = getLLMClient()
    const prompt   = buildSummaryPrompt(competitorName, posts)
    const response = await client.generate(prompt)

    let jsonStr = response.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    // Extract outermost {...} block
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON object in response')

    const summary = JSON.parse(jsonMatch[0])

    summary.generatedAt  = new Date().toISOString()
    summary._postCount   = posts.length
    summary._competitor  = competitorSlug
    summary._regenReason = reason

    fs.mkdirSync(outDir, { recursive: true })
    fs.writeFileSync(outPath, JSON.stringify(summary, null, 2))
    console.log(`[Summary] ✓ ${competitorName}: ai_summary.json written (${Object.keys(summary.campaignIntel || {}).length} campaigns, ${(summary.funnel || []).length} funnel steps)`)
    return summary
  } catch (err) {
    console.error(`[Summary] Failed for ${competitorName}:`, err.message)
    return null
  }
}

module.exports = { generateAISummary }
