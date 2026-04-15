import { useState, useMemo } from 'react'
import { CHANNEL_LABELS, CHANNEL_META } from '../useData.js'
import { PostListPanel } from '../PostPanel.jsx'

const EXCL = new Set(['NONE', 'UNKNOWN', 'STANDALONE', 'SERIES', ''])

// ── Eden-specific campaign metadata ─────────────────────────────────────────
const EDEN_CAMP_NAMES = {
  'CAMP-Claude-Code-Mar26':        'The Shelter Challenge (Claude Code)',
  'CAMP-Womens-Month-Feb26':       "Women's Month ₪1 Trial",
  'CAMP-AI-Solutions-Mar26':       'AI Solutions Developer Course',
  'CAMP-NotebookLM-Feb26':         'NotebookLM Workshop',
  'CAMP-Gemini-Workshop-Feb26':    'Gemini Workshop + 50% Off',
  'CAMP-Brainstorm-Oct25':         'Brainstorm Conference',
  'CAMP-LEARN-AI-CHALLENGE-May25': 'Learn AI Challenge',
  'CAMP-100K-Challenge':           '100K Community Challenge',
  'CAMP-BRAINERSCLUB-May25':       'Brainers Club Recruitment',
  'CAMP-MONEYMAKER-Jan24':         'AI MoneyMaker Course',
  'CAMP-AIBUSINESS-Apr25':         'AI Business Program',
  'CAMP-WHATSUPAI-Feb25':          "What's Up AI Course",
  'CAMP-CONTENTMASTERS-Mar24':     'Content Masters Course',
  'CAMP-AILIFE-LAUNCH-Sep23':      'AI Life Club Launch',
  'CAMP-AILIFE-RECRUIT-Nov23':     'AI Life Recruitment Drive',
  'CAMP-OCT7-UNITY-Oct23':         'Oct 7 Community Response',
  'CAMP-NEWSVIDEO-Nov24':          'AI News Video Launch',
}

const EDEN_CAMP_SELLS = {
  'CAMP-Claude-Code-Mar26':     'Brainers Club membership',
  'CAMP-Womens-Month-Feb26':    'Brainers Club ₪1 first month',
  'CAMP-AI-Solutions-Mar26':    'AI Solutions Developer paid course',
  'CAMP-NotebookLM-Feb26':      'WhatsApp Free group → Brainers Club',
  'CAMP-Gemini-Workshop-Feb26': 'Brainers Club at 50% off',
}

// ── Eden-specific funnel ──────────────────────────────────────────────────────
const EDEN_FUNNEL_NODES = [
  { id: 'content',   label: 'Social Content',           sublabel: 'Instagram · FB · LinkedIn · TikTok', color: '#38BDF8', desc: 'Free value content posted across all channels. 60% of posts are give-value.' },
  { id: 'lead',      label: 'Lead Capture',             sublabel: 'Comment keyword → automated DM',    color: '#A78BFA', desc: 'When someone comments a keyword, automation sends them a DM with a link. On Instagram this averages 2,237 comments per post.' },
  { id: 'wa_free',   label: 'WhatsApp Free Group',      sublabel: '984 members · direct link delivery', color: '#25D366', desc: 'Most leads go here first — a free WhatsApp group. Low-commitment middle step before ever seeing a price.' },
  { id: 'challenge', label: 'Free Challenge / Workshop', sublabel: 'Value delivery · 3-day format',     color: '#FBBF24', desc: 'Free 3-day challenge or live workshop delivers real value, then makes a paid offer at the end. The Shelter Challenge had 12,000 registrants.' },
  { id: 'brainers',  label: 'Brainers Club',            sublabel: '₪49/month · 5,000+ members',       color: '#F472B6', desc: 'The single paid product almost everything points to. 60% of all posts ultimately drive here.' },
  { id: 'upsell',    label: 'Premium Courses',          sublabel: 'AI Solutions · MoneyMaker · etc.',  color: '#F97316', desc: 'Brainers Club members are the audience for higher-ticket course upsells.' },
]

