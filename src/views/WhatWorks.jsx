import { useState, useMemo } from 'react'
import { CHANNEL_LABELS, CHANNEL_META, HOOK_COLORS, CTA_COLORS, INTENT_COLORS } from '../useData.js'
import { getHookInsight, getCTAInsight } from '../insights.js'
import { PostListPanel } from '../PostPanel.jsx'
import ParetoChart from '../ParetoChart.jsx'

const DIMENSIONS = [
  { id: 'hook', label: 'Hook Type', field: 'hook_type', colors: HOOK_COLORS },
  { id: 'cta', label: 'CTA Method', field: 'cta_method', colors: CTA_COLORS },
  { id: 'intent', label: 'Intent', field: 'intent', colors: INTENT_COLORS },
  { id: 'dest', label: 'Destination', field: 'dest_ultimate', colors: {} },
]

const SORT_OPTIONS = [
  { id: 'avg_comments', label: 'Avg Comments' },
  { id: 'total_comments', label: 'Total Comments' },
  { id: 'post_count', label: 'Post Count' },
  { id: 'median_comments', label: 'Median Comments' },
]

const HOOK_DESCRIPTIONS = {
  'CURIOSITY-GAP': 'Withholds key information to make not clicking feel like a loss.',
  'NEWS-BREAK': 'Reacts to breaking AI industry news — new model releases, capability announcements, policy changes.',
  'PERSONAL-STORY': "Opens with a personal experience, milestone, or emotional journey — builds warmth and relatability.",
  'SHOCK': 'Opens with a startling claim or pattern-interrupt that creates emotional urgency.',
  'QUESTION': 'Opens with a direct question, poll, or discussion prompt to provoke thinking or engagement.',
  'FOMO': 'Creates fear of missing out — urgency, scarcity, limited time offers, or countdowns.',
  'NUMBER-LISTICLE': 'Opens with a specific number promise ("5 tools...", "3 mistakes...").',
  'AUTHORITY': 'Opens with a credibility claim, press mention, or expert positioning.',
  'CONTRARIAN': 'Takes a provocative stance against conventional wisdom ("Stop using ChatGPT for this").',
  'SOCIAL-PROOF': 'Leads with evidence of others\' success, scale, transformation, or results.',
  'HOW-TO': 'Opens with a practical tutorial promise, step-by-step, or hack reveal.',
  'HUMOR': 'Opens with humor, games, or entertainment — pattern-interrupt through laughter.',
  'NOVELTY': 'Highlights something genuinely new, first-of-its-kind, or game-changing.',
  'VALUE-OFFER': 'Leads with a free offer, reward, giveaway, or value drop to drive engagement.',
  'CHALLENGE': 'Invites participation in a challenge, contest, or user-generated content.',
  'CULTURAL-MOMENT': 'Ties into a cultural event, national moment, political situation, or seasonal context.',
  'PAIN-POINT': 'Opens by identifying a specific audience problem, frustration, or blocker.',
  'CTA-HOOK': 'The hook IS the CTA — comment-to-receive, follow-up on a promise, or callback to previous post.',
}

const CTA_DESCRIPTIONS = {
  'COMMENT-KEYWORD': 'Asks audience to comment a specific word → triggers automated DM with a link or resource. Highest-leverage mechanic.',
  'LINK-IN-COMMENT': 'Link placed in first comment instead of caption. Facebook shows posts with outbound links in the caption to fewer people.',
  'COMMENT-TO-RECEIVE': 'Asks audience to comment any response → replies manually with a link. Higher engagement than LINK-IN-COMMENT.',
  'LINK-IN-POST': 'Direct link in the post body or caption. Simple but algorithmically penalised on Facebook.',
  'NONE': 'No call-to-action — pure value, awareness, or community building post.',
  'ENGAGEMENT-QUESTION': 'Asks a question or runs a poll to drive comments without offering a link or resource.',
  'BIO-LINK': 'Directs audience to the bio/profile link for more info.',
  'WHATSAPP-JOIN': 'Directs audience to join a WhatsApp group — free community or paid membership.',
}

