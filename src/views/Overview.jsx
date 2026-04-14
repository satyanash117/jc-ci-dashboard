import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid } from 'recharts'
import { CHANNEL_LABELS, CHANNEL_META } from '../useData.js'
import { getChannelInsight } from '../insights.js'
import { PostListPanel } from '../PostPanel.jsx'
import ParetoChart from '../ParetoChart.jsx'

const SORT_OPTIONS = [
  { id: 'avg_comments', label: 'Avg Comments' },
  { id: 'total_comments', label: 'Total Comments' },
  { id: 'post_count', label: 'Post Count' },
  { id: 'er_vs_bench', label: 'ER vs Benchmark' },
]

const ER_BENCHMARKS = {
  instagram:   { mid: 3.0, source: 'Hootsuite 2024', formula: '(L+C+S)/68.4K followers' },
  fb_personal: { mid: 0.5, source: 'RivalIQ 2024', formula: '(L+C+S)/38K followers' },
  linkedin:    { mid: 2.0, source: 'Hootsuite 2024', formula: '(L+C+S)/31K followers' },
  tiktok:      { mid: 8.0, source: 'Socialinsider 2024', formula: '(L+C+S)/24.1K followers' },
  youtube:     { mid: 1.0, source: 'Hootsuite 2024', formula: '(L+C+S)/7.5K followers' },
  threads:     { mid: 1.5, source: 'estimated', formula: '(L+C+S)/4.1K followers' },
  fb_group:    { mid: 0.1, source: 'estimated (member-based)', formula: '(L+C)/192.8K members — not comparable to follower-based ER' },
}

const POST_SORTS = [
  { id: 'comments', label: 'Comments' },
  { id: 'likes', label: 'Likes' },
  { id: 'er', label: 'ER' },
  { id: 'date', label: 'Date' },
]
const INTENT_FILTERS = [
  { id: 'GIVE-VALUE', label: 'Give Value', color: '#34D399' },
  { id: 'SOFT-SELL', label: 'Soft Sell', color: '#FB923C' },
  { id: 'HARD-SELL', label: 'Hard Sell', color: '#F43F5E' },
  { id: 'SOCIAL-PROOF', label: 'Social Proof', color: '#60A5FA' },
  { id: 'WARM-UP', label: 'Warm-Up', color: '#A78BFA' },
]
const ACTIVE_CHANNELS = ['fb_personal', 'linkedin', 'instagram', 'tiktok', 'youtube', 'fb_group', 'whatsapp', 'email']

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (<div style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 12px', fontFamily: 'var(--mono)', fontSize: 12 }}>
    <div style={{ color: 'var(--ts)', marginBottom: 4 }}>{label}</div>
    {payload.map(p => (<div key={p.dataKey} style={{ color: p.color, marginBottom: 1 }}>{p.name}: {typeof p.value === 'number' ? Math.round(p.value) : p.value}</div>))}
  </div>)
}