// ── Generic fallback funnel ────────────────────────────────────────────────────
function buildGenericFunnel(posts) {
  const hasWA = posts.some(p => (p.dest_immediate || '').toLowerCase().includes('whatsapp'))
  const topDests = {}
  posts.forEach(p => { const d = p.dest_ultimate; if (d && d !== 'NONE' && d !== 'False') topDests[d] = (topDests[d] || 0) + 1 })
  const top = Object.entries(topDests).sort((a, b) => b[1] - a[1]).slice(0, 3)
  return [
    { id: 'content', label: 'Social Content', sublabel: 'Organic posts across all channels', color: '#38BDF8', desc: 'Top-of-funnel content building awareness and trust.' },
    ...(hasWA ? [{ id: 'wa', label: 'Free Community', sublabel: 'WhatsApp / Telegram', color: '#25D366', desc: 'Warm middle step before any paid offer.' }] : []),
    ...top.map((([dest], i) => ({ id: `dest_${i}`, label: dest, sublabel: 'Primary destination', color: ['#F472B6', '#FBBF24', '#A78BFA'][i] || '#60A5FA', desc: `${topDests[dest]} posts point here.` }))),
  ]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function computePeriodStats(posts) {
  if (!posts?.length) return null
  const total = posts.length
  const sellN = posts.filter(p => p.intent==='SOFT-SELL'||p.intent==='HARD-SELL').length
  const giveN = posts.filter(p => p.intent==='GIVE-VALUE').length
  const campMap = {}
  for (const p of posts) { const id=p.campaign_id; if(!id||EXCL.has(id))continue; if(!campMap[id])campMap[id]=0; campMap[id]++ }
  const hookCounts = {}
  for (const p of posts) { if(!p.hook_type||p.hook_type==='False')continue; hookCounts[p.hook_type]=(hookCounts[p.hook_type]||0)+1 }
  const topHook = Object.entries(hookCounts).sort((a,b)=>b[1]-a[1])[0]
  const CHANS = ['instagram','fb_personal','fb_group','linkedin','whatsapp','email','tiktok','youtube']
  const chData = {}
  for (const ch of CHANS) {
    const cp = posts.filter(p=>p.channel===ch); if(!cp.length)continue
    chData[ch] = { n: cp.length, avgCmts: Math.round(cp.reduce((s,p)=>s+(p.comments_n||0),0)/cp.length) }
  }
  return { total, sellN, giveN, sellShare: Math.round(sellN/total*100), campCount: Object.keys(campMap).length, topHook, chData }
}

function getPriorPosts(allPosts, currentPosts) {
  if (!allPosts?.length||!currentPosts?.length) return []
  const dated = currentPosts.filter(p=>p.date_obj).sort((a,b)=>a.date_obj-b.date_obj)
  if (!dated.length) return []
  const winStart = dated[0].date_obj, winEnd = dated[dated.length-1].date_obj
  const winMs = winEnd - winStart
  if (winMs < 86400000) return []
  const priorEnd = new Date(winStart.getTime()-1), priorStart = new Date(winStart.getTime()-winMs-86400000)
  return allPosts.filter(p=>p.date_obj&&p.date_obj>=priorStart&&p.date_obj<=priorEnd)
}

function cmts(p) { return typeof p.comments_n === 'number' ? p.comments_n : 0 }
function mean(arr) { return arr.length ? Math.round(arr.reduce((s, p) => s + cmts(p), 0) / arr.length) : 0 }

function getCoreDateRange(posts) {
  const dated = posts.filter(p => p.date_obj).sort((a, b) => a.date_obj - b.date_obj)
  if (!dated.length) return { firstDate: null, lastDate: null, corePosts: posts }
  if (dated.length <= 2) return { firstDate: dated[0].date_obj, lastDate: dated[dated.length-1].date_obj, corePosts: posts }
  const mid = dated[Math.floor(dated.length / 2)].date_obj
  const MS90 = 90 * 86400000
  const corePosts = posts.filter(p => !p.date_obj || Math.abs(p.date_obj - mid) <= MS90)
  const coreDated = corePosts.filter(p => p.date_obj).sort((a, b) => a.date_obj - b.date_obj)
  if (!coreDated.length) return { firstDate: dated[0].date_obj, lastDate: dated[dated.length-1].date_obj, corePosts: posts }
  return { firstDate: coreDated[0].date_obj, lastDate: coreDated[coreDated.length-1].date_obj, corePosts }
}

// ── Narrative builder ─────────────────────────────────────────────────────────

const HOOK_LABEL = {
  'NEWS-BREAK':'news reaction','CURIOSITY-GAP':'curiosity gap','FOMO':'FOMO','SHOCK':'shock',
  'PERSONAL-STORY':'personal story','AUTHORITY':'authority','NUMBER-LISTICLE':'number listicle',
  'SOCIAL-PROOF':'social proof','QUESTION':'question','CONTRARIAN':'contrarian','PAIN-POINT':'pain point',
  'HOW-TO':'how-to','VALUE-OFFER':'value offer',
}
const HOOK_WHY = {
  'NEWS-BREAK':"reacts fast to relevant news and frames it for the audience — urgency with built-in relevance",
  'CURIOSITY-GAP':"the opening withholds the answer, forcing the reader to comment or keep reading to get it",
  'FOMO':"frames inaction as a cost — people who aren't using this tool are already falling behind",
  'SHOCK':"a provocative opening claim designed to stop the scroll before anything else is read",
  'PERSONAL-STORY':"opens with a personal moment — builds warmth and trust before any ask appears",
  'AUTHORITY':"leads with results, student counts, or press — earns the right to make an offer",
  'NUMBER-LISTICLE':"promises a specific, bounded list upfront — pairs naturally with comment-to-DM",
  'SOCIAL-PROOF':"opens with scale evidence — registrant numbers, member counts, testimonials",
  'QUESTION':"asks the audience something directly, triggering reflexive engagement",
  'CONTRARIAN':"challenges a belief the audience holds — provokes a reaction by disagreeing with conventional wisdom",
  'PAIN-POINT':"names a cost or frustration the audience is already feeling — they immediately recognise themselves",
  'HOW-TO':"promises a practical, step-by-step payoff — clear value before the reader has to do anything",
  'VALUE-OFFER':"leads with a free deliverable — the reader knows exactly what they're getting before engaging",
}
// Eden-specific static channel labels (kept for Eden only)
const EDEN_CHAN_ROLE = {
  instagram:'Lead capture',fb_personal:'Warm broadcast',fb_group:'Testing ground',
  linkedin:'Authority — fires last',whatsapp:'Pre-launch — warmest audience',email:'Closes the sale',
  tiktok:'Reach — underinvested',youtube:'Long-form authority',
}
const EDEN_CHAN_HOW = {
  instagram:"People comment a keyword, automation sends them a DM with the link. Every commenter becomes a tracked contact and the comment count signals reach to Instagram's algorithm.",
  fb_personal:"Facebook penalises posts with links in the caption, so links go in the first comment or require a comment to receive. Each reply signals engagement back to Facebook.",
  fb_group:"Large groups are where offers are tested before going public. A strong response is the green light to fire every other channel.",
  linkedin:"Always fires late, once there are real numbers from other channels to quote. LinkedIn's professional audience responds to social proof.",
  whatsapp:"Warmest audience gets the link before anything goes public. By the time social media sees the announcement, spots are already claimed — making any scarcity real.",
  email:"Email closes the sale. Pattern: email 1 delivers value, email 2 makes the offer, email 3 delivers more value with the offer mentioned again.",
  tiktok:"Large following potential, but requires consistent posting. Not typically part of campaign systems.",
  youtube:"Long-form tutorials and news commentary. Lower engagement than social channels — YouTube audiences consume without commenting the way Facebook audiences do.",
}

// Data-driven channel role label (for competitors other than Eden)
function buildChannelRole(ch, d) {
  const ckPosts = d.posts.filter(p => p.cta_method === 'COMMENT-KEYWORD').length
  const sellPct = d.n > 0 ? Math.round(d.sellPosts.length / d.n * 100) : 0
  const givePct = d.n > 0 ? Math.round(d.givePosts.length / d.n * 100) : 0
  if (ch === 'instagram') return ckPosts > 0 ? 'Lead capture via comment automation' : givePct >= 60 ? 'Value / awareness' : 'Content distribution'
  if (ch === 'linkedin')  return sellPct > 40 ? 'Active selling' : 'Authority / professional reach'
  if (ch === 'youtube')   return sellPct > 40 ? 'Selling channel' : 'Long-form content & tutorials'
  if (ch === 'tiktok')    return 'Short-form reach'
  if (ch === 'fb_personal') return 'Personal broadcast'
  if (ch === 'fb_group')  return 'Community / group broadcast'
  if (ch === 'whatsapp')  return 'Warm audience broadcast'
  if (ch === 'email')     return 'Direct conversion'
  return 'Content channel'
}

// Describe content style from hook_type distribution
function describeContentStyle(posts) {
  const JUNK = new Set(['OTHER', 'False', '', 'NONE'])
  const counts = {}
  for (const p of posts) {
    if (p.hook_type && !JUNK.has(p.hook_type)) {
      counts[p.hook_type] = (counts[p.hook_type] || 0) + 1
    }
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1])
  if (!ranked.length) return null
  const STYLE_VERB = {
    'NEWS-BREAK':     'reacts to AI and tech news in real time',
    'HOW-TO':         'teaches practical, step-by-step skills',
    'CURIOSITY-GAP':  'builds curiosity with open-loop hooks that force a click or comment',
    'VALUE-OFFER':    'leads with free resources, tools, and guides',
    'PAIN-POINT':     'names audience frustrations and promises a solution',
    'PERSONAL-STORY': 'opens with personal experiences and behind-the-scenes moments',
    'AUTHORITY':      'leads with credentials, student counts, and results',
    'NUMBER-LISTICLE':'packages dense information into numbered, scannable lists',
    'CONTRARIAN':     'challenges conventional wisdom with hot takes',
    'QUESTION':       'engages the audience directly through provocative questions',
    'SOCIAL-PROOF':   'showcases wins, results, and testimonials',
    'FOMO':           'creates urgency around what people might be missing',
    'HUMOR':          'uses humour and entertainment to grow reach',
    'CHALLENGE':      'issues direct challenges to push the audience to act',
  }
  const top  = ranked[0][0]
  const desc = STYLE_VERB[top] || top.toLowerCase().replace(/-/g, ' ')
  if (ranked.length >= 2 && ranked[1][1] >= Math.ceil(ranked[0][1] * 0.4)) {
    const second = ranked[1][0]
    const desc2 = STYLE_VERB[second] || second.toLowerCase().replace(/-/g, ' ')
    return { primary: desc, secondary: desc2, topType: top }
  }
  return { primary: desc, secondary: null, topType: top }
}