const INTENT_DESCRIPTIONS = {
  'GIVE-VALUE': 'Free education, tutorials, tool demos. Builds trust and audience. No sell attached.',
  'SOFT-SELL': 'Mentions a product/offer indirectly — through value-first framing, social proof, or subtle CTA.',
  'HARD-SELL': 'Direct price/offer with explicit purchase CTA. Use rarely and only at campaign close.',
  'WARM-UP': 'Pre-campaign content that primes the audience for an upcoming offer without revealing it.',
  'SOCIAL-PROOF': 'Showcases results, testimonials, or scale numbers to build credibility.',
  'URGENCY': 'Time-limited or scarcity-driven content ("Last chance", "Closing tonight").',
  'COMMUNITY-BUILDING': 'Content designed to foster discussion and belonging, not drive conversions.',
  'AUTHORITY': 'Positions the creator as an expert through credentials, conference appearances, or industry commentary.',
}

const DEST_COLORS = {
  'Brainers Club / AI Life': '#FBBF24', 'WA Free → Brainers Club': '#25D366', 'Challenge → Paid Product': '#F43F5E',
  'Course Purchase': '#F97316', 'Cross-Platform Follow': '#60A5FA', 'WhatsApp Community': '#22D3EE',
  'Awareness Only': '#94A3B8', 'No Destination': '#374151', 'Event Attendance': '#A78BFA',
  'Authority Building': '#818CF8', 'Other': '#64748B',
}
const DEST_DESCRIPTIONS = {
  'Brainers Club / AI Life': 'Primary paid membership product. AI Life was the earlier name, rebranded to Brainers Club.',
  'WA Free → Brainers Club': 'Two-step funnel: audience joins a free WhatsApp group first, then is offered membership.',
  'Challenge → Paid Product': 'Free challenge or workshop that leads to a paid course or membership purchase at the end.',
  'Course Purchase': 'Drives to a paid course — sold to existing community members.',
  'Cross-Platform Follow': 'Drives audience to follow on another platform (cross-pollination between channels).',
  'WhatsApp Community': 'Drives to a WhatsApp group for community-building, not directly monetized.',
  'Awareness Only': 'No conversion destination — pure brand building or community engagement.',
  'No Destination': 'Post has no identifiable funnel destination in the data.',
}

const EXCLUDED = new Set(['', 'NONE', 'False', 'UNKNOWN', 'N/A', 'undefined', 'null', 'STANDALONE'])
const ALL_CHANNELS_LIST = Object.entries(CHANNEL_LABELS).map(([id, label]) => ({ id, label, color: CHANNEL_META[id]?.color }))

