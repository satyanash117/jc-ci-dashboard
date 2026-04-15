import { useState, useMemo } from 'react'
import { CHANNEL_LABELS, CHANNEL_META } from '../useData.js'
import { PostListPanel } from '../PostPanel.jsx'

const EXCLUDED_IDS = new Set(['NONE', 'UNKNOWN', 'STANDALONE', 'SERIES', ''])

// ── Eden Bibas campaign intel (hardcoded for quality) ─────────────────────────
const EDEN_CAMPAIGN_INTEL = {
  'CAMP-Claude-Code-Mar26': {
    title: 'The Shelter Challenge (Claude Code)',
    description: 'Eden gave away a free 3-day challenge teaching people to build apps with Claude Code — he named it the "Shelter Challenge" because the hook was: instead of drowning in the news, use this time to learn the hottest AI tool of 2026. He seeded the topic two weeks early on Instagram without mentioning any challenge, collected 1,482 leads, then announced to his Facebook group first with a single question: "who should I send a link to?" — 1,700 people commented. The next day he fired five channels simultaneously. 12,000 people registered total. LinkedIn was held back until day three, when he could post the 12,000 number alongside the announcement — his LinkedIn post got 1,294 comments, the highest of any LinkedIn post he has ever made. At the end of the challenge he sold Brainers Club membership.',
    sells: 'Brainers Club membership',
    arc: [
      { beat: '2 weeks before (Feb 17)', color: '#60A5FA', desc: 'Eden posts on Instagram about Claude Cowork — no mention of any challenge. He asks people to comment the word "Claude" and his automation sends them the guide. 1,482 people comment. He now has a list of people who care about Claude specifically, before the challenge exists.' },
      { beat: 'First announcement (Mar 1)', color: '#38BDF8', desc: 'He announces on FB Group with a single line: "Instead of getting sucked into the news — I decided to launch a free 3-day challenge. Who should I send a link to?" That\'s the entire post. 1,700 people comment.' },
      { beat: 'Full launch (Mar 2)', color: '#FBBF24', desc: 'Five channels go out the same day. Facebook Personal uses first-comment link workaround. Instagram uses comment-keyword DM. WhatsApp and Email send the link directly.' },
      { beat: 'Last chance (Mar 3)', color: '#F97316', desc: '"Last chance to join the free Claude Code for Beginners challenge happening tomorrow." One sentence. Goes out on Facebook Personal, WhatsApp, and FB Group.' },
      { beat: 'Social proof (Mar 4)', color: '#34D399', desc: '"Thank you to 12,000 people who registered for the Claude Code challenge." No link, nothing to click. Just the number.' },
      { beat: 'LinkedIn (Mar 5–6)', color: '#A78BFA', desc: 'LinkedIn gets the challenge announcement three days after everyone else. 1,294 people comment — the highest engagement on any LinkedIn post in his history.' },
    ],
  },
  'CAMP-Womens-Month-Feb26': {
    title: "Women's Month — ₪1 Trial",
    description: "Eden offered full access to Brainers Club for ₪1 for the first month — no commitment, cancel anytime. The hook: Women's Day always feels like a one-day token gesture, so instead of an inspirational post he made a real offer. He built up to it with a single teaser email the day before — 'tomorrow it's happening, no details' — then hit Facebook Personal, Email, and WhatsApp simultaneously with the offer.",
    sells: "Brainers Club ₪1 first month → ₪49/month",
    arc: [
      { beat: 'Email warm-up (Feb 24)', color: '#38BDF8', desc: '"Women, pay attention. Tomorrow I am going to reveal something completely different." No link, no offer. One email, one sentence of anticipation.' },
      { beat: 'The sell (Feb 25–26)', color: '#F43F5E', desc: 'Facebook Personal frames the ₪1 trial as the real Women\'s Day alternative. Email hits the same day with "Special offer for the next 72 hours only." A third email the next day shows the workshop schedule.' },
    ],
  },
  'CAMP-AI-Solutions-Mar26': {
    title: 'AI Solutions Developer Course',
    description: 'Eden launched cohort 3 of a paid course teaching people to become AI solution builders for businesses. The pitch: 700,000+ Israeli businesses are still running on spreadsheets — they need someone to build them a custom solution. He pre-loaded 400 spots via WhatsApp before any public post went live — by the time Facebook saw it, the scarcity was already real.',
    sells: 'AI Solutions Developer paid course',
    arc: [
      { beat: 'WhatsApp teaser (Mar 9)', color: '#38BDF8', desc: '"Also, tomorrow at 20:00 there will be a one-time opportunity here." No course name, no price, no details. Just enough to make the WhatsApp group show up tomorrow.' },
      { beat: 'Public launch (Mar 10)', color: '#34D399', desc: 'Facebook Personal: comment the word "פתרונות" to get the live webinar link. "Two cohorts ran quietly with 130+ students and sold out in 72 hours. Spots limited to 1,000 — 400 already taken from WhatsApp."' },
    ],
  },
  'CAMP-NotebookLM-Feb26': {
    title: 'NotebookLM Workshop',
    description: 'Eden ran a free live workshop on NotebookLM. The catch: to get the workshop details, you had to join his free WhatsApp group first. Three weeks later he released the recording for free to anyone who asked — that post got 772 comments on Facebook Personal and 1,400 comments in his FB Group, more than the original announcement.',
    sells: 'WhatsApp Free group → Brainers Club',
    arc: [
      { beat: 'Announcement (Jan 15–16)', color: '#38BDF8', desc: 'Facebook Personal posts about four NotebookLM features most people miss. The link goes to his WhatsApp group, not a registration page.' },
      { beat: 'Recording released (Jan 26)', color: '#FBBF24', desc: '"After many requests: I decided to release the workshop recording. Who should I send the link to?" — 772 people comment. FB Group: 1,400 comments.' },
    ],
  },
  'CAMP-Gemini-Workshop-Feb26': {
    title: 'Gemini Workshop + 50% Off',
    description: 'Eden ran a free live workshop on switching from ChatGPT to Gemini, announced with "who should I send the link to?" — 604 people commented. Then an email sequence: email one delivered the recording, email two offered Brainers Club at 50% off, email three gave a free tutorial with the offer mentioned at the bottom.',
    sells: 'Brainers Club at 50% off',
    arc: [
      { beat: 'Demand check (Feb 5)', color: '#38BDF8', desc: '"Everyone is switching to Gemini! Who should I send the link to?" — 604 people comment.' },
      { beat: 'Three emails (Feb 20–23)', color: '#FBBF24', desc: 'Email 1: delivers the workshop recording, no offer. Email 2: 50% off Brainers Club. Email 3: free content tip with the 50% offer mentioned at the end.' },
    ],
  },
  'CAMP-Brainstorm-Oct25': {
    title: 'Brainstorm Conference',
    description: 'Eden spoke at the Brainstorm conference — Israel\'s largest tech event. He turned one appearance into three weeks of content: anticipation posts before the event, posts on event day, then nine days of recaps showing him on stage. Three separate recap posts over nine days. He sold nothing. The entire thing exists to establish authority.',
    sells: 'Nothing — pure authority building',
    arc: [
      { beat: 'Building anticipation (Oct 7–9)', color: '#38BDF8', desc: '"This is one of the most exciting moments I\'ve had since I entered the AI field." He\'s making his community feel like they\'re part of something that hasn\'t happened yet.' },
      { beat: 'Event day (Oct 16)', color: '#FBBF24', desc: '"I can\'t believe tomorrow is actually happening." No links, no CTAs, just genuine excitement.' },
      { beat: 'Milking the aftermath (Oct 19–28)', color: '#34D399', desc: 'Three separate recap posts over nine days. One conference appearance becomes three weeks of authority content.' },
    ],
  },
  'CAMP-100K-Challenge': {
    title: '100K Community Challenge',
    description: 'Eden ran a 90-day public challenge to grow his Facebook Group from 50,000 to 100,000 members. He trained an AI consultant on community growth strategies and shared its daily recommendations publicly — turning the AI itself into the content. The group went from 50K to 77,700 in 45 days — 800 new members per day at peak.',
    sells: 'Community growth → Brainers Club',
  },
  'CAMP-BRAINERSCLUB-May25': {
    title: 'Brainers Club Recruitment',
    description: 'A recurring Brainers Club promotion inside the FB Group — milestone celebrations, anniversary flash sales (₪1 first month), and re-opening announcements when the club had been closed. His highest-performing post in this series got 923 comments — a midnight deadline post with the direct purchase link.',
    sells: 'Brainers Club membership',
  },
  'CAMP-LEARN-AI-CHALLENGE-May25': {
    title: 'Learn AI Challenge',
    description: 'Eden ran a free challenge on FB Personal teaching people how to use AI to learn anything faster. The challenge ran for 24 days. Brainers Club was offered at the end.',
    sells: 'Brainers Club via challenge funnel',
  },
  'CAMP-MONEYMAKER-Jan24': {
    title: 'AI MoneyMaker Course Launch',
    description: 'Eden\'s first major paid course launch. The course taught people how to make money using AI. He ran 10 posts over 26 days, all on FB Personal — two weeks of give-value content, then a hard-sell push for the course.',
    sells: 'AI MoneyMaker course',
  },
  'CAMP-AIBUSINESS-Apr25': {
    title: 'AI Business Program',
    description: 'Eden promoted a course on using AI for business owners. Five posts over 9 days on FB Personal, all soft-sell. He drove people to a free live workshop first, then offered the course to attendees.',
    sells: 'AI Business course',
  },
  'CAMP-CONTENTMASTERS-Mar24': {
    title: 'Content Masters Course',
    description: 'Eden launched a course on creating content with AI. Compressed into just 3 days: a warm-up post, then hard-sell, then a deadline extension. One of his fastest campaign timelines.',
    sells: 'Content Masters course → Brainers Club',
  },
  'CAMP-AILIFE-LAUNCH-Sep23': {
    title: 'AI Life Club Launch',
    description: 'Eden\'s first membership product launch — the AI Life club, which later became Brainers Club. He ran 7 posts over a full month on FB Personal: a slow warm-up, then a hard-sell push. Everything he does today started here.',
    sells: 'AI Life club subscription (now Brainers Club)',
  },
  'CAMP-AILIFE-RECRUIT-Nov23': {
    title: 'AI Life Recruitment Drive',
    description: 'A recruitment push for the AI Life club (now Brainers Club) two months after the original launch. Five posts over two weeks on FB Personal — personal stories and social proof rather than direct selling.',
    sells: 'AI Life club subscription',
  },
  'CAMP-OCT7-UNITY-Oct23': {
    title: 'Oct 7 Community Response',
    description: 'Five posts in two days immediately after October 7. Eden used his platform to mobilize community support. No offers, no links to products. This is the only campaign in the dataset with zero monetization intent.',
    sells: 'Nothing — community response',
  },
  'CAMP-NEWSVIDEO-Nov24': {
    title: 'News Video Launch',
    description: 'Eden launched what he called the first AI news video in Israel — a weekly short video emailed to subscribers. The announcement post in FB Group got 732 comments on a comment-to-receive CTA.',
    sells: 'News video subscriber list → Brainers Club',
  },
}