// Detect meaningful destination labels from dest_immediate URLs / dest_ultimate buckets
function detectDestinations(posts) {
  const urlPatterns = [
    [/substack|newsletter|signup|guide|how-to|\.guide|\.ai\/guide/i, 'newsletter or guide site'],
    [/youtube\.com|youtu\.be/i,   'YouTube'],
    [/instagram\.com/i,           'Instagram'],
    [/linkedin\.com/i,            'LinkedIn'],
    [/whatsapp/i,                 'WhatsApp group'],
    [/telegram/i,                 'Telegram group'],
    [/podcast|spotify|apple.*podcast/i, 'podcast'],
    [/course|program|cohort/i,    'paid course / program'],
    [/claude\.ai|claude\.com|anthropic/i, 'Claude / Anthropic'],
  ]
  const buckets = {}
  const JUNK = new Set(['Awareness only','Brand / awareness only','NONE','False','No CTA','Save post','(none)',''])
  for (const p of posts) {
    const immed   = (p.dest_immediate || '').toLowerCase()
    const ultimate = p.dest_ultimate || ''
    if (!JUNK.has(ultimate) && ultimate.trim()) {
      buckets[ultimate] = (buckets[ultimate] || 0) + 1
    }
    // Also scan dest_immediate for URL patterns to catch fragmented labels
    for (const [re, label] of urlPatterns) {
      if (re.test(immed)) { buckets[label] = (buckets[label] || 0) + 1; break }
    }
  }
  // Merge similar keys: anything matching "newsletter/guide/substack/signup" → one bucket
  const newsKeys = Object.keys(buckets).filter(k => /newsletter|substack|signup|guide|how-to/i.test(k))
  if (newsKeys.length > 1) {
    const total = newsKeys.reduce((s, k) => s + buckets[k], 0)
    newsKeys.forEach(k => delete buckets[k])
    buckets['newsletter / guide signup'] = total
  }
  return Object.entries(buckets).sort((a, b) => b[1] - a[1])
}

// Data-driven qualitative channel description (computed from actual posts)
function buildChannelHow(ch, d) {
  const total = d.n
  const pct   = n => `${Math.round(n / total * 100)}%`

  const ckPosts  = d.posts.filter(p => p.cta_method === 'COMMENT-KEYWORD').length
  const licPosts = d.posts.filter(p => p.cta_method === 'LINK-IN-COMMENT').length
  const lipPosts = d.posts.filter(p => p.cta_method === 'LINK-IN-POST').length
  const waPosts  = d.posts.filter(p => p.cta_method === 'WHATSAPP-JOIN').length
  const noCta    = d.posts.filter(p => !p.cta_method || p.cta_method === 'NONE').length

  const sellPct = Math.round(d.sellPosts.length / total * 100)
  const givePct = Math.round(d.givePosts.length / total * 100)
  const style   = describeContentStyle(d.posts)
  const dests   = detectDestinations(d.posts)

  const parts = []

  // 1. Content model — what is this channel being used for?
  if (givePct >= 70) {
    parts.push(`Education-first model: ${givePct}% of posts are free value${style ? `, primarily content that ${style.primary}` : ''}.`)
  } else if (sellPct > 50) {
    parts.push(`Primarily a selling channel: ${sellPct}% of posts push an offer${style ? `, using ${style.primary} hooks` : ''}.`)
  } else if (givePct > 0 && sellPct > 0) {
    parts.push(`Balanced mix of education (${givePct}%) and promotion (${sellPct}%)${style ? ` — content tends to ${style.primary}` : ''}.`)
  } else if (style) {
    parts.push(`Content ${style.primary}${style.secondary ? `, mixing in posts that ${style.secondary}` : ''}.`)
  }

  // 2. Conversion mechanic — how does the audience get from post to destination?
  if (ckPosts > 0) {
    parts.push(`Lead capture mechanic: ${pct(ckPosts)} of posts ask followers to comment a keyword — automation delivers the link via DM, turning every comment into a tracked lead.`)
  } else if (lipPosts > 0 && lipPosts >= 2) {
    parts.push(`${pct(lipPosts)} of posts include a direct link — the interested reader clicks through immediately, no extra step.`)
  } else if (licPosts > 0) {
    parts.push(`Links go in the first comment rather than the caption — a standard workaround to avoid algorithm down-ranking of caption links.`)
  } else if (waPosts > 0) {
    parts.push(`The CTA points to a WhatsApp group — a free, low-friction middle step that warms the audience before any paid offer.`)
  } else if (noCta >= total * 0.65) {
    parts.push(`${pct(noCta)} of posts ask for nothing in return — this is a long-game trust-building approach: grow the audience first, monetise later.`)
  }

  // 3. Destination — where does this channel ultimately send people?
  if (dests.length >= 2) {
    parts.push(`When traffic is directed, the top destinations are ${dests.slice(0, 2).map(([k]) => k).join(' and ')}.`)
  } else if (dests.length === 1 && dests[0][1] >= 2) {
    parts.push(`Traffic flows toward ${dests[0][0]}.`)
  }

  return parts.length ? parts.join(' ') : null
}

