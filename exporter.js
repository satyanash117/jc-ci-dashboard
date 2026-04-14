/**
 * exporter.js — Converts spy job results + classified posts to dashboard JSON
 *
 * Output directory: output/dashboard/{slug}/
 * Files written:
 *   organic_posts.json
 *   community_posts.json  (empty array — scrapers don't produce community posts)
 *   admin_posts.json      (empty array)
 *   curriculum.json       (empty array)
 *   paid_ads.json         (empty array)
 */

const fs   = require('fs')
const path = require('path')

const OUT_BASE = path.join(__dirname, '..', 'output', 'dashboard')

/**
 * Converts a raw scraped post to the dashboard organic_posts schema.
 */
function mapToOrganicPost(raw, competitorSlug, platform, idx) {
  // raw is from the scraper's posts array — field names vary by platform
  const text    = raw.caption || raw.text || raw.content || raw.description || ''
  const hook    = raw.hook_text_english || raw.hook || text.split('\n')[0].slice(0, 200)
  const date    = raw.date || raw.timestamp || raw.date_normalized || ''
  const dateNorm = normalizeDate(date)

  return {
    // Required ID
    id:                 raw.id || raw.post_id || `${platform}-${competitorSlug}-${idx + 1}`,

    // Competitor / channel
    competitor:         competitorSlug,
    channel:            mapPlatform(platform),

    // Dates
    date_normalized:    dateNorm,
    day_of_week:        dateNorm ? getDayOfWeek(dateNorm) : '',

    // Author (scrapers may not capture this for non-Eden competitors)
    post_author:        raw.author || raw.username || competitorSlug,
    post_author_is_eden:'NO',

    // Content
    hook_text_english:  raw.hook_text_english || hook,
    hook_text_hebrew:   raw.hook_text_hebrew  || '',
    full_text_english:  raw.full_text_english || (isHebrew(text) ? '' : text),
    full_text_hebrew:   raw.full_text_hebrew  || (isHebrew(text) ? text : ''),
    body_summary_english: raw.body_summary_english || '',

    // Engagement
    likes:              String(raw.likes    || raw.like_count    || 0),
    comments:           String(raw.comments || raw.comment_count || 0),
    shares:             String(raw.shares   || raw.share_count   || 0),
    views:              String(raw.views    || raw.view_count    || raw.plays || 0),
    followers:          String(raw.followers || ''),

    // Classification (from AI analyzer or raw if pre-classified)
    hook_type:          raw.hook_type    || 'OTHER',
    intent:             raw.intent       || 'GIVE-VALUE',
    cta_method:         raw.cta_method   || 'NONE',
    campaign_id:        raw.campaign_id  || 'STANDALONE',

    // Media
    media_format:       raw.media_format || mapMediaFormat(raw),
    image_url:          raw.image_url    || raw.thumbnail_url || '',
    image_description:  raw.image_description || '',
    visual_type:        raw.visual_type  || '',

    // Funnel
    dest_immediate:     raw.dest_immediate || '',
    dest_ultimate:      raw.dest_ultimate  || '',
    dest_url:           raw.dest_url || raw.link || raw.url || '',

    // Meta
    post_url:           raw.post_url || raw.url || raw.link || '',
    source_file:        `spy_agent_${platform}`,
    post_language:      raw.post_language || (isHebrew(text) ? 'he' : 'en'),
    emoji_count:        String(countEmojis(text)),
  }
}

/**
 * Exports spy job results to dashboard JSON files.
 * Merges with any existing data (incremental — no duplicates).
 *
 * @param {Object} jobResults - { results: { [competitorName]: { [platform]: { posts } } } }
 * @param {Array}  classifiedPosts - flat array of classified posts from ai-post-analyzer
 * @param {Object} config - { competitors: [{ name, handles }] }
 * @returns {Array} competitorSlugs that were exported
 */
