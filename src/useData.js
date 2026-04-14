import { useState, useEffect } from 'react'

export const CHANNEL_LABELS = {
  fb_personal: 'FB Personal',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  threads: 'Threads',
  whatsapp: 'WhatsApp',
  email: 'Email',
  fb_group: 'FB Group',
}

export const CHANNEL_META = {
  fb_personal: { color: '#F97316', followers: 38000,  erMethod: 'follower' },
  linkedin:    { color: '#0A66C2', followers: 31061,  erMethod: 'follower' },
  instagram:   { color: '#E1306C', followers: 68400,  erMethod: 'follower' },
  tiktok:      { color: '#25F4EE', followers: 24100,  erMethod: 'follower' },
  youtube:     { color: '#FF0000', followers: 7500,   erMethod: 'follower' },
  threads:     { color: '#A78BFA', followers: 4100,   erMethod: 'follower', dead: true },
  whatsapp:    { color: '#25D366', followers: 984,    erMethod: 'na' },
  email:       { color: '#6366F1', followers: null,   erMethod: 'na' },
  fb_group:    { color: '#FBBF24', followers: 192800, erMethod: 'group' },
}

export const HOOK_COLORS = {
  'SHOCK':           '#F43F5E',
  'NEWS-BREAK':      '#FBBF24',
  'CURIOSITY-GAP':   '#22D3EE',
  'FOMO':            '#F97316',
  'CONTRARIAN':      '#F472B6',
  'SOCIAL-PROOF':    '#34D399',
  'NUMBER-LISTICLE': '#60A5FA',
  'PERSONAL-STORY':  '#A78BFA',
  'AUTHORITY':       '#818CF8',
  'QUESTION':        '#67E8F9',
  'NOVELTY':         '#4ADE80',
  'HOW-TO':          '#FCD34D',
}

export const INTENT_COLORS = {
  'GIVE-VALUE':         '#34D399',
  'SOFT-SELL':          '#FB923C',
  'HARD-SELL':          '#F43F5E',
  'URGENCY':            '#F97316',
  'SOCIAL-PROOF':       '#60A5FA',
  'WARM-UP':            '#A78BFA',
  'COMMUNITY-BUILDING': '#22D3EE',
  'AUTHORITY':          '#818CF8',
}

export const CTA_COLORS = {
  'COMMENT-KEYWORD':    '#F472B6',
  'LINK-IN-COMMENT':    '#60A5FA',
  'COMMENT-TO-RECEIVE': '#F97316',
  'LINK-IN-POST':       '#34D399',
  'LINK-IN-BODY':       '#6366F1',
  'NONE':               '#374151',
  'ENGAGEMENT-QUESTION':'#22D3EE',
  'BIO-LINK':           '#FBBF24',
  'WHATSAPP-JOIN':      '#25D366',
}

function computeER(row) {
  const ch = row.channel
  const meta = CHANNEL_META[ch]
  if (!meta) return { er: null, method: 'unknown' }

  const clean = v => parseFloat((v || '').toString().replace(/,/g, '')) || 0
  const likes    = clean(row.likes)
  const comments = clean(row.comments)
  const shares   = clean(row.shares)
  const views    = clean(row.views)
  const postFollowers = clean(row.followers)

  switch (meta.erMethod) {
    case 'follower': {
      const f = postFollowers > 0 ? postFollowers : meta.followers
      if (!f) return { er: null, method: 'no follower count' }
      return { er: ((likes + comments + shares) / f * 100), method: `(L+C+S)/${f}×100` }
    }
    case 'view': {
      if (!views) return { er: null, method: 'view-based (no views)' }
      return { er: ((likes + comments + shares) / views * 100), method: `(L+C+S)/${views}×100` }
    }
    case 'group': {
      const gm = postFollowers > 0 ? postFollowers : (meta.followers ?? 192800)
      return { er: ((likes + comments) / gm * 100), method: `(L+C)/${gm}×100 (estimated)`, estimated: true }
    }
    case 'raw':
      return { er: null, method: 'raw only (followers unknown)' }
    case 'na':
      return { er: null, method: 'N/A' }
    default:
      return { er: null, method: 'unknown' }
  }
}