function buildNarrative(analysis, posts, allPosts, name, isEden = false) {
  const { campaigns, chAnalysis, sellPosts, givePosts, activeChannels } = analysis
  const total = posts.length

  if (total < 5) {
    return [{ type: 'simple', points: [`Only ${total} posts in this window. Try a wider date range.`] }]
  }

  const sellShare = Math.round(sellPosts.length / total * 100)
  const giveShare = Math.round(givePosts.length / total * 100)
  const priorPosts = getPriorPosts(allPosts, posts)
  const prior = computePeriodStats(priorPosts)

  const overallPoints = []

  if (campaigns.length === 0) {
    overallPoints.push(`No campaigns running. ${name} is in between-launches mode — ${giveShare}% give-value content, keeping the audience warm and trusting before the next offer appears.`)
  } else if (campaigns.length === 1) {
    const c = campaigns[0]
    const campShare = Math.round(c.n / total * 100)
    overallPoints.push(`One campaign: ${c.name}${c.sells ? `, selling ${c.sells}` : ''} — ${c.phase} phase, ${campShare}% of posts.`)
  } else {
    const campNames = campaigns.map(c=>c.name).slice(0,3).join(', ')
    overallPoints.push(`${campaigns.length} campaigns running — ${campNames}${campaigns.length>3?' and more':''}.`)
  }

  if (sellPosts.length > 0) {
    const rhythm = sellShare > 40
      ? "Heavy on selling right now — this intensity is only sustainable for a few days before it starts eroding trust."
      : sellShare < 10
      ? "Almost entirely give-value. Not selling yet."
      : "Typical rhythm — generous with value, occasional ask."
    overallPoints.push(`${giveShare}% value posts, ${sellShare}% sell posts. ${rhythm}`)
  }

  if (prior && prior.total >= 5) {
    const priorSellShare = prior.sellShare
    const sellDiff = sellShare - priorSellShare
    const postsDiff = total - prior.total
    const campDiff = campaigns.length - prior.campCount
    const changes = []
    if (Math.abs(postsDiff) > Math.round(total * 0.25))
      changes.push(`${postsDiff > 0 ? `${postsDiff} more posts` : `${Math.abs(postsDiff)} fewer posts`} than the prior period`)
    if (campDiff !== 0)
      changes.push(`${campDiff > 0 ? `${campDiff} more campaign${campDiff!==1?'s':''}` : `${Math.abs(campDiff)} fewer campaign${Math.abs(campDiff)!==1?'s':''}`} than prior period`)
    if (Math.abs(sellDiff) >= 10)
      changes.push(`sell content is ${sellDiff > 0 ? 'up' : 'down'} from ${priorSellShare}% to ${sellShare}% of posts`)
    if (changes.length === 0)
      overallPoints.push(`vs prior period: no meaningful change — same volume, same cadence, same sell/value balance.`)
    else
      overallPoints.push(`vs prior period: ${changes.join('; ')}.`)
  }

  // ── Channel section ──────────────────────────────────────────────────────────
  const seqPoints = []
  const activeChans = activeChannels.filter(ch => chAnalysis[ch]?.n >= 1)

  if (isEden && campaigns.length > 0) {
    // Eden-specific multi-channel sequence prose
    const hasWA  = activeChans.includes('whatsapp')
    const hasFBG = activeChans.includes('fb_group')
    const hasIG  = activeChans.includes('instagram')
    const hasLI  = activeChans.includes('linkedin')
    const hasEM  = activeChans.includes('email')
    const seqSentences = []
    if (hasWA)  seqSentences.push(`WhatsApp fires first — warmest audience gets early access before anything goes public.`)
    if (hasFBG) {
      const fbgTop = chAnalysis['fb_group']?.topPost?.comments_n
      seqSentences.push(`FB Group tests the offer${fbgTop && fbgTop > 300 ? ` — ${fbgTop.toLocaleString()} comments on the top post was the green light to push everywhere else` : ` and gauges response before the full launch`}.`)
    }
    if (hasIG) {
      const ckN = chAnalysis['instagram']?.posts?.filter(p=>p.cta_method==='COMMENT-KEYWORD').length || 0
      const ckAvg = ckN > 0 ? Math.round(chAnalysis['instagram'].posts.filter(p=>p.cta_method==='COMMENT-KEYWORD').reduce((s,p)=>s+(p.comments_n||0),0)/ckN) : null
      seqSentences.push(`Instagram collects the leads${ckN > 0 ? ` — ${ckN} posts use comment-to-DM automation${ckAvg ? `, averaging ${ckAvg.toLocaleString()} comments each` : ''}` : ''}.`)
    }
    if (hasLI)  seqSentences.push(`LinkedIn fires last — deliberately, once other channels have built up real numbers to quote as social proof.`)
    if (hasEM)  seqSentences.push(`Email closes the sale — value delivery first, offer second.`)
    if (seqSentences.length > 1)
      seqPoints.push({ type: 'prose', text: `The channels aren't interchangeable — each has a specific job. ${seqSentences.join(' ')}` })
    else if (seqSentences.length === 1)
      seqPoints.push({ type: 'prose', text: seqSentences[0] })
  } else if (!isEden) {
    // Data-driven qualitative channel narrative for competitors
    if (activeChans.length === 1) {
      const ch   = activeChans[0]
      const d    = chAnalysis[ch]
      const total = d.n
      const pct  = n => `${Math.round(n / total * 100)}%`

      const ckPosts  = d.posts.filter(p => p.cta_method === 'COMMENT-KEYWORD').length
      const lipPosts = d.posts.filter(p => p.cta_method === 'LINK-IN-POST').length
      const licPosts = d.posts.filter(p => p.cta_method === 'LINK-IN-COMMENT').length
      const noCta    = d.posts.filter(p => !p.cta_method || p.cta_method === 'NONE').length
      const sellPct  = Math.round(d.sellPosts.length / total * 100)
      const givePct  = Math.round(d.givePosts.length / total * 100)
      const style    = describeContentStyle(d.posts)
      const dests    = detectDestinations(d.posts)

      const sentences = []

      // Dataset scope qualifier
      sentences.push(`In this dataset, ${name}'s tracked posts are on ${CHANNEL_LABELS[ch]}.`)

      // Content model — the "story"
      if (givePct >= 70 && noCta >= total * 0.5) {
        sentences.push(`The model is audience-building first: ${givePct}% of posts are free value with no ask attached — the goal is reach and trust, not immediate conversion.`)
      } else if (givePct >= 60 && (lipPosts > 0 || ckPosts > 0)) {
        sentences.push(`The content engine runs education-first — ${givePct}% of posts give value freely — then converts the interested minority with a direct link or lead capture mechanic.`)
      } else if (sellPct > 50) {
        sentences.push(`This channel is used primarily for active promotion: ${sellPct}% of posts push an offer directly.`)
      } else {
        sentences.push(`Content is a mix of education (${givePct}%) and promotion (${sellPct}%).`)
      }

      // What the content is actually about (from style inference)
      if (style) {
        const secondClause = style.secondary ? `, occasionally mixing in content that ${style.secondary}` : ''
        sentences.push(`The content typically ${style.primary}${secondClause}.`)
      }

      // Conversion mechanic — how readers are moved to act
      if (ckPosts > 0) {
        sentences.push(`When there is a CTA, the mechanic is comment-keyword automation: ${pct(ckPosts)} of posts ask followers to comment a trigger word and receive a link via DM — every commenter becomes a trackable lead.`)
      } else if (lipPosts > 0) {
        sentences.push(`${pct(lipPosts)} of posts include a direct link in the post — a frictionless path for the reader who is already interested.`)
        if (licPosts > 0) sentences.push(`${pct(licPosts)} put the link in the first comment rather than the caption.`)
      } else if (noCta >= total * 0.65) {
        sentences.push(`${pct(noCta)} of posts carry no CTA at all — this is a long-game play: consistent free value today, audience to monetise later.`)
      }

      // Where they ultimately send people
      if (dests.length >= 2) {
        sentences.push(`When content does drive somewhere, the primary destinations are ${dests.slice(0, 2).map(([k]) => k).join(' and ')}.`)
      } else if (dests.length === 1) {
        sentences.push(`Content that includes a destination points toward ${dests[0][0]}.`)
      }

      seqPoints.push({ type: 'prose', text: sentences.join(' ') })

    } else if (activeChans.length > 1) {
      // Multi-channel: describe each channel's actual role from data
      const style = describeContentStyle(posts)
      const opener = style
        ? `${name} posts across ${activeChans.length} channels, with content that primarily ${style.primary}.`
        : `${name} posts across ${activeChans.length} channels.`
      const sentences = [opener]

      for (const ch of activeChans) {
        const d = chAnalysis[ch]
        const ckPosts  = d.posts.filter(p => p.cta_method === 'COMMENT-KEYWORD').length
        const lipPosts = d.posts.filter(p => p.cta_method === 'LINK-IN-POST').length
        const sellPct  = Math.round(d.sellPosts.length / d.n * 100)
        const givePct  = Math.round(d.givePosts.length / d.n * 100)
        const noCta    = d.posts.filter(p => !p.cta_method || p.cta_method === 'NONE').length
        const chStyle  = describeContentStyle(d.posts)

        let roleDesc
        if (ckPosts > 0) {
          roleDesc = `lead capture — ${ckPosts} posts use comment-keyword automation to turn engagement into DM leads`
        } else if (lipPosts > d.n * 0.3) {
          roleDesc = `direct conversion — ${Math.round(lipPosts/d.n*100)}% of posts carry a direct link`
        } else if (sellPct > 50) {
          roleDesc = `active selling (${sellPct}% of posts are promotional)`
        } else if (givePct >= 70 || noCta >= d.n * 0.6) {
          roleDesc = `audience building and awareness — ${givePct}% give-value, low-friction`
        } else if (chStyle) {
          roleDesc = `content distribution (${chStyle.primary})`
        } else {
          roleDesc = `content distribution (${givePct}% value, ${sellPct}% selling)`
        }
        sentences.push(`${CHANNEL_LABELS[ch]} is used for ${roleDesc}.`)
      }

      // Where multi-channel traffic ultimately flows
      const allDests = detectDestinations(posts)
      if (allDests.length >= 1) {
        sentences.push(`Across all channels, the primary destination is ${allDests.slice(0,2).map(([k])=>k).join(' and ')}.`)
      }

      seqPoints.push({ type: 'prose', text: sentences.join(' ') })
    }
  }

  for (const ch of activeChannels) {
    const d = chAnalysis[ch]; if (!d || d.n < 1) continue
    const isSellHeavy = d.sellPosts.length > d.givePosts.length
    seqPoints.push({
      type: 'channel', ch,
      label: `${CHANNEL_LABELS[ch]} — ${isEden ? (EDEN_CHAN_ROLE[ch] || '') : buildChannelRole(ch, d)}`,
      desc: isEden
        ? `${EDEN_CHAN_HOW[ch] || ''}${isSellHeavy ? ' Sell-heavy this period.' : ''}`
        : (buildChannelHow(ch, d) || ''),
    })
  }

  // ── What's Working ────────────────────────────────────────────────────────────
  const wwPoints = []
  const JUNK_HOOKS = new Set(['OTHER', 'False', '', 'NONE'])
  const hookCounts = {}, hookComments = {}
  for (const p of posts) {
    const h = p.hook_type
    if (!h || JUNK_HOOKS.has(h)) continue
    hookCounts[h] = (hookCounts[h]||0)+1
    if (!hookComments[h]) hookComments[h]=[]
    hookComments[h].push(p.comments_n||0)
  }
  const hookRanked = Object.entries(hookCounts).sort((a,b)=>b[1]-a[1])
  const topHook = hookRanked[0]
  const hookPerfRanked = Object.entries(hookComments)
    .filter(([,v])=>v.length>=2)
    .map(([k,v])=>[k, Math.round(v.reduce((a,b)=>a+b,0)/v.length), v.length])
    .sort((a,b)=>b[1]-a[1])
  const bestHook  = hookPerfRanked[0]
  const worstHook = hookPerfRanked[hookPerfRanked.length-1]

  if (topHook) {
    const topName  = HOOK_LABEL[topHook[0]]  || topHook[0].toLowerCase().replace(/-/g,' ')
    const topWhy   = HOOK_WHY[topHook[0]]
    if (bestHook && bestHook[0] !== topHook[0]) {
      const bestName = HOOK_LABEL[bestHook[0]] || bestHook[0].toLowerCase().replace(/-/g,' ')
      const bestWhy  = HOOK_WHY[bestHook[0]]
      wwPoints.push(`Most-used hook: ${topName}${topWhy ? ` — ${topWhy}` : ''}.\nBest-performing: ${bestName}${bestWhy ? ` — ${bestWhy}` : ''}. Averages ${bestHook[1].toLocaleString()} comments (${bestHook[2]} posts).`)
    } else if (bestHook) {
      wwPoints.push(`Most-used and best-performing hook: ${topName}${topWhy ? ` — ${topWhy}` : ''}. Averaging ${bestHook[1].toLocaleString()} comments across ${bestHook[2]} posts.`)
    } else {
      wwPoints.push(`Most-used hook: ${topName}${topWhy ? ` — ${topWhy}` : ''}.`)
    }
    if (worstHook && worstHook[0] !== (bestHook?.[0]) && worstHook[0] !== topHook[0]) {
      const worstName = HOOK_LABEL[worstHook[0]] || worstHook[0].toLowerCase().replace(/-/g,' ')
      wwPoints.push(`Weakest hook: ${worstName} — in the mix but generating far less engagement than the others.`)
    }
  }

  const ctaCounts = {}
  for (const p of posts) { const k=p.cta_method; if(k&&k!=='False'&&k!=='NONE') ctaCounts[k]=(ctaCounts[k]||0)+1 }
  const topCTA = Object.entries(ctaCounts).sort((a,b)=>b[1]-a[1])[0]
  if (topCTA) {
    const CTA_WHY = {
      'COMMENT-KEYWORD':    'people comment a keyword, get a link via automated DM — highest-volume lead capture mechanic',
      'COMMENT-TO-RECEIVE': 'people comment anything and receive the link manually — lower volume but every reply is a genuine hand-raise',
      'LINK-IN-COMMENT':    'link goes in the first comment, not the caption — avoids algorithm penalties for caption links',
      'LINK-IN-POST':       'direct link in the post',
      'ENGAGEMENT-QUESTION':'question with no link or offer — pure audience activation',
      'WHATSAPP-JOIN':      'drives people to join a free WhatsApp group — warms them before any paid offer',
    }
    wwPoints.push(`Top CTA mechanic (${Math.round(topCTA[1]/total*100)}% of posts): ${CTA_WHY[topCTA[0]] || topCTA[0]}.`)
  }

  // Primary destination insight — use consistent % format
  const smartDests = detectDestinations(posts)
  if (smartDests.length) {
    const topD = smartDests[0], secD = smartDests[1]
    const topShare = Math.round(topD[1] / total * 100)
    const destLine = secD
      ? `Primary destinations: ${topD[0]} (${topShare}% of posts) and ${secD[0]} (${Math.round(secD[1]/total*100)}%).`
      : `${topShare}% of posts ultimately drive to: ${topD[0]}.`
    wwPoints.push(destLine)
  }

  return [
    { type: 'list', label: 'OVERALL',          points: overallPoints },
    { type: 'channels', label: 'CHANNEL SEQUENCE', points: seqPoints },
    { type: 'list', label: "WHAT'S WORKING",   points: wwPoints },
  ]
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ViewExecutiveSummary({ posts, allPosts, paidAds, competitor, aiSummary, onNavigate, filterLabel }) {
  const [panel, setPanel] = useState(null)
  const [hoveredNode, setHoveredNode] = useState(null)

  const isEden = competitor?.slug === 'eden_bibas'
  const name = competitor?.name ?? 'This competitor'

  // Campaign name lookup
  const campNames = useMemo(() => {
    if (isEden) return EDEN_CAMP_NAMES
    return aiSummary?.campaignNames ?? {}
  }, [isEden, aiSummary])

  const campSells = useMemo(() => {
    if (isEden) return EDEN_CAMP_SELLS
    return aiSummary?.campaignSells ?? {}
  }, [isEden, aiSummary])

  // Funnel nodes
  const funnelNodes = useMemo(() => {
    if (isEden) return EDEN_FUNNEL_NODES
    if (aiSummary?.funnel?.length) return aiSummary.funnel
    return buildGenericFunnel(allPosts ?? [])
  }, [isEden, aiSummary, allPosts])

  const analysis = useMemo(() => {
    if (!posts?.length) return null
    const dated = posts.filter(p => p.date_obj).sort((a, b) => a.date_obj - b.date_obj)
    if (!dated.length) return null

    const firstDate = dated[0].date_obj
    const lastDate  = dated[dated.length - 1].date_obj

    const campMap = {}
    for (const p of posts) {
      const id = p.campaign_id
      if (!id || EXCL.has(id)) continue
      if (!campMap[id]) campMap[id] = { id, posts: [] }
      campMap[id].posts.push(p)
    }

    const campaigns = Object.values(campMap)
      .map(c => {
        const { firstDate: cFirst, lastDate: cLast, corePosts } = getCoreDateRange(c.posts)
        const sortedCore = [...corePosts].filter(p=>p.date_obj).sort((a,b)=>a.date_obj-b.date_obj)
        const intents = corePosts.map(p => p.intent)
        const hasHard = intents.includes('HARD-SELL') || intents.includes('URGENCY')
        const hasSoft = intents.includes('SOFT-SELL')
        const seen = new Set(); const chSequence = []
        for (const p of sortedCore) { if (p.channel && !seen.has(p.channel)) { seen.add(p.channel); chSequence.push(p.channel) } }
        const byChannel = {}
        for (const p of corePosts) { if (!byChannel[p.channel]) byChannel[p.channel]={posts:[]}; byChannel[p.channel].posts.push(p) }
        const channelBreakdown = chSequence.map(ch => {
          const d = byChannel[ch]; const ctaCounts = {}
          for (const p of d.posts) { const k=p.cta_method; if(k&&k!=='NONE'&&k!=='False') ctaCounts[k]=(ctaCounts[k]||0)+1 }
          const topCTA = Object.entries(ctaCounts).sort((a,b)=>b[1]-a[1])[0]
          return { ch, n: d.posts.length, topCTA: topCTA?.[0], avgCmts: mean(d.posts), posts: d.posts }
        })
        const activeInWindow = cFirst && cLast && cFirst <= lastDate && cLast >= firstDate
        return {
          id: c.id,
          name: campNames[c.id] || c.id.replace(/^CAMP-/,'').replace(/-/g,' '),
          sells: campSells[c.id],
          posts: corePosts, n: corePosts.length, avgCmts: mean(corePosts),
          chSequence, channelBreakdown, isNew: cFirst&&cFirst>=firstDate,
          phase: hasHard?'closing':hasSoft?'selling':'warming up',
          firstDate: cFirst, lastDate: cLast, activeInWindow,
        }
      })
      .filter(c => c.activeInWindow && c.n >= 2)
      .sort((a,b) => b.n - a.n)

    const CHANNEL_ORDER = ['instagram','fb_personal','fb_group','linkedin','whatsapp','email','tiktok','youtube']
    const chAnalysis = {}
    for (const ch of CHANNEL_ORDER) {
      const cp = posts.filter(p => p.channel === ch)
      if (!cp.length) continue
      const ctaCounts = {}
      for (const p of cp) { const k=p.cta_method; if(k&&k!=='False') ctaCounts[k]=(ctaCounts[k]||0)+1 }
      const topCTA = Object.entries(ctaCounts).sort((a,b)=>b[1]-a[1])[0]
      const sellPosts = cp.filter(p=>p.intent==='SOFT-SELL'||p.intent==='HARD-SELL')
      const givePosts = cp.filter(p=>p.intent==='GIVE-VALUE')
      const topPost   = [...cp].sort((a,b)=>cmts(b)-cmts(a))[0]
      chAnalysis[ch] = { n:cp.length, posts:cp, avgCmts:mean(cp), topCTA:topCTA?.[0], topCTACount:topCTA?.[1], sellPosts, givePosts, topPost }
    }

    const sellPosts = posts.filter(p=>p.intent==='SOFT-SELL'||p.intent==='HARD-SELL')
    const givePosts = posts.filter(p=>p.intent==='GIVE-VALUE')
    const sellRatio = givePosts.length ? sellPosts.length/givePosts.length : 0
    const topPost = [...posts].filter(p=>cmts(p)>0).sort((a,b)=>cmts(b)-cmts(a))[0]
    const ckTotal = posts.filter(p=>p.cta_method==='COMMENT-KEYWORD').length
    const waTotal = posts.filter(p=>(p.dest_immediate||'').toLowerCase().includes('whatsapp')).length
    const primaryDestCounts = {}
    posts.forEach(p => { const d = p.dest_ultimate; if (d && d !== 'NONE' && d !== 'False') primaryDestCounts[d] = (primaryDestCounts[d] || 0) + 1 })
    const primaryDest = Object.entries(primaryDestCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? null
    const primaryDestTotal = primaryDest ? primaryDestCounts[primaryDest] : 0

    return {
      firstDate, lastDate, total: posts.length,
      campaigns, chAnalysis, sellPosts, givePosts, sellRatio,
      isSelling: sellRatio > 0.35, topPost,
      activeChannels: CHANNEL_ORDER.filter(ch=>chAnalysis[ch]),
      ckTotal, waTotal, primaryDest, primaryDestTotal,
    }
  }, [posts, campNames, campSells])

  if (!analysis) return (
    <div style={{ padding: 32, color: 'var(--tm)', fontFamily: 'var(--mono)' }}>No posts in current filter.</div>
  )

  const { campaigns, chAnalysis, sellPosts, givePosts, isSelling, topPost } = analysis
  const narrative = buildNarrative(analysis, posts, allPosts, name, isEden)

  const CTA_PLAIN = {
    'COMMENT-KEYWORD':    'asks people to comment a keyword → sends them a link via automated DM',
    'COMMENT-TO-RECEIVE': 'asks people to comment → replies manually with the link',
    'LINK-IN-COMMENT':    'puts the link in the first comment (not the caption — Facebook reduces reach on posts with links in the caption)',
    'LINK-IN-POST':       'link directly in the post',
    'WHATSAPP-JOIN':      'drives people to join a free WhatsApp group',
    'NONE':               'no CTA',
    'ENGAGEMENT-QUESTION':'asks a question to drive comments — no link or offer',
  }

  // Dynamic header based on filter
  const headerText = (() => {
    const base = `What is ${name} doing?`
    const labels = { '7d':'(last 7 days)', '14d':'(last 14 days)', '30d':'(last 30 days)', '90d':'(last 90 days)', '180d':'(last 6 months)', '360d':'(last 12 months)', '2026':'(2026)', '2025':'(2025)', '2024':'(2024)', 'All':'(all time)' }
    return `${base} ${labels[filterLabel] || (filterLabel ? `(${filterLabel})` : '(all time)')}`
  })()

  return (
    <div className="fade-in" style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>

      {/* ── LEFT: Main content ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 28 }}>

        <div style={{ borderBottom: '1px solid var(--bd)', paddingBottom: 14 }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--tm)', marginBottom: 4 }}>
            {analysis.firstDate?.toISOString().slice(0,10)} → {analysis.lastDate?.toISOString().slice(0,10)} · {analysis.total} posts
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--tp)' }}>{headerText}</div>
          <div style={{ fontSize: 13, color: 'var(--ts)', marginTop: 4 }}>Every underlined number or name opens the posts behind it.</div>
        </div>

        {/* Narrative summary */}
        <div style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 10, padding: '22px 24px', borderLeft: `4px solid ${isSelling ? 'var(--no)' : 'var(--ok)'}` }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--mono)', letterSpacing: '0.1em', color: 'var(--tm)', textTransform: 'uppercase', marginBottom: 20 }}>Summary</div>

          {narrative.map((section, si) => (
            <div key={si} style={{ marginBottom: si < narrative.length - 1 ? 26 : 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--mono)', letterSpacing: '0.12em', color: 'var(--tm)', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ height: 1, width: 14, background: 'var(--bd2)', flexShrink: 0 }} />
                {section.label}
                <div style={{ height: 1, flex: 1, background: 'var(--bd)' }} />
              </div>

              {section.type === 'channels' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {section.points.map((pt, pi) => {
                    if (pt.type === 'prose') return <p key={pi} style={{ fontSize: 15, color: 'var(--tp)', lineHeight: 1.8, margin: 0 }}>{pt.text}</p>
                    const color = CHANNEL_META[pt.ch]?.color || 'var(--ac)'
                    return (
                      <div key={pi} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingLeft: 4 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 8 }} />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: 'var(--mono)', marginRight: 8 }}>{pt.label}</span>
                          <span style={{ fontSize: 15, color: 'var(--ts)', lineHeight: 1.75 }}>{pt.desc}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {section.type === 'list' && (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {section.points.map((pt, pi) => (
                    <li key={pi} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ color: isSelling ? 'var(--no)' : 'var(--ok)', fontSize: 16, flexShrink: 0, lineHeight: 1.6, fontWeight: 700 }}>›</span>
                      <p style={{ fontSize: 15, color: 'var(--tp)', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-line' }}>{pt}</p>
                    </li>
                  ))}
                </ul>
              )}

              {section.type === 'simple' && (
                <p style={{ fontSize: 15, color: 'var(--ts)', lineHeight: 1.8, margin: 0 }}>{section.points[0]}</p>
              )}
            </div>
          ))}

          <div style={{ display: 'flex', gap: 12, marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--bd)', flexWrap: 'wrap' }}>
            <ClaimLink small onClick={() => setPanel({ title: `All posts (${analysis.total})`, posts: posts, color: 'var(--ac)' })}>{analysis.total} total posts →</ClaimLink>
            {sellPosts.length > 0 && <ClaimLink small onClick={() => setPanel({ title: `Sell posts (${sellPosts.length})`, posts: sellPosts, color: 'var(--no)' })}>{sellPosts.length} sell posts →</ClaimLink>}
            {givePosts.length > 0 && <ClaimLink small onClick={() => setPanel({ title: `Give-value posts (${givePosts.length})`, posts: givePosts, color: 'var(--ok)' })}>{givePosts.length} value posts →</ClaimLink>}
            {campaigns.map(c => (
              <ClaimLink key={c.id} small onClick={() => onNavigate?.('campaigns', { campaignId: c.id })}>{c.name} →</ClaimLink>
            ))}
          </div>
        </div>

        {/* Channels + Campaigns side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
          {/* Channels */}
          <div>
            <STitle>What each channel is doing</STitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {analysis.activeChannels.filter(ch => chAnalysis[ch]?.n >= 1).map(ch => {
                const d = chAnalysis[ch]
                const color = CHANNEL_META[ch]?.color || '#666'
                const isSellHeavy = d.sellPosts.length > d.givePosts.length
                const phaseColor = isSellHeavy ? 'var(--no)' : 'var(--ok)'
                const chanRole = isEden ? EDEN_CHAN_ROLE[ch] : buildChannelRole(ch, d)
                const chanHow  = isEden ? EDEN_CHAN_HOW[ch] : buildChannelHow(ch, d)

                return (
                  <div key={ch} style={{ background: 'var(--s2)', borderRadius: 8, border: '1px solid var(--bd)', borderLeft: `3px solid ${color}`, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color }}>{CHANNEL_LABELS[ch]}</span>
                      {chanRole && <span style={{ fontSize: 11, color: 'var(--ts)', fontStyle: 'italic' }}>— {chanRole}</span>}
                      <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: phaseColor+'22', color: phaseColor, border: `1px solid ${phaseColor}33`, marginLeft: 'auto' }}>
                        {isSellHeavy ? 'selling' : 'value'}
                      </span>
                    </div>
                    {chanHow && (
                      <div style={{ fontSize: 12, color: 'var(--ts)', lineHeight: 1.6, padding: '8px 10px', background: 'var(--s3)', borderRadius: 5, marginBottom: 8, borderLeft: `2px solid ${color}44` }}>
                        {chanHow}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ts)' }}>{d.n} posts · {d.avgCmts} avg</span>
                      {d.givePosts.length > 0 && <ClaimLink small onClick={() => setPanel({ title: `${CHANNEL_LABELS[ch]} value posts`, posts: d.givePosts, color })}>{d.givePosts.length} value →</ClaimLink>}
                      {d.sellPosts.length > 0 && <ClaimLink small onClick={() => setPanel({ title: `${CHANNEL_LABELS[ch]} sell posts`, posts: d.sellPosts, color: 'var(--no)' })}>{d.sellPosts.length} sell →</ClaimLink>}
                      {d.topPost && <ClaimLink small onClick={() => setPanel({ title: `Top — ${CHANNEL_LABELS[ch]}`, posts: [d.topPost], color })}>top ({cmts(d.topPost)} cmts) →</ClaimLink>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Campaigns */}
          <div>
            <STitle>Campaign structure</STitle>
            {campaigns.length === 0
              ? <div style={{ fontSize: 13, color: 'var(--ts)', padding: '16px', background: 'var(--s2)', borderRadius: 8, border: '1px solid var(--bd)' }}>
                  No coordinated campaigns in this period. {name} is posting standalone content without a launch structure.
                </div>
              : campaigns.map(c => {
                  const phaseColor = c.phase==='closing'?'var(--no)':c.phase==='selling'?'var(--wn)':'var(--ok)'
                  return (
                    <div key={c.id} style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 8, padding: '14px 16px', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tp)' }}>{c.name}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--mono)', padding: '2px 7px', borderRadius: 4, background: phaseColor+'22', color: phaseColor, border: `1px solid ${phaseColor}44`, textTransform: 'uppercase' }}>{c.phase}</span>
                        {c.isNew && <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--mono)', padding: '2px 7px', borderRadius: 4, background: '#60A5FA22', color: '#60A5FA', border: '1px solid #60A5FA44' }}>NEW</span>}
                      </div>
                      {c.sells && <div style={{ fontSize: 11, color: 'var(--wn)', fontFamily: 'var(--mono)', marginBottom: 10 }}>Selling → {c.sells}</div>}
                      <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--tm)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 7 }}>Channel sequence</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                        {c.channelBreakdown.map((cb, i) => {
                          const color = CHANNEL_META[cb.ch]?.color || '#666'
                          const ctaPlain = cb.topCTA && cb.topCTA !== 'NONE' ? (CTA_PLAIN[cb.topCTA]||cb.topCTA) : null
                          return (
                            <div key={cb.ch} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: 100, flexShrink: 0, paddingTop: 2 }}>
                                <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--tm)', width: 14, textAlign: 'right' }}>{i+1}.</span>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                                <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: 'var(--mono)' }}>{CHANNEL_LABELS[cb.ch]}</span>
                              </div>
                              <div style={{ flex: 1, fontSize: 12, color: 'var(--ts)', lineHeight: 1.55 }}>
                                <ClaimLink onClick={() => setPanel({ title: `${c.name} — ${CHANNEL_LABELS[cb.ch]}`, posts: cb.posts, color })}>{cb.n} post{cb.n>1?'s':''}</ClaimLink>
                                {ctaPlain ? ` — ${ctaPlain}` : ' — no CTA'}
                                {cb.avgCmts > 0 ? `. ${cb.avgCmts} avg cmts.` : '.'}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: 10, borderTop: '1px solid var(--bd)', paddingTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--tm)' }}>{c.firstDate?.toISOString().slice(0,10)} → {c.lastDate?.toISOString().slice(0,10)}</span>
                        <ClaimLink small onClick={() => setPanel({ title: c.name, posts: c.posts, color: 'var(--ac)' })}>see all posts →</ClaimLink>
                        <ClaimLink small onClick={() => onNavigate?.('campaigns', { campaignId: c.id })}>full detail →</ClaimLink>
                      </div>
                    </div>
                  )
                })
            }
          </div>
        </div>

        {/* Top post */}
        {topPost && (
          <div>
            <STitle>Highest-performing post in this period</STitle>
            <button onClick={() => setPanel({ title: 'Top post', posts: [topPost], color: CHANNEL_META[topPost.channel]?.color||'var(--ac)' })}
              style={{ width: '100%', textAlign: 'left', background: 'var(--s3)', border: `1px solid ${CHANNEL_META[topPost.channel]?.color||'#666'}33`, borderRadius: 8, padding: '14px 16px', cursor: 'pointer', transition: 'border-color 0.12s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = CHANNEL_META[topPost.channel]?.color||'#666'}
              onMouseLeave={e => e.currentTarget.style.borderColor = (CHANNEL_META[topPost.channel]?.color||'#666')+'33'}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: CHANNEL_META[topPost.channel]?.color||'#666', fontFamily: 'var(--mono)' }}>{CHANNEL_LABELS[topPost.channel]}</span>
                <span style={{ fontSize: 12, color: 'var(--ts)', fontFamily: 'var(--mono)' }}>{topPost.date_normalized}</span>
                {topPost.cta_method && topPost.cta_method !== 'False' && <span style={{ fontSize: 11, color: 'var(--ts)', fontFamily: 'var(--mono)', padding: '1px 6px', background: 'var(--s2)', borderRadius: 3, border: '1px solid var(--bd)' }}>{topPost.cta_method}</span>}
              </div>
              <div style={{ fontSize: 14, color: 'var(--tp)', lineHeight: 1.6, marginBottom: 10 }}>"{topPost.hook_text_english || topPost.hook_text_hebrew || '(no hook)'}"</div>
              <div style={{ display: 'flex', gap: 20 }}>
                <Stat label="comments" value={topPost.comments_n} color="var(--ac)" />
                <Stat label="likes" value={topPost.likes_n} color="var(--ts)" />
              </div>
            </button>
          </div>
        )}
      </div>

      {/* ── RIGHT: Funnel diagram ── */}
      <div style={{ width: 250, flexShrink: 0, position: 'sticky', top: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--mono)', letterSpacing: '0.1em', color: 'var(--tm)', textTransform: 'uppercase', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--bd)' }}>
          {name}'s Funnel
        </div>
        <div style={{ fontSize: 12, color: 'var(--ts)', marginBottom: 14, lineHeight: 1.5 }}>Hover any step to understand what it does.</div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {funnelNodes.map((node, i) => {
            const isHovered = hoveredNode === node.id
            const count = node.id==='lead' ? analysis.ckTotal : node.id==='wa_free' || node.id==='wa' ? analysis.waTotal : null
            return (
              <div key={node.id} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div onMouseEnter={() => setHoveredNode(node.id)} onMouseLeave={() => setHoveredNode(null)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 7, background: isHovered ? node.color+'22' : 'var(--s2)', border: `1px solid ${isHovered ? node.color : 'var(--bd)'}`, cursor: 'default', transition: 'all 0.15s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                    <div style={{ width: 9, height: 9, borderRadius: 2, background: node.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: isHovered ? node.color : 'var(--tp)' }}>{node.label}</span>
                    {count != null && count > 0 && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: node.color, marginLeft: 'auto' }}>{count}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ts)', paddingLeft: 16 }}>{node.sublabel}</div>
                </div>
                {isHovered && node.desc && (
                  <div style={{ width: '100%', padding: '10px 12px', background: 'var(--s3)', border: `1px solid ${node.color}44`, borderTop: 'none', borderRadius: '0 0 7px 7px', marginTop: -1 }}>
                    <div style={{ fontSize: 12, color: 'var(--tp)', lineHeight: 1.65 }}>{node.desc}</div>
                  </div>
                )}
                {i < funnelNodes.length - 1 && (
                  <div style={{ height: isHovered ? 10 : 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <div style={{ width: 1, height: 8, background: 'var(--bd2)' }} />
                    <div style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '5px solid var(--bd2)' }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 8 }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--mono)', letterSpacing: '0.08em', color: 'var(--tm)', marginBottom: 10, textTransform: 'uppercase' }}>In this period</div>
          {[
            { label: 'Posts capturing DM leads', value: analysis.ckTotal, color: '#A78BFA' },
            { label: 'Posts → WhatsApp', value: analysis.waTotal, color: '#25D366' },
            { label: analysis.primaryDest ? `Posts → ${analysis.primaryDest.slice(0,20)}` : 'Posts (no destination)', value: analysis.primaryDestTotal, color: '#F472B6' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--ts)', flex: 1 }}>{s.label}</span>
              <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--mono)', color: s.color, marginLeft: 8 }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {panel && <PostListPanel title={panel.title} posts={panel.posts} accentColor={panel.color??'var(--ac)'} onClose={() => setPanel(null)} />}
    </div>
  )
}

function STitle({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--mono)', letterSpacing: '0.1em', color: 'var(--tm)', textTransform: 'uppercase', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--bd)' }}>{children}</div>
}
function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--mono)', color: color || 'var(--tp)' }}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div style={{ fontSize: 11, color: 'var(--tm)', fontFamily: 'var(--mono)' }}>{label}</div>
    </div>
  )
}
function ClaimLink({ children, onClick, small }) {
  return (
    <button onClick={onClick} style={{
      fontSize: small ? 12 : 14, color: 'var(--ac)', fontFamily: 'var(--mono)',
      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
      textDecoration: 'underline', textDecorationColor: 'var(--ac)44',
    }}>{children}</button>
  )
}