export default function ViewOverview({ posts, allPosts, competitor, onNavigate }) {
  const [postPanel, setPostPanel] = useState(null)
  const [channelSort, setChannelSort] = useState('avg_comments')
  const [intentFilter, setIntentFilter] = useState(new Set())
  const [postSort, setPostSort] = useState('comments')

  const filteredByIntent = useMemo(() => {
    if (intentFilter.size === 0) return posts
    return posts.filter(p => intentFilter.has(p.intent))
  }, [posts, intentFilter])

  function toggleIntentFilter(id) {
    setIntentFilter(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  const channelItems = useMemo(() => {
    const byChannel = {}
    for (const p of filteredByIntent) {
      if (!byChannel[p.channel]) byChannel[p.channel] = { posts: [], commentsSum: 0, erSum: 0, erCount: 0 }
      byChannel[p.channel].posts.push(p)
      byChannel[p.channel].commentsSum += p.comments_n
      if (p.er_computed != null) { byChannel[p.channel].erSum += p.er_computed; byChannel[p.channel].erCount++ }
    }
    return Object.entries(byChannel).map(([ch, d]) => {
      const avg = d.posts.length ? Math.round(d.commentsSum / d.posts.length) : 0
      const avgER = d.erCount ? +(d.erSum / d.erCount).toFixed(2) : 0
      const insight = getChannelInsight(ch, filteredByIntent)
      let sortVal = avg
      if (channelSort === 'total_comments') sortVal = d.commentsSum
      else if (channelSort === 'post_count') sortVal = d.posts.length
      else if (channelSort === 'er_vs_bench') {
        const bench = ER_BENCHMARKS[ch]
        sortVal = bench && avgER > 0 ? Math.round(avgER / bench.mid * 100) / 100 : 0
      }
      const erNote = d.erCount >= 3 ? ` · ER ${avgER}%` : ''
      const bench = ER_BENCHMARKS[ch]
      const erScore = bench && avgER > 0 ? Math.round(avgER / bench.mid * 100) / 100 : null
      const erScoreLabel = erScore ? ` · ${erScore}× benchmark` : ''
      return {
        label: CHANNEL_LABELS[ch] || ch, value: sortVal,
        count: d.posts.length, color: CHANNEL_META[ch]?.color || '#666',
        posts: d.posts, sublabel: `${d.posts.length} posts · ${avg} avg${channelSort === 'er_vs_bench' ? erScoreLabel : erNote}`,
        insight: insight ? { stat: insight.stat, why: insight.why, action: insight.action } : null,
        _avg: avg, _total: d.commentsSum, _er: avgER, _erScore: erScore,
      }
    }).sort((a, b) => b.value - a.value)
  }, [filteredByIntent, channelSort])

  const statusLine = useMemo(() => {
    if (!posts.length) return null
    const dated = posts.filter(p => p.date_obj)
    const days = dated.length >= 2 ? Math.round((Math.max(...dated.map(p => +p.date_obj)) - Math.min(...dated.map(p => +p.date_obj))) / 86400000) || 1 : 30
    const ppw = Math.round(posts.length / (days / 7) * 10) / 10
    const allDated = (allPosts || []).filter(p => p.date_obj)
    const latestMs = allDated.length ? Math.max(...allDated.map(p => +p.date_obj)) : null
    const stale = latestMs ? Math.round((Date.now() - latestMs) / 86400000) : null
    const act = ppw >= 5 ? 'high volume' : ppw >= 2 ? 'active' : ppw >= 0.5 ? 'moderate' : 'quiet'
    return { total: posts.length, days, ppw, act, stale, latestDate: latestMs ? new Date(latestMs).toISOString().slice(0, 10) : null }
  }, [posts, allPosts])

  const { dowData, todData } = useMemo(() => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dc = {}; const tc = { MORNING: 0, AFTERNOON: 0, EVENING: 0, NIGHT: 0 }
    for (const p of posts) {
      if (p.day_of_week) dc[p.day_of_week] = (dc[p.day_of_week] || 0) + 1
      let tod = (p.time_of_day || '').toUpperCase().replace(/\s*\(.*\)/, '').trim()
      if (tod === 'NOON') tod = 'AFTERNOON'
      if (tc[tod] !== undefined) tc[tod]++
    }
    const dowData = dayNames.map(d => ({ day: d.slice(0, 3), count: dc[d] || 0, weekend: d === 'Friday' || d === 'Saturday' }))
    const todLabels = { MORNING: 'Morning (06–12)', AFTERNOON: 'Afternoon (12–17)', EVENING: 'Evening (17–21)', NIGHT: 'Night (21–06)' }
    const todData = Object.entries(tc).map(([k, v]) => ({ slot: todLabels[k] || k, count: v }))
    return { dowData, todData }
  }, [posts])

  const [showAllMonths, setShowAllMonths] = useState(false)

  const monthlyData = useMemo(() => {
    const map = {}
    for (const p of posts) {
      if (!p.date_obj) continue
      const m = p.date_obj.toISOString().slice(0, 7)
      if (!map[m]) map[m] = { month: m.slice(2) }
      map[m][p.channel] = (map[m][p.channel] || 0) + 1
      map[m]._total = (map[m]._total || 0) + 1
    }
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month))
  }, [posts])

  const intentSplit = useMemo(() => {
    const map = {}
    for (const p of posts) { const i = p.intent; if (i && i !== 'False') map[i] = (map[i] || 0) + 1 }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ intent: k, count: v, pct: Math.round(v / posts.length * 100) }))
  }, [posts])

  const velocity = useMemo(() => {
    const months = [...new Set(posts.filter(p => p.date_obj).map(p => p.date_obj.toISOString().slice(0, 7)))].sort()
    const recent = months.slice(-3), prior = months.slice(-6, -3)
    return ACTIVE_CHANNELS.map(ch => {
      const r = posts.filter(p => p.date_obj && recent.includes(p.date_obj.toISOString().slice(0, 7)) && p.channel === ch).length
      const pr = posts.filter(p => p.date_obj && prior.includes(p.date_obj.toISOString().slice(0, 7)) && p.channel === ch).length
      const avgR = recent.length ? r / recent.length : 0, avgP = prior.length ? pr / prior.length : 0
      const delta = avgP > 0 ? Math.round((avgR - avgP) / avgP * 100) : avgR > 0 ? 100 : 0
      return { ch, label: CHANNEL_LABELS[ch], avgR: Math.round(avgR * 10) / 10, avgP: Math.round(avgP * 10) / 10, delta, color: CHANNEL_META[ch]?.color }
    }).filter(v => v.avgR > 0 || v.avgP > 0).sort((a, b) => b.avgR - a.avgR)
  }, [posts])

  const topPosts = useMemo(() => {
    const sorted = [...filteredByIntent].filter(p => p.comments_n > 0)
    if (postSort === 'comments') sorted.sort((a, b) => b.comments_n - a.comments_n)
    else if (postSort === 'likes') sorted.sort((a, b) => b.likes_n - a.likes_n)
    else if (postSort === 'er') sorted.sort((a, b) => (b.er_computed ?? 0) - (a.er_computed ?? 0))
    else if (postSort === 'date') sorted.sort((a, b) => (b.date_obj ?? 0) - (a.date_obj ?? 0))
    return sorted.slice(0, 8)
  }, [filteredByIntent, postSort])

  if (!statusLine) return <div style={{ color: 'var(--tm)', padding: 24, fontFamily: 'var(--mono)' }}>No posts in current filter.</div>

  const valLabel = channelSort === 'avg_comments' ? 'avg cmts' : channelSort === 'total_comments' ? 'total cmts' : channelSort === 'post_count' ? 'posts' : '× benchmark'

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {statusLine.stale > 3 && (
        <div style={{ padding: '8px 16px', background: '#78350f22', border: '1px solid #92400e44', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#FCD34D', fontFamily: 'var(--mono)' }}>⚠ DATA IS {statusLine.stale}d STALE</span>
          <span style={{ fontSize: 12, color: 'var(--wn)', fontFamily: 'var(--mono)' }}>— last post: {statusLine.latestDate}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--tm)', fontFamily: 'var(--mono)', marginBottom: 8 }}>
            CHANNELS RANKED
            <span style={{ fontWeight: 400, fontSize: 12, marginLeft: 12, color: 'var(--tm)' }}>click bar → see posts · click ? → insight</span>
          </div>
          <ParetoChart
            items={channelItems} valueLabel={valLabel} minPosts={3} maxBars={9}
            onBarClick={item => setPostPanel({ title: `${item.label} — ${item.count} posts`, subtitle: `Avg ${item._avg} comments`, posts: item.posts, color: item.color })}
            sortOptions={SORT_OPTIONS} activeSort={channelSort} onSortChange={setChannelSort}
            filterOptions={INTENT_FILTERS} activeFilters={intentFilter} onFilterToggle={toggleIntentFilter}
            descriptions={channelSort === 'er_vs_bench' ? Object.fromEntries(
              Object.entries(ER_BENCHMARKS).map(([ch, b]) => [
                CHANNEL_LABELS[ch] || ch,
                `ER formula: ${b.formula}. Industry benchmark midpoint: ${b.mid}% (${b.source}). Score = avg ER ÷ ${b.mid}%. A score of 1.0 = average, 2.0 = 2× benchmark.`
              ])
            ) : undefined}
          />
          {channelSort === 'er_vs_bench' && (
            <div style={{ marginTop: 8, padding: '10px 14px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 8, fontSize: 12, color: 'var(--tm)', lineHeight: 1.6 }}>
              <span style={{ fontWeight: 700, color: 'var(--ac)' }}>ⓘ How ER vs Benchmark works:</span> Raw ER% is not comparable across channels. This score normalizes each channel's ER against its industry benchmark midpoint. 1.0× = average performance for that channel.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--tm)', fontFamily: 'var(--mono)', marginBottom: 8 }}>POSTING BY DAY</div>
            <div style={{ fontSize: 10, color: '#FBBF24', fontFamily: 'var(--mono)', marginBottom: 8, padding: '3px 6px', background: '#FBBF2411', borderRadius: 4, border: '1px solid #FBBF2422' }}>Israeli workweek: Sun–Thu = work · Fri–Sat = Shabbat</div>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={dowData} margin={{ left: 0, right: 0 }}>
                <XAxis dataKey="day" tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'var(--mono)' }} />
                <YAxis hide />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {dowData.map((e, i) => (<Cell key={i} fill={e.weekend ? 'var(--tm)' : '#38BDF8'} fillOpacity={e.weekend ? 0.35 : 0.7} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--tm)', fontFamily: 'var(--mono)', marginBottom: 8 }}>TIME OF DAY</div>
            {todData.map(({ slot, count }) => {
              const max = Math.max(...todData.map(t => t.count), 1)
              return (
                <div key={slot} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 80, fontSize: 12, color: 'var(--ts)', fontFamily: 'var(--mono)' }}>{slot}</div>
                  <div style={{ flex: 1, height: 6, background: 'var(--s3)', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: (count / max * 100) + '%', background: '#38BDF8', borderRadius: 3, opacity: 0.7 }} />
                  </div>
                  <div style={{ width: 28, textAlign: 'right', fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--ts)' }}>{count}</div>
                </div>
              )
            })}
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--tm)', fontFamily: 'var(--mono)', marginBottom: 8 }}>CHANNEL VELOCITY</div>
            <div style={{ fontSize: 10, color: 'var(--tm)', fontFamily: 'var(--mono)', marginBottom: 8 }}>Recent 3mo avg vs prior 3mo avg</div>
            {velocity.map(v => (
              <div key={v.ch} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <div style={{ width: 4, height: 14, background: v.color, borderRadius: 2 }} />
                <div style={{ width: 80, fontSize: 12, fontFamily: 'var(--mono)', color: v.color, fontWeight: 700 }}>{v.label}</div>
                <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--tm)', width: 55 }}>{v.avgR}/mo</div>
                <div style={{ fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 700, color: v.delta > 20 ? '#34D399' : v.delta < -20 ? '#F43F5E' : 'var(--tm)' }}>
                  {v.delta > 0 ? '+' : ''}{v.delta}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {monthlyData.length > 1 && (() => {
        const displayData = showAllMonths ? monthlyData : monthlyData.slice(-12)
        return (
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--tm)', fontFamily: 'var(--mono)' }}>
                MONTHLY POST VOLUME {!showAllMonths && monthlyData.length > 12 ? '(last 12 months)' : '(all time)'}
              </div>
              {monthlyData.length > 12 && (
                <button onClick={() => setShowAllMonths(s => !s)}
                  style={{ fontSize: 11, color: 'var(--ac)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', textDecoration: 'underline' }}>
                  {showAllMonths ? 'show last 12 months' : `show all ${monthlyData.length} months`}
                </button>
              )}
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={displayData} margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'var(--tm)', fontSize: 11, fontFamily: 'var(--mono)' }} />
                <YAxis tick={{ fill: 'var(--tm)', fontSize: 11, fontFamily: 'var(--mono)' }} />
                <Tooltip content={<ChartTooltip />} />
                {ACTIVE_CHANNELS.filter(ch => displayData.some(m => m[ch])).map(ch => (
                  <Line key={ch} type="monotone" dataKey={ch} stroke={CHANNEL_META[ch]?.color ?? '#666'} strokeWidth={2} dot={{ r: 2 }} connectNulls name={CHANNEL_LABELS[ch]} />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              {ACTIVE_CHANNELS.filter(ch => displayData.some(m => m[ch])).map(ch => (
                <div key={ch} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 14, height: 2, background: CHANNEL_META[ch]?.color ?? '#666', borderRadius: 1 }} />
                  <span style={{ fontSize: 11, color: CHANNEL_META[ch]?.color ?? '#666', fontFamily: 'var(--mono)' }}>{CHANNEL_LABELS[ch]}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--tm)', fontFamily: 'var(--mono)' }}>TOP POSTS</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {POST_SORTS.map(s => (
              <button key={s.id} onClick={() => setPostSort(s.id)}
                style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: postSort === s.id ? 700 : 500, fontFamily: 'var(--mono)',
                  background: postSort === s.id ? 'var(--ac2)' : 'var(--s3)', color: postSort === s.id ? '#fff' : 'var(--tm)',
                  border: `1px solid ${postSort === s.id ? 'var(--ac2)' : 'var(--bd)'}`, transition: 'all 0.12s' }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {topPosts.map((p, i) => {
            const color = CHANNEL_META[p.channel]?.color ?? '#666'
            const mainVal = postSort === 'likes' ? p.likes_n : postSort === 'er' ? (p.er_computed != null ? p.er_computed.toFixed(1) + '%' : '—') : postSort === 'date' ? p.date_normalized : p.comments_n
            const mainLabel = postSort === 'likes' ? 'likes' : postSort === 'er' ? 'ER' : postSort === 'date' ? '' : 'cmts'
            return (
              <button key={p.id || i} onClick={() => setPostPanel({ title: 'Post detail', posts: [p], color })}
                style={{ padding: '10px 14px', background: 'var(--s2)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center', border: '1px solid var(--bd)', textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = color}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--bd)'}>
                <div style={{ width: 22, textAlign: 'center', fontSize: 14, fontWeight: 800, fontFamily: 'var(--mono)', color: i === 0 ? color : 'var(--tm)' }}>#{i + 1}</div>
                <div style={{ width: 3, alignSelf: 'stretch', background: color, borderRadius: 2, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--ts)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{p.hook_text_english || p.hook_text_hebrew || '(no hook)'}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ fontSize: 11, color, fontFamily: 'var(--mono)', fontWeight: 700 }}>{CHANNEL_LABELS[p.channel]}</span>
                    <span style={{ fontSize: 11, color: 'var(--tm)', fontFamily: 'var(--mono)' }}>{p.date_normalized}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--tp)' }}>{typeof mainVal === 'number' && mainVal >= 1000 ? (mainVal / 1000).toFixed(1) + 'K' : mainVal}</div>
                  {mainLabel && <div style={{ fontSize: 10, color: 'var(--tm)', fontFamily: 'var(--mono)' }}>{mainLabel}</div>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {postPanel && <PostListPanel title={postPanel.title} subtitle={postPanel.subtitle} posts={postPanel.posts} accentColor={postPanel.color ?? '#38BDF8'} onClose={() => setPostPanel(null)} />}
    </div>
  )
}