function exportToDashboard(jobResults, classifiedPosts, config) {
  const exported = []

  for (const competitor of (config.competitors || [])) {
    const name = competitor.name
    const slug = toSlug(name)
    const outDir = path.join(OUT_BASE, slug)
    fs.mkdirSync(outDir, { recursive: true })

    // Gather new posts for this competitor from classified list
    const newPosts = classifiedPosts.filter(p =>
      p.competitor === slug ||
      p.competitorName === name ||
      p._competitorSlug === slug
    )

    if (!newPosts.length) {
      console.log(`[Exporter] No posts for ${name} — skipping`)
      continue
    }

    // Load existing data (incremental)
    const existingPath = path.join(outDir, 'organic_posts.json')
    let existing = []
    if (fs.existsSync(existingPath)) {
      try { existing = JSON.parse(fs.readFileSync(existingPath, 'utf8')) } catch {}
    }

    // Deduplicate by post_url or id
    const existingKeys = new Set(existing.map(p => p.post_url || p.id).filter(Boolean))
    const fresh = newPosts.filter(p => {
      const key = p.post_url || p.id
      return !key || !existingKeys.has(key)
    })

    if (!fresh.length) {
      console.log(`[Exporter] No new posts for ${name} (all already exist)`)
      continue
    }

    const merged = [...existing, ...fresh]
      .sort((a, b) => {
        if (!a.date_normalized || !b.date_normalized) return 0
        return b.date_normalized.localeCompare(a.date_normalized)
      })

    // Write organic_posts.json
    fs.writeFileSync(path.join(outDir, 'organic_posts.json'), JSON.stringify(merged, null, 2))

    // Write placeholder files if they don't exist
    for (const file of ['community_posts.json', 'admin_posts.json', 'curriculum.json', 'paid_ads.json']) {
      const filePath = path.join(outDir, file)
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify([]))
      }
    }

    console.log(`[Exporter] ${name}: +${fresh.length} new posts (${merged.length} total) → ${outDir}`)
    exported.push({ slug, name, postCount: merged.length, newCount: fresh.length })
  }

  return exported
}

/**
 * Prepares classified posts from raw spy job output.
 * Call this BEFORE exportToDashboard to flatten + tag posts by competitor.
 */
function preparePostsForExport(jobResults, config, classifiedPosts) {
  const flat = []

  for (const competitor of (config.competitors || [])) {
    const name = competitor.name
    const slug = toSlug(name)
    const competitorResults = jobResults.results?.[name] || {}

    let idx = 0
    for (const [platform, platformData] of Object.entries(competitorResults)) {
      const rawPosts = platformData.posts || []
      for (const raw of rawPosts) {
        // Find matching classified post (by index or URL)
        const classified = classifiedPosts.find(cp =>
          (cp._originalIndex === idx) ||
          (cp.post_url && cp.post_url === (raw.post_url || raw.url))
        ) || {}

        flat.push({
          ...mapToOrganicPost(raw, slug, platform, idx),
          ...classified,
          competitor: slug,
          _competitorSlug: slug,
          competitorName: name,
        })
        idx++
      }
    }
  }

  return flat
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

function mapPlatform(platform) {
  const map = {
    instagram: 'instagram', linkedin: 'linkedin',
    facebook: 'fb_personal', fb_personal: 'fb_personal',
    tiktok: 'tiktok', youtube: 'youtube',
    twitter: 'twitter', x: 'twitter',
  }
  return map[platform?.toLowerCase()] || platform?.toLowerCase() || 'unknown'
}

function normalizeDate(raw) {
  if (!raw) return ''
  // Handle various formats
  const d = new Date(raw)
  if (!isNaN(d)) return d.toISOString().slice(0, 10)
  // Try DD/MM/YYYY
  const ddmm = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/)
  if (ddmm) {
    const [, dd, mm, yy] = ddmm
    const year = yy.length === 2 ? '20' + yy : yy
    return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  return ''
}

function getDayOfWeek(dateStr) {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const d = new Date(dateStr)
  return isNaN(d) ? '' : days[d.getDay()]
}

function mapMediaFormat(raw) {
  if (raw.is_video || raw.video_url || raw.type === 'video') return 'VIDEO-SHORT'
  if (raw.is_carousel || raw.type === 'carousel') return 'CAROUSEL'
  if (raw.image_url || raw.thumbnail) return 'STATIC-IMAGE'
  return 'TEXT-ONLY'
}

function isHebrew(text) {
  return /[\u0590-\u05FF]/.test(text || '')
}

function countEmojis(text) {
  const matches = (text || '').match(/\p{Emoji}/gu)
  return matches ? matches.length : 0
}

module.exports = { exportToDashboard, preparePostsForExport, toSlug }