// Generates a data-driven campaign description when no AI intel is available
function buildCampaignFallbackDesc(campaign) {
  const { posts, channels, durationDays, dateMin, dateMax } = campaign
  if (!posts?.length) return <span style={{ color: 'var(--tm)', fontStyle: 'italic' }}>No post data available.</span>

  const dateRange = dateMin && dateMax
    ? `${dateMin.toISOString().slice(0,10)} → ${dateMax.toISOString().slice(0,10)}`
    : null

  // Sell vs value
  const sellPosts = posts.filter(p => p.intent === 'SOFT-SELL' || p.intent === 'HARD-SELL')
  const givePosts = posts.filter(p => p.intent === 'GIVE-VALUE')
  const sellPct   = Math.round(sellPosts.length / posts.length * 100)

  // Destinations
  const destCounts = {}
  for (const p of posts) {
    const d = p.dest_ultimate
    if (d && d !== 'Awareness only' && d !== 'NONE' && d !== 'False' && d.trim())
      destCounts[d] = (destCounts[d] || 0) + 1
  }
  const topDest = Object.entries(destCounts).sort((a, b) => b[1] - a[1])[0]

  // CTA methods
  const ctaCounts = {}
  for (const p of posts) { const k = p.cta_method; if (k && k !== 'NONE' && k !== 'False') ctaCounts[k] = (ctaCounts[k] || 0) + 1 }
  const topCta = Object.entries(ctaCounts).sort((a, b) => b[1] - a[1])[0]
  const CTA_PLAIN = {
    'COMMENT-KEYWORD':    'comment-keyword automation (followers comment a word → receive link via DM)',
    'COMMENT-TO-RECEIVE': 'comment-to-receive (followers comment → manually sent the link)',
    'LINK-IN-POST':       'direct link in the post',
    'LINK-IN-COMMENT':    'link placed in the first comment',
    'WHATSAPP-JOIN':      'WhatsApp group join link',
  }

  // Sample hooks
  const hooks = posts.map(p => p.hook_text_english || p.hook_text_hebrew || '').filter(Boolean).slice(0, 2)

  // Sequence positions
  const seqCounts = {}
  for (const p of posts) { const s = p.sequence_position; if (s && s !== 'STANDALONE') seqCounts[s] = (seqCounts[s] || 0) + 1 }
  const seqSummary = Object.keys(seqCounts).join(' → ')

  const parts = []
  parts.push(`${posts.length}-post campaign across ${channels.length === 1 ? channels[0] : channels.join(', ')}${dateRange ? `, running ${dateRange}` : ''}${durationDays ? ` (${durationDays} days)` : ''}.`)
  if (topDest) parts.push(`Driving to: ${topDest[0]}${topDest[1] > 1 ? ` — ${topDest[1]} posts point here` : ''}.`)
  if (topCta)  parts.push(`Primary mechanic: ${CTA_PLAIN[topCta[0]] || topCta[0]} (${topCta[1]} of ${posts.length} posts).`)
  if (sellPct > 0) parts.push(`Content mix: ${100 - sellPct}% value, ${sellPct}% selling.`)
  if (seqSummary) parts.push(`Sequence arc: ${seqSummary}.`)
  if (hooks.length) parts.push(`Sample opening lines: "${hooks[0]}"${hooks[1] ? ` / "${hooks[1]}"` : ''}.`)

  return <span>{parts.join(' ')}</span>
}