export default function ViewWhatWorks({ posts, competitor, onNavigate, initialDimension }) {
  const [activeDim, setActiveDim] = useState(initialDimension ?? 'hook')
  const [postPanel, setPostPanel] = useState(null)
  const [sortBy, setSortBy] = useState('avg_comments')
  const [channelFilter, setChannelFilter] = useState(new Set())

  function toggleChannelFilter(id) {
    setChannelFilter(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  const dim = DIMENSIONS.find(d => d.id === activeDim) || DIMENSIONS[0]

  const filteredPosts = useMemo(() => {
    if (channelFilter.size === 0) return posts
    return posts.filter(p => channelFilter.has(p.channel))
  }, [posts, channelFilter])

  const descriptions = dim.id === 'hook' ? HOOK_DESCRIPTIONS : dim.id === 'cta' ? CTA_DESCRIPTIONS : dim.id === 'intent' ? INTENT_DESCRIPTIONS : DEST_DESCRIPTIONS

  const paretoItems = useMemo(() => {
    if (!filteredPosts.length) return []
    const groups = {}
    for (const p of filteredPosts) {
      let val = p[dim.field]
      if (dim.id === 'dest' && (!val || val === 'NONE' || val === 'False')) val = 'No Destination'
      if (!val || EXCLUDED.has(val)) continue
      if (!groups[val]) groups[val] = { posts: [], comments: [] }
      groups[val].posts.push(p)
      groups[val].comments.push(p.comments_n)
    }
    return Object.entries(groups).map(([key, data]) => {
      const avg = Math.round(data.comments.reduce((s, v) => s + v, 0) / data.posts.length)
      const total = data.comments.reduce((s, v) => s + v, 0)
      const sorted = [...data.comments].sort((a, b) => a - b)
      const median = sorted.length % 2 === 0 ? Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : sorted[Math.floor(sorted.length / 2)]
      let color = dim.colors[key] || DEST_COLORS[key] || 'var(--ac)'
      let insight = null
      if (dim.id === 'hook') insight = getHookInsight(key, filteredPosts)
      else if (dim.id === 'cta') insight = getCTAInsight(key, filteredPosts)
      let sortVal = avg
      if (sortBy === 'total_comments') sortVal = total
      else if (sortBy === 'post_count') sortVal = data.posts.length
      else if (sortBy === 'median_comments') sortVal = median
      return {
        label: key, value: sortVal, count: data.posts.length, color, posts: data.posts,
        insight: insight ? { stat: insight.stat, why: insight.why, action: insight.action } : null,
        _avg: avg, _total: total, _median: median,
      }
    }).sort((a, b) => b.value - a.value)
  }, [filteredPosts, dim, sortBy])

  const valLabel = sortBy === 'avg_comments' ? 'avg cmts' : sortBy === 'total_comments' ? 'total cmts' : sortBy === 'post_count' ? 'posts' : 'median cmts'

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {DIMENSIONS.map(d => {
          const a = activeDim === d.id
          return (<button key={d.id} onClick={() => { setActiveDim(d.id); setSortBy('avg_comments') }}
            style={{ padding: '9px 18px', borderRadius: 8, fontSize: 15, fontWeight: a ? 700 : 500, fontFamily: 'var(--mono)',
              background: a ? 'var(--ac2)' : 'var(--s2)', color: a ? '#fff' : 'var(--ts)',
              border: `1px solid ${a ? 'var(--ac2)' : 'var(--bd)'}`, transition: 'all 0.15s', letterSpacing: '0.04em' }}>{d.label}</button>)
        })}
      </div>

      <div style={{ fontSize: 14, color: 'var(--tm)' }}>
        {dim.id === 'hook' && 'Which opening hooks drive the most engagement? Hover any label for a description.'}
        {dim.id === 'cta' && 'Which call-to-action methods drive the most comments? Hover any label to understand the mechanic.'}
        {dim.id === 'intent' && 'What is the purpose of each post? Hover any label for what it means.'}
        {dim.id === 'dest' && 'Where is this competitor sending their audience? Hover any label for the funnel context.'}
      </div>

      <ParetoChart
        items={paretoItems} valueLabel={valLabel} minPosts={3} maxBars={14}
        onBarClick={item => setPostPanel({ title: `${item.label} — ${item.count} posts`, subtitle: `Avg ${item._avg} · Median ${item._median} · Total ${item._total}`, posts: item.posts, color: item.color })}
        sortOptions={SORT_OPTIONS} activeSort={sortBy} onSortChange={setSortBy}
        filterOptions={ALL_CHANNELS_LIST} activeFilters={channelFilter} onFilterToggle={toggleChannelFilter}
        descriptions={descriptions}
      />

      {paretoItems.length >= 2 && paretoItems[0].count >= 3 && (
        <div style={{ padding: '14px 18px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 8, fontSize: 14, color: 'var(--ts)', lineHeight: 1.6 }}>
          <span style={{ fontWeight: 700, color: paretoItems[0].color }}>{paretoItems[0].label}</span> leads with{' '}
          <span style={{ fontWeight: 700, color: 'var(--tp)', fontFamily: 'var(--mono)' }}>{Math.round(paretoItems[0]._avg)}</span> avg comments ({paretoItems[0].count} posts).
          {paretoItems[1]?.count >= 3 && <> Runner-up: <span style={{ fontWeight: 700, color: paretoItems[1].color }}>{paretoItems[1].label}</span> at {Math.round(paretoItems[1]._avg)} avg.</>}
          {channelFilter.size > 0 && <span style={{ color: 'var(--wn)', marginLeft: 8, fontFamily: 'var(--mono)', fontSize: 12 }}>Filtered by {channelFilter.size} channel{channelFilter.size > 1 ? 's' : ''}</span>}
        </div>
      )}

      {postPanel && <PostListPanel title={postPanel.title} subtitle={postPanel.subtitle} posts={postPanel.posts} accentColor={postPanel.color ?? '#38BDF8'} onClose={() => setPostPanel(null)} />}
    </div>
  )
}
