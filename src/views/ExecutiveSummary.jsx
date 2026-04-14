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
const CHAN_ROLE = {
  instagram:'Lead capture',fb_personal:'Warm broadcast',fb_group:'Testing ground',
  linkedin:'Authority — fires last',whatsapp:'Pre-launch — warmest audience',email:'Closes the sale',
  tiktok:'Reach — underinvested',youtube:'Long-form authority',
}
const CHAN_HOW = {
  instagram:"People comment a keyword, automation sends them a DM with the link. Every commenter becomes a tracked contact and the comment count signals reach to Instagram's algorithm.",
  fb_personal:"Facebook penalises posts with links in the caption, so links go in the first comment or require a comment to receive. Each reply signals engagement back to Facebook.",
  fb_group:"Large groups are where offers are tested before going public. A strong response is the green light to fire every other channel.",
  linkedin:"Always fires late, once there are real numbers from other channels to quote. LinkedIn's professional audience responds to social proof.",
  whatsapp:"Warmest audience gets the link before anything goes public. By the time social media sees the announcement, spots are already claimed — making any scarcity real.",
  email:"Email closes the sale. Pattern: email 1 delivers value, email 2 makes the offer, email 3 delivers more value with the offer mentioned again.",
  tiktok:"Large following potential, but requires consistent posting. Not typically part of campaign systems.",
  youtube:"Long-form tutorials and news commentary. Lower engagement than social channels — YouTube audiences consume without commenting the way Facebook audiences do.",
}

function buildNarrative(analysis, posts, allPosts, name) {
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

  const seqPoints = []

  if (campaigns.length > 0) {
    const activeChans = activeChannels.filter(ch => chAnalysis[ch]?.n >= 1)
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
  }

  for (const ch of activeChannels) {
    const d = chAnalysis[ch]; if (!d || d.n < 1) continue
    const isSellHeavy = d.sellPosts.length > d.givePosts.length
    seqPoints.push({
      type: 'channel', ch,
      label: `${CHANNEL_LABELS[ch]} — ${CHAN_ROLE[ch] || ''}`,
      desc: `${CHAN_HOW[ch] || ''}${isSellHeavy ? ' Sell-heavy this period.' : ''}`,
    })
  }

  const wwPoints = []
  const hookCounts = {}, hookComments = {}
  for (const p of posts) {
    if (!p.hook_type||p.hook_type==='False') continue
    hookCounts[p.hook_type] = (hookCounts[p.hook_type]||0)+1
    if (!hookComments[p.hook_type]) hookComments[p.hook_type]=[]
    hookComments[p.hook_type].push(p.comments_n||0)
  }
  const hookRanked = Object.entries(hookCounts).sort((a,b)=>b[1]-a[1])
  const topHook = hookRanked[0]
  const hookPerfRanked = Object.entries(hookComments)
    .filter(([,v])=>v.length>=2)
    .map(([k,v])=>[k, Math.round(v.reduce((a,b)=>a+b,0)/v.length), v.length])
    .sort((a,b)=>b[1]-a[1])
  const bestHook = hookPerfRanked[0]
  const worstHook = hookPerfRanked[hookPerfRanked.length-1]

  if (bestHook && topHook) {
    const topName  = HOOK_LABEL[topHook[0]]  || topHook[0].toLowerCase().replace(/-/g,' ')
    const bestName = HOOK_LABEL[bestHook[0]] || bestHook[0].toLowerCase().replace(/-/g,' ')
    const bestWhy  = HOOK_WHY[bestHook[0]]
    const topWhy   = HOOK_WHY[topHook[0]]
    if (bestHook[0] === topHook[0]) {
      wwPoints.push(`Most-used and best-performing hook: ${topName} — ${topWhy}. Averaging ${bestHook[1].toLocaleString()} comments across ${bestHook[2]} posts.`)
    } else {
      wwPoints.push(`Most-used hook: ${topName} — ${topWhy}.\nBest-performing: ${bestName} — ${bestWhy}. Averages ${bestHook[1].toLocaleString()} comments (${bestHook[2]} posts).`)
    }
    if (worstHook && worstHook[0]!==bestHook[0] && worstHook[0]!==topHook[0]) {
      wwPoints.push(`Weakest hook: ${HOOK_LABEL[worstHook[0]]||worstHook[0]} — in the mix but generating far less engagement than the others.`)
    }
  }

  const ctaCounts = {}
  for (const p of posts) { const k=p.cta_method; if(k&&k!=='False'&&k!=='NONE') ctaCounts[k]=(ctaCounts[k]||0)+1 }
  const topCTA = Object.entries(ctaCounts).sort((a,b)=>b[1]-a[1])[0]
  if (topCTA) {
    const CTA_WHY = {
      'COMMENT-KEYWORD':'people comment a keyword, get a link via automated DM — highest-volume lead capture mechanic',
      'COMMENT-TO-RECEIVE':'people comment anything and receive the link manually — lower volume but every reply is a genuine hand-raise',
      'LINK-IN-COMMENT':'link goes in the first comment, not the caption — Facebook buries posts with caption links',
      'LINK-IN-POST':'direct link in the post — works on channels like WhatsApp and Email where the algorithm doesn\'t penalise it',
      'ENGAGEMENT-QUESTION':'question with no link or offer — pure audience activation',
    }
    wwPoints.push(`Top CTA mechanic (${topCTA[1]} of ${total} posts): ${CTA_WHY[topCTA[0]] || topCTA[0]}.`)
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
  const narrative = buildNarrative(analysis, posts, allPosts, name)

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
                const ctaExplain = d.topCTA && d.topCTA !== 'NONE' && d.topCTA !== 'False' ? CTA_PLAIN[d.topCTA] : null
                const chanHow = CHAN_HOW[ch]
                const chanWhen = ch === 'instagram' ? 'Used throughout campaigns to collect leads.'
                  : ch === 'linkedin' ? 'Always fires late in a campaign, after social proof from other channels exists.'
                  : ch === 'whatsapp' ? 'Always fires first — 24-48 hours before the public launch.'
                  : ch === 'email' ? 'Fires during or after campaigns.'
                  : ch === 'fb_group' ? 'Usually the first or second channel to fire.'
                  : ch === 'fb_personal' ? 'Fires on campaign launch day alongside other channels.'
                  : null

                return (
                  <div key={ch} style={{ background: 'var(--s2)', borderRadius: 8, border: '1px solid var(--bd)', borderLeft: `3px solid ${color}`, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color }}>{CHANNEL_LABELS[ch]}</span>
                      {CHAN_ROLE[ch] && <span style={{ fontSize: 11, color: 'var(--ts)', fontStyle: 'italic' }}>— {CHAN_ROLE[ch]}</span>}
                      <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: phaseColor+'22', color: phaseColor, border: `1px solid ${phaseColor}33`, marginLeft: 'auto' }}>
                        {isSellHeavy ? 'selling' : 'value'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--tp)', lineHeight: 1.65, marginBottom: 6 }}>
                      {ctaExplain
                        ? <>{d.topCTACount} of {d.n} posts {ctaExplain}. {chanWhen && <span style={{ color: 'var(--ts)' }}>{chanWhen}</span>}</>
                        : <span style={{ color: 'var(--ts)' }}>All {d.n} posts have no CTA — awareness only. {chanWhen}</span>
                      }
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