function processOrganicPost(row) {
  const { er, method, estimated } = computeER(row)
  return {
    ...row,
    likes_n:    parseFloat(row.likes)    || 0,
    comments_n: parseFloat(row.comments) || 0,
    shares_n:   parseFloat(row.shares)   || 0,
    views_n:    parseFloat(row.views)    || 0,
    er_computed: er,
    er_method:  method,
    er_estimated: !!estimated,
    date_obj:   row.date_normalized && row.date_normalized !== 'UNKNOWN' && row.date_normalized !== '2024-01-01'
                  ? new Date(row.date_normalized)
                  : null,
  }
}

function processCommunityPost(row) {
  return {
    ...row,
    tools_list: (row.tools_mentioned || '')
      .split(',')
      .map(t => t.trim())
      .filter(t => t && t !== 'NONE' && t !== 'N/A'),
    date_obj: row.date_normalized && row.date_normalized !== 'UNKNOWN'
                ? new Date(row.date_normalized)
                : null,
  }
}

function processCurriculumItem(row) {
  return {
    ...row,
    tools_list: (row.tools_mentioned || '')
      .split(',')
      .map(t => t.trim())
      .filter(t => t && t !== 'NONE' && t !== 'N/A'),
  }
}

async function fetchJSON(url) {
  const res = await fetch(url)
  if (!res.ok) {
    if (res.status === 404) return null
    throw new Error(`Failed to load ${url}: ${res.status}`)
  }
  return res.json()
}

// ── Manifest ──────────────────────────────────────────────────────────────────

export function useManifest() {
  const [state, setState] = useState({ loading: true, error: null, manifest: null })

  useEffect(() => {
    fetchJSON('./data/manifest.json')
      .then(manifest => {
        if (!manifest) throw new Error('manifest.json not found — run seed-eden.js first')
        setState({ loading: false, error: null, manifest })
      })
      .catch(err => setState({ loading: false, error: err.message, manifest: null }))
  }, [])

  return state
}

// ── Per-competitor data ───────────────────────────────────────────────────────

export function useData(competitorSlug) {
  const [state, setState] = useState({ loading: true, error: null, data: null, aiSummary: null })

  useEffect(() => {
    if (!competitorSlug) {
      setState({ loading: false, error: 'No competitor selected', data: null, aiSummary: null })
      return
    }

    const base = `./data/${competitorSlug}`

    Promise.all([
      fetchJSON(`${base}/organic_posts.json`),
      fetchJSON(`${base}/community_posts.json`),
      fetchJSON(`${base}/admin_posts.json`),
      fetchJSON(`${base}/curriculum.json`),
      fetchJSON(`${base}/paid_ads.json`),
      fetchJSON(`${base}/ai_summary.json`).catch(() => null), // optional
    ])
      .then(([rawOrganic, rawCommunity, rawAdmin, rawCurriculum, rawPaidAds, aiSummary]) => {
        if (!rawOrganic) throw new Error(`No data found for competitor "${competitorSlug}". Run a scrape first.`)

        const organicPosts   = (rawOrganic   || []).map(processOrganicPost)
        const communityPosts = (rawCommunity || []).map(processCommunityPost)
        const curriculum     = (rawCurriculum|| []).map(processCurriculumItem)
        const adminPosts     = rawAdmin    || []
        const paidAds        = rawPaidAds  || []

        setState({
          loading: false,
          error: null,
          data: { organicPosts, communityPosts, adminPosts, curriculum, paidAds },
          aiSummary: aiSummary || null,
        })
      })
      .catch(err => setState({ loading: false, error: err.message, data: null, aiSummary: null }))
  }, [competitorSlug])

  return state
}
