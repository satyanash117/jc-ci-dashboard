/**
 * ai-summary-generator.js — Generates ai_summary.json for a competitor
 *
 * Produces:
 *   - funnel nodes (for Executive Summary)
 *   - campaignIntel (for Campaigns view)
 *   - opportunities.channelGaps / topicGaps / structuralGaps (for Opportunity view)
 *   - campaignNames / campaignSells (for Executive Summary campaign headers)
 *
 * Only regenerates if post count has grown by >20 since last generation.
 */

const fs   = require('fs')
const path = require('path')

const DASH_DATA = path.join(__dirname, '..', 'output', 'dashboard')

function getLLMClient() {
  try {
    const { getLLMClient: get } = require('../analysis/analyzer.js')
    return get()
  } catch {
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

function buildSummaryPrompt(competitorName, posts) {
  // Compute top-level stats for the prompt
  const channels = {}
  const intents  = {}
  const hooks    = {}
  const ctas     = {}
  const campaigns = {}
  const destinations = {}

  for (const p of posts) {
    if (p.channel) channels[p.channel] = (channels[p.channel] || 0) + 1
    if (p.intent && p.intent !== 'GIVE-VALUE') intents[p.intent] = (intents[p.intent] || 0) + 1
    if (p.hook_type && p.hook_type !== 'OTHER') hooks[p.hook_type] = (hooks[p.hook_type] || 0) + 1
    if (p.cta_method && p.cta_method !== 'NONE') ctas[p.cta_method] = (ctas[p.cta_method] || 0) + 1
    if (p.campaign_id && p.campaign_id !== 'STANDALONE') {
      if (!campaigns[p.campaign_id]) campaigns[p.campaign_id] = { count: 0, posts: [] }
      campaigns[p.campaign_id].count++
      campaigns[p.campaign_id].posts.push(p)
    }
    if (p.dest_ultimate && p.dest_ultimate !== 'NONE' && p.dest_ultimate !== 'False') {
      destinations[p.dest_ultimate] = (destinations[p.dest_ultimate] || 0) + 1
    }
  }

  const topChannels = Object.entries(channels).sort((a,b)=>b[1]-a[1]).slice(0,5)
  const topDests    = Object.entries(destinations).sort((a,b)=>b[1]-a[1]).slice(0,5)
  const topCamps    = Object.entries(campaigns).sort((a,b)=>b[1].count-a[1].count).slice(0,8)

  const campSummaries = topCamps.map(([id, d]) => {
    const sells = d.posts.map(p => p.dest_ultimate).filter(Boolean).slice(0,3).join(', ')
    const chans = [...new Set(d.posts.map(p => p.channel))].join(', ')
    const sample = d.posts[0]?.hook_text_english || d.posts[0]?.hook_text_hebrew || ''
    return `- ${id}: ${d.count} posts, channels: ${chans}, sells to: ${sells || 'unknown'}, sample hook: "${sample.slice(0,80)}"`
  }).join('\n')

  return `You are a competitive intelligence analyst. Analyze this competitor's social media data and generate a structured JSON summary.

COMPETITOR: ${competitorName}
TOTAL POSTS: ${posts.length}

TOP CHANNELS (by post count):
${topChannels.map(([ch, n]) => `- ${ch}: ${n} posts`).join('\n')}

TOP DESTINATIONS (where audience is sent):
${topDests.map(([d, n]) => `- ${d}: ${n} posts`).join('\n')}

TOP CAMPAIGNS DETECTED:
${campSummaries || 'No campaigns detected'}

Generate a JSON object with EXACTLY this structure:
{
  "funnel": [
    {
      "id": "step1",
      "label": "Short label (3-5 words)",
      "sublabel": "Platform or detail (1 line)",
      "color": "#hexcolor",
      "desc": "2-3 sentences explaining what this funnel step does for the competitor"
    }
  ],
  "campaignIntel": {
    "CAMP-ID": {
      "title": "Human-readable campaign name",
      "description": "2-3 sentence description of what this campaign was about, how it was structured, and what it sold",
      "sells": "What product/service was being sold",
      "arc": [
        {
          "beat": "Phase name (e.g. 'Announcement')",
          "color": "#hexcolor",
          "desc": "1-2 sentence description of what happened in this phase"
        }
      ]
    }
  },
  "campaignNames": {
    "CAMP-ID": "Human-readable campaign name"
  },
  "campaignSells": {
    "CAMP-ID": "What is being sold"
  },
  "opportunities": {
    "channelGaps": [
      {
        "id": "unique_id",
        "title": "Gap title (1 line)",
        "type": "channel",
        "severity": "high|medium|low",
        "insight": "2-3 sentences describing the gap",
        "opportunity": "1-2 sentences on the opportunity",
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
- funnel: 3-6 nodes showing the competitor's traffic flow from awareness to conversion
- campaignIntel: only for campaigns with 3+ posts; keep descriptions factual and based on data
- opportunities: 2-4 items per category; base on actual data patterns, not speculation
- Use hex colors from this palette: #38BDF8 #34D399 #FBBF24 #F43F5E #A78BFA #F97316 #22D3EE #F472B6 #60A5FA
- Return ONLY valid JSON, no markdown fences, no extra text`
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

  // Check if we need to regenerate
  if (fs.existsSync(outPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'))
      const prevCount = existing._postCount || 0
      if (posts.length - prevCount < 20) {
        console.log(`[Summary] ${competitorName}: no regeneration needed (${posts.length - prevCount} new posts since last run)`)
        return existing
      }
    } catch {}
  }

  console.log(`[Summary] Generating AI summary for ${competitorName} (${posts.length} posts)...`)

  try {
    const client = getLLMClient()
    const prompt = buildSummaryPrompt(competitorName, posts)
    const response = await client.generate(prompt)

    // Parse response — handle markdown fences if present
    let jsonStr = response.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const summary = JSON.parse(jsonStr)

    // Add metadata
    summary.generatedAt = new Date().toISOString()
    summary._postCount  = posts.length
    summary._competitor = competitorSlug

    fs.mkdirSync(outDir, { recursive: true })
    fs.writeFileSync(outPath, JSON.stringify(summary, null, 2))
    console.log(`[Summary] ✓ ${competitorName}: ai_summary.json written`)
    return summary
  } catch (err) {
    console.error(`[Summary] Failed for ${competitorName}:`, err.message)
    return null
  }
}

module.exports = { generateAISummary }