const CAMP_SORT_OPTIONS = [
  { id: 'posts', label: 'Post Count' },
  { id: 'avg', label: 'Avg Comments' },
  { id: 'total', label: 'Total Comments' },
  { id: 'recent', label: 'Most Recent' },
  { id: 'duration', label: 'Duration' },
]

export default function ViewCampaigns({ posts, paidAds = [], competitor, aiSummary, initialCampaignId, onNavigate }) {
  const [selectedId, setSelectedId] = useState(initialCampaignId ?? null)
  const [postPanel, setPostPanel] = useState(null)
  const [arcOpen, setArcOpen] = useState(true)
  const [campSort, setCampSort] = useState('posts')
  const [postSort, setPostSort] = useState('date')
  const [postChannelFilter, setPostChannelFilter] = useState(null)

  const isEden = competitor?.slug === 'eden_bibas'

  // Merge intel sources: Eden hardcoded > aiSummary > empty
  const campaignIntelMap = useMemo(() => {
    if (isEden) return EDEN_CAMPAIGN_INTEL
    return aiSummary?.campaignIntel ?? {}
  }, [isEden, aiSummary])

  const campaigns = useMemo(() => {
    const map = {}
    for (const p of posts) {
      const id = p.campaign_id; if (!id || EXCLUDED_IDS.has(id)) continue
      if (!map[id]) map[id] = { id, posts: [], channels: new Set(), dateMin: null, dateMax: null }
      map[id].posts.push(p); map[id].channels.add(p.channel)
      if (p.date_obj) {
        if (!map[id].dateMin || p.date_obj < map[id].dateMin) map[id].dateMin = p.date_obj
        if (!map[id].dateMax || p.date_obj > map[id].dateMax) map[id].dateMax = p.date_obj
      }
    }
    const list = Object.values(map).map(c => ({
      ...c, channels: [...c.channels],
      durationDays: c.dateMin && c.dateMax ? Math.round((c.dateMax - c.dateMin) / 86400000) + 1 : null,
      intel: campaignIntelMap[c.id] ?? null,
      avgComments: Math.round(c.posts.reduce((s, p) => s + p.comments_n, 0) / c.posts.length),
      totalComments: c.posts.reduce((s, p) => s + p.comments_n, 0),
    }))
    if (campSort === 'avg') list.sort((a, b) => b.avgComments - a.avgComments)
    else if (campSort === 'total') list.sort((a, b) => b.totalComments - a.totalComments)
    else if (campSort === 'recent') list.sort((a, b) => (b.dateMax ?? 0) - (a.dateMax ?? 0))
    else if (campSort === 'duration') list.sort((a, b) => (b.durationDays ?? 0) - (a.durationDays ?? 0))
    else list.sort((a, b) => b.posts.length - a.posts.length)
    return list
  }, [posts, campSort, campaignIntelMap])

  const paidByCampaign = useMemo(() => {
    const map = {}
    for (const a of paidAds) { const id = a.campaign_id; if (id) { if (!map[id]) map[id] = []; map[id].push(a) } }
    return map
  }, [paidAds])

  const selected = campaigns.find(c => c.id === selectedId) ?? campaigns[0]
  const campaignPosts = useMemo(() => {
    if (!selected) return []
    let list = postChannelFilter ? selected.posts.filter(p => p.channel === postChannelFilter) : selected.posts
    if (postSort === 'comments') list = [...list].sort((a, b) => b.comments_n - a.comments_n)
    else if (postSort === 'likes') list = [...list].sort((a, b) => b.likes_n - a.likes_n)
    else list = [...list].sort((a, b) => (a.date_obj ?? 0) - (b.date_obj ?? 0))
    return list
  }, [selected, postSort, postChannelFilter])

  if (!campaigns.length) return (
    <div style={{ color: 'var(--tm)', padding: 24, fontFamily: 'var(--mono)' }}>No campaigns in current filter.</div>
  )

  return (
    <div className="fade-in" style={{ display: 'flex', gap: 20, height: '100%' }}>
      {/* Campaign list */}
      <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--tm)', fontFamily: 'var(--mono)' }}>CAMPAIGNS ({campaigns.length})</span>
        </div>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
          {CAMP_SORT_OPTIONS.map(s => (
            <button key={s.id} onClick={() => setCampSort(s.id)}
              style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: campSort === s.id ? 700 : 500, fontFamily: 'var(--mono)',
                background: campSort === s.id ? 'var(--ac2)' : 'var(--s3)', color: campSort === s.id ? '#fff' : 'var(--tm)',
                border: `1px solid ${campSort === s.id ? 'var(--ac2)' : 'var(--bd)'}` }}>{s.label}</button>
          ))}
        </div>
        {campaigns.map(c => {
          const intel = c.intel; const isSel = selected?.id === c.id
          const hasPaid = !!paidByCampaign[c.id]?.length
          return (
            <button key={c.id} onClick={() => { setSelectedId(c.id); setPostChannelFilter(null) }}
              style={{ padding: '12px 14px', borderRadius: 8, textAlign: 'left', width: '100%',
                background: isSel ? 'var(--s3)' : 'var(--s2)', border: `1px solid ${isSel ? 'var(--ac)' : 'var(--bd)'}`, transition: 'all 0.15s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: isSel ? 'var(--tp)' : 'var(--ts)', flex: 1 }}>{intel?.title ?? c.id.replace(/^CAMP-/, '').replace(/-/g, ' ')}</div>
                {hasPaid && <span style={{ fontSize: 9, fontFamily: 'var(--mono)', fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: '#F43F5E22', color: '#F43F5E', border: '1px solid #F43F5E33' }}>PAID</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--tm)', marginTop: 8 }}>
                <span>{c.posts.length} posts</span><span>{c.avgComments} avg cmts</span>{c.durationDays && <span>{c.durationDays}d</span>}
              </div>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 4 }}>
                {c.channels.map(ch => (
                  <span key={ch} style={{ fontSize: 9, fontFamily: 'var(--mono)', fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: (CHANNEL_META[ch]?.color || '#666') + '22', color: CHANNEL_META[ch]?.color || '#666' }}>{CHANNEL_LABELS[ch]}</span>
                ))}
              </div>
            </button>
          )
        })}
      </div>

      {/* Campaign detail */}
      {selected && (
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--tp)', marginBottom: 4 }}>{selected.intel?.title ?? selected.id.replace(/^CAMP-/, '').replace(/-/g, ' ')}</div>
            {selected.intel?.sells && <div style={{ fontSize: 14, color: 'var(--wn)', fontFamily: 'var(--mono)' }}>Sells → {selected.intel.sells}</div>}
          </div>

          <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg,#111827 0%,#0D1320 100%)', border: '1px solid var(--bd)', borderRadius: 10, borderLeft: '4px solid var(--ac)' }}>
            <div style={{ fontSize: 16, color: 'var(--tp)', lineHeight: 1.7 }}>
              {selected.intel?.description ?? buildCampaignFallbackDesc(selected)}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              ['Posts', selected.posts.length, null],
              ['Avg Comments', selected.avgComments, selected.avgComments >= 200 ? '#34D399' : selected.avgComments >= 50 ? '#FBBF24' : '#F43F5E'],
              ['Total Comments', selected.totalComments, null],
              ['Channels', selected.channels.length, null],
              selected.durationDays && ['Duration', selected.durationDays + 'd', null],
            ].filter(Boolean).map(([l, v, c]) => (
              <button key={l} onClick={() => setPostPanel({ title: `${selected.intel?.title || selected.id} — all posts`, posts: selected.posts, color: 'var(--ac)' })}
                style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--s2)', border: '1px solid var(--bd)', textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--ac)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--bd)'}>
                <div style={{ fontSize: 10, color: 'var(--tm)', fontFamily: 'var(--mono)', letterSpacing: '0.06em' }}>{l.toUpperCase()}</div>
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--mono)', color: c || 'var(--tp)' }}>{v}</div>
              </button>
            ))}
          </div>

          <CampaignTimeline campaign={selected} onPostClick={p => setPostPanel({ title: 'Post detail', posts: [p], color: CHANNEL_META[p.channel]?.color || '#666' })} paidAds={paidAds} />

          {selected.intel?.arc && (
            <div style={{ border: '1px solid var(--bd)', borderRadius: 10, overflow: 'hidden' }}>
              <button onClick={() => setArcOpen(o => !o)} style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, background: arcOpen ? 'var(--s3)' : 'var(--s2)', textAlign: 'left' }}>
                <span style={{ fontSize: 13, color: 'var(--tm)' }}>{arcOpen ? '▾' : '▸'}</span>
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ac)', fontFamily: 'var(--mono)' }}>CAMPAIGN NARRATIVE</span>
                <span style={{ fontSize: 12, color: 'var(--tm)' }}>— {selected.intel.arc.length} beats</span>
              </button>
              {arcOpen && (
                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--bd)' }}>
                  <div style={{ display: 'flex', gap: 2, marginBottom: 16, height: 8, borderRadius: 4, overflow: 'hidden' }}>
                    {selected.intel.arc.map((beat, i) => (
                      <div key={i} style={{ flex: 1, background: beat.color, borderRadius: i === 0 ? '4px 0 0 4px' : i === selected.intel.arc.length - 1 ? '0 4px 4px 0' : 0 }} title={beat.beat} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selected.intel.arc.map((beat, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div style={{ width: 4, minHeight: 32, alignSelf: 'stretch', background: beat.color, borderRadius: 2, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: beat.color, marginBottom: 2 }}>{beat.beat}</div>
                          <div style={{ fontSize: 13, color: 'var(--ts)', lineHeight: 1.55 }}>{beat.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--tm)', fontFamily: 'var(--mono)', marginBottom: 8 }}>POSTS BY CHANNEL</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {selected.channels.map(ch => {
                const chPosts = selected.posts.filter(p => p.channel === ch); const color = CHANNEL_META[ch]?.color || '#666'
                return (
                  <button key={ch} onClick={() => setPostPanel({ title: `${CHANNEL_LABELS[ch]} — ${selected.intel?.title || selected.id}`, posts: chPosts, color })}
                    style={{ padding: '8px 14px', borderRadius: 8, background: color + '12', border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', transition: 'border-color 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = color} onMouseLeave={e => e.currentTarget.style.borderColor = color + '33'}>
                    <div style={{ width: 3, height: 20, background: color, borderRadius: 2 }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: 'var(--mono)' }}>{CHANNEL_LABELS[ch]}</span>
                    <span style={{ fontSize: 13, fontFamily: 'var(--mono)', color: 'var(--tm)' }}>{chPosts.length}</span>
                    <span style={{ fontSize: 11, color: 'var(--ac)', fontFamily: 'var(--mono)' }}>→</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--tm)', fontFamily: 'var(--mono)' }}>POSTS</span>
              <div style={{ display: 'flex', gap: 3 }}>
                {[{ id: 'date', label: 'Date' }, { id: 'comments', label: 'Comments' }, { id: 'likes', label: 'Likes' }].map(s => (
                  <button key={s.id} onClick={() => setPostSort(s.id)}
                    style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: postSort === s.id ? 700 : 500, fontFamily: 'var(--mono)',
                      background: postSort === s.id ? 'var(--ac2)' : 'var(--s3)', color: postSort === s.id ? '#fff' : 'var(--tm)',
                      border: `1px solid ${postSort === s.id ? 'var(--ac2)' : 'var(--bd)'}` }}>{s.label}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 3 }}>
                <button onClick={() => setPostChannelFilter(null)}
                  style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, fontFamily: 'var(--mono)',
                    background: !postChannelFilter ? 'var(--ac2)' : 'var(--s3)', color: !postChannelFilter ? '#fff' : 'var(--tm)',
                    border: `1px solid ${!postChannelFilter ? 'var(--ac2)' : 'var(--bd)'}` }}>All</button>
                {selected.channels.map(ch => (
                  <button key={ch} onClick={() => setPostChannelFilter(postChannelFilter === ch ? null : ch)}
                    style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, fontFamily: 'var(--mono)',
                      background: postChannelFilter === ch ? (CHANNEL_META[ch]?.color || '#666') + '22' : 'var(--s3)',
                      color: postChannelFilter === ch ? (CHANNEL_META[ch]?.color || '#666') : 'var(--tm)',
                      border: `1px solid ${postChannelFilter === ch ? (CHANNEL_META[ch]?.color || '#666') + '55' : 'var(--bd)'}` }}>{CHANNEL_LABELS[ch]}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {campaignPosts.map((p, i) => {
                const color = CHANNEL_META[p.channel]?.color || '#666'
                return (
                  <button key={p.id || i} onClick={() => setPostPanel({ title: 'Post detail', posts: [p], color })}
                    style={{ padding: '8px 12px', background: 'var(--s2)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center', border: '1px solid var(--bd)', width: '100%', textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = color} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--bd)'}>
                    <div style={{ width: 3, alignSelf: 'stretch', background: color, borderRadius: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: 'var(--ts)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.hook_text_english || p.hook_text_hebrew || '(no hook)'}</div>
                      <div style={{ display: 'flex', gap: 6, fontSize: 11, fontFamily: 'var(--mono)' }}>
                        <span style={{ color, fontWeight: 700 }}>{CHANNEL_LABELS[p.channel]}</span>
                        <span style={{ color: 'var(--tm)' }}>{p.date_normalized}</span>
                        {p.intent && p.intent !== 'False' && <span style={{ color: '#FB923C' }}>{p.intent}</span>}
                      </div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--tp)', flexShrink: 0 }}>{p.comments_n >= 1000 ? (p.comments_n / 1000).toFixed(1) + 'K' : p.comments_n}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {postPanel && <PostListPanel title={postPanel.title} subtitle={postPanel.subtitle} posts={postPanel.posts} accentColor={postPanel.color ?? '#38BDF8'} onClose={() => setPostPanel(null)} />}
    </div>
  )
}

// ── Campaign Timeline ─────────────────────────────────────────────────────────

const CHANNEL_ORDER = ['instagram', 'fb_personal', 'linkedin', 'whatsapp', 'email', 'fb_group', 'tiktok', 'youtube', 'threads']
const INTENT_COLORS_LOCAL = {
  'GIVE-VALUE': '#34D399', 'SOFT-SELL': '#FB923C', 'HARD-SELL': '#F43F5E', 'URGENCY': '#F97316',
  'SOCIAL-PROOF': '#60A5FA', 'WARM-UP': '#A78BFA', 'COMMUNITY-BUILDING': '#22D3EE', 'AUTHORITY': '#818CF8',
}
const INTENT_ABBR = {
  'GIVE-VALUE': 'GV', 'SOFT-SELL': 'SS', 'HARD-SELL': 'HS', 'URGENCY': 'UR',
  'SOCIAL-PROOF': 'SP', 'WARM-UP': 'WU', 'COMMUNITY-BUILDING': 'CB', 'AUTHORITY': 'AU',
}

function CampaignTimeline({ campaign, onPostClick, paidAds = [] }) {
  const [tooltip, setTooltip] = useState(null)
  const channels = CHANNEL_ORDER.filter(ch => campaign.channels.includes(ch))
  const dates = campaign.posts.filter(p => p.date_obj).map(p => p.date_obj)
  if (!dates.length) return <div style={{ color: 'var(--tm)', fontSize: 13, fontFamily: 'var(--mono)' }}>No dated posts in this campaign.</div>

  const minDate = new Date(Math.min(...dates))
  const maxDate = new Date(Math.max(...dates))
  const totalDays = Math.max(Math.round((maxDate - minDate) / 86400000) + 1, 1)

  const dayLabels = []
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(minDate); d.setDate(d.getDate() + i)
    dayLabels.push(d.toISOString().slice(0, 10))
  }

  const matchingPaidAds = paidAds.filter(a => a.campaign_id === campaign.id)
  const matchingPaidCampIds = [...new Set(matchingPaidAds.map(a => a.campaign_id))].filter(Boolean)

  const DOT = 26, ROW_H = 42
  const COL_W = Math.max(DOT + 6, Math.min(68, 600 / totalDays))
  const LABEL_W = 100

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--tm)', marginBottom: 10, fontFamily: 'var(--mono)' }}>CAMPAIGN TIMELINE</div>
      <div style={{ overflowX: 'auto', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 10, padding: 14 }}>
        <div style={{ minWidth: LABEL_W + dayLabels.length * COL_W }}>
          <div style={{ display: 'flex', marginBottom: 6, marginLeft: LABEL_W }}>
            {dayLabels.map((d, i) => (
              <div key={d} style={{ width: COL_W, flexShrink: 0, fontSize: 10, color: 'var(--tm)', fontFamily: 'var(--mono)', textAlign: 'center', overflow: 'hidden' }}>
                {i % Math.max(1, Math.floor(totalDays / 8)) === 0 ? d.slice(5) : ''}
              </div>
            ))}
          </div>
          {channels.map(ch => {
            const color = CHANNEL_META[ch]?.color ?? '#666'
            const chPosts = campaign.posts.filter(p => p.channel === ch && p.date_obj)
            return (
              <div key={ch} style={{ display: 'flex', alignItems: 'center', height: ROW_H, borderTop: '1px solid var(--bd)' }}>
                <div style={{ width: LABEL_W, flexShrink: 0, fontSize: 12, color, fontFamily: 'var(--mono)', fontWeight: 700, paddingRight: 6 }}>{CHANNEL_LABELS[ch]}</div>
                <div style={{ display: 'flex', flex: 1 }}>
                  {dayLabels.map(day => {
                    const dayPosts = chPosts.filter(p => p.date_obj.toISOString().slice(0, 10) === day)
                    return (
                      <div key={day} style={{ width: COL_W, flexShrink: 0, height: ROW_H, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                        {dayPosts.map(p => {
                          const ic = INTENT_COLORS_LOCAL[p.intent] ?? color
                          const abbr = INTENT_ABBR[p.intent] ?? '·'
                          return (
                            <button key={p.id} onClick={() => onPostClick(p)}
                              onMouseEnter={e => { const r = e.currentTarget.getBoundingClientRect(); setTooltip({ post: p, x: r.left, y: r.top }); e.currentTarget.style.transform = 'scale(1.25)' }}
                              onMouseLeave={e => { setTooltip(null); e.currentTarget.style.transform = 'scale(1)' }}
                              style={{ width: DOT, height: DOT, borderRadius: '50%', background: ic + '2a', border: `2px solid ${ic}`, cursor: 'pointer', flexShrink: 0, transition: 'transform 0.12s', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: ic, fontFamily: 'var(--mono)' }}>
                              {abbr}
                            </button>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            {Object.entries(INTENT_COLORS_LOCAL).map(([intent, color]) => (
              <div key={intent} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: color + '2a', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color, fontFamily: 'var(--mono)' }}>{INTENT_ABBR[intent] ?? '·'}</div>
                <span style={{ fontSize: 11, color: 'var(--ts)', fontFamily: 'var(--mono)' }}>{intent}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {tooltip && <TimelineTooltip post={tooltip.post} x={tooltip.x} y={tooltip.y} />}
    </div>
  )
}

function TimelineTooltip({ post, x, y }) {
  const ic = INTENT_COLORS_LOCAL[post.intent] ?? '#94A3B8'
  const cc = CHANNEL_META[post.channel]?.color ?? '#666'
  return (
    <div style={{ position: 'fixed', left: x + 36, top: Math.max(8, y - 8), zIndex: 300, pointerEvents: 'none', background: 'var(--s1)', border: `1px solid ${ic}66`, borderRadius: 8, padding: '10px 14px', maxWidth: 280, boxShadow: '0 8px 32px #00000099' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: ic, fontFamily: 'var(--mono)' }}>{post.intent}</span>
        <span style={{ fontSize: 11, color: 'var(--tm)' }}>·</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: cc, fontFamily: 'var(--mono)' }}>{CHANNEL_LABELS[post.channel]}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--tm)', fontFamily: 'var(--mono)', marginBottom: 4 }}>{post.hook_type} · {post.date_normalized}</div>
      {(post.hook_text_english || post.hook_text_hebrew) && (
        <div style={{ fontSize: 12, color: 'var(--ts)', lineHeight: 1.5 }}>{(post.hook_text_english || post.hook_text_hebrew).slice(0, 100)}</div>
      )}
      <div style={{ fontSize: 10, color: 'var(--ac)', fontFamily: 'var(--mono)', marginTop: 4 }}>click to inspect →</div>
    </div>
  )
}
