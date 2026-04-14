import { useMemo, useState } from 'react'
import Portal from '../Portal.jsx'
import ParetoChart from '../ParetoChart.jsx'

const SUBGROUP_LABELS = {
  'brainers_club_community_posts': 'Main Community',
  'brainers_club_vibe_coding_i_agents': 'Vibe Coding & Agents',
  'brainers_club_business_owners': 'Business Owners',
  'brainers_club_ai_for_fun': 'AI for Fun',
  'brainers_club_content_creation': 'Content Creation',
  'brainers_club_students': 'Students',
  'fb_group_community': 'FB Group',
}
const SUBGROUP_COLORS = {
  'brainers_club_community_posts': '#38BDF8',
  'brainers_club_vibe_coding_i_agents': '#A78BFA',
  'brainers_club_business_owners': '#F97316',
  'brainers_club_ai_for_fun': '#34D399',
  'brainers_club_content_creation': '#F472B6',
  'brainers_club_students': '#FBBF24',
  'fb_group_community': '#60A5FA',
}

const TOOL_SORT_OPTIONS = [
  { id: 'mentions', label: 'Mentions' },
  { id: 'subgroups', label: 'Subgroup Spread' },
]
const SUBGROUP_SORT_OPTIONS = [
  { id: 'total', label: 'Total Posts' },
  { id: 'questions', label: 'Questions' },
  { id: 'tools', label: 'Tools Mentioned' },
]
const POST_TYPE_FILTERS = [
  { id: 'QUESTION', label: 'Questions', color: '#60A5FA' },
  { id: 'DISCUSSION', label: 'Discussion', color: '#34D399' },
  { id: 'SHARE', label: 'Shares/Wins', color: '#FBBF24' },
]

export default function ViewCommunity({ data, competitor, onNavigate }) {
  const { communityPosts, curriculum } = data
  const [selectedPost, setSelectedPost] = useState(null)
  const [toolPosts, setToolPosts] = useState(null)
  const [toolSort, setToolSort] = useState('mentions')
  const [sgSort, setSgSort] = useState('total')
  const [sgFilter, setSgFilter] = useState(null)
  const [postTypeFilter, setPostTypeFilter] = useState(new Set())
  const [showAllPosts, setShowAllPosts] = useState(false)

  function togglePostType(id) { setPostTypeFilter(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n }) }

  const toolItems = useMemo(() => {
    const toolData = {}
    for (const p of communityPosts) {
      if (sgFilter && p.collection !== sgFilter) continue
      for (const t of (p.tools_list ?? [])) {
        if (!t || ['NONE', 'N/A', 'AI (general)', ''].includes(t)) continue
        if (!toolData[t]) toolData[t] = { mentions: 0, subgroups: new Set(), posts: [] }
        toolData[t].mentions++
        toolData[t].subgroups.add(p.collection)
        toolData[t].posts.push(p)
      }
    }
    const currTools = new Set()
    for (const l of curriculum) {
      for (const t of (l.tools_list ?? [])) { if (t) currTools.add(t.toLowerCase()) }
    }
    return Object.entries(toolData).map(([tool, d]) => {
      const inCurriculum = currTools.has(tool.toLowerCase())
      const sortVal = toolSort === 'subgroups' ? d.subgroups.size : d.mentions
      return {
        label: tool, value: sortVal, count: d.mentions, color: inCurriculum ? '#34D399' : '#F43F5E',
        posts: d.posts,
        sublabel: `${d.subgroups.size} groups${inCurriculum ? ' · in curriculum' : ' · NOT in curriculum'}`,
        insight: !inCurriculum && d.mentions >= 5 ? {
          stat: `${tool} is mentioned ${d.mentions} times across ${d.subgroups.size} sub-groups but is NOT in the curriculum.`,
          why: 'This represents an unmet demand. The community wants to learn this tool but has no official course material.',
          action: `Build a ${tool} tutorial module. First-mover advantage on a documented demand gap.`,
        } : null,
      }
    }).sort((a, b) => b.value - a.value)
  }, [communityPosts, curriculum, toolSort, sgFilter])

  const subgroupItems = useMemo(() => {
    const stats = {}
    for (const p of communityPosts) {
      const sg = p.collection || 'unknown'
      if (!stats[sg]) stats[sg] = { total: 0, questions: 0, toolMentions: 0, posts: [] }
      stats[sg].total++; stats[sg].posts.push(p)
      if (p.post_type === 'QUESTION') stats[sg].questions++
      stats[sg].toolMentions += (p.tools_list ?? []).length
    }
    return Object.entries(stats)
      .filter(([sg]) => SUBGROUP_LABELS[sg])
      .map(([sg, d]) => {
        let sortVal = d.total
        if (sgSort === 'questions') sortVal = d.questions
        else if (sgSort === 'tools') sortVal = d.toolMentions
        return {
          label: SUBGROUP_LABELS[sg] || sg, value: sortVal, count: d.total,
          color: SUBGROUP_COLORS[sg] || 'var(--ac)', posts: d.posts,
          sublabel: `${d.questions} questions · ${d.toolMentions} tool mentions`,
          _sg: sg,
        }
      }).sort((a, b) => b.value - a.value)
  }, [communityPosts, sgSort])

  const moduleBreakdown = useMemo(() => {
    const counts = {}
    for (const l of curriculum) { const m = l.module || 'Unknown'; counts[m] = (counts[m] || 0) + 1 }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [curriculum])

  const browsePosts = useMemo(() => {
    let list = communityPosts
    if (sgFilter) list = list.filter(p => p.collection === sgFilter)
    if (postTypeFilter.size > 0) list = list.filter(p => postTypeFilter.has(p.post_type))
    return list.slice(0, showAllPosts ? 200 : 20)
  }, [communityPosts, sgFilter, postTypeFilter, showAllPosts])

  const totalFiltered = useMemo(() => {
    let list = communityPosts
    if (sgFilter) list = list.filter(p => p.collection === sgFilter)
    if (postTypeFilter.size > 0) list = list.filter(p => postTypeFilter.has(p.post_type))
    return list.length
  }, [communityPosts, sgFilter, postTypeFilter])

  const sgValLabel = sgSort === 'questions' ? 'questions' : sgSort === 'tools' ? 'tool mentions' : 'total posts'
  const toolValLabel = toolSort === 'subgroups' ? 'subgroups' : 'mentions'

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Summary bar */}
      <div style={{ padding: '14px 20px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 10, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <Stat label="Community Posts" value={communityPosts.length} />
        <Stat label="Questions" value={communityPosts.filter(p => p.post_type === 'QUESTION').length} />
        <Stat label="Curriculum Lessons" value={curriculum.length} />
        <Stat label="Sub-groups" value={Object.keys(SUBGROUP_LABELS).length} />
        {sgFilter && (
          <button onClick={() => setSgFilter(null)} style={{ padding: '4px 10px', borderRadius: 5, fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 700, background: '#F43F5E22', color: '#F43F5E', border: '1px solid #F43F5E33', cursor: 'pointer' }}>
            ✕ Clear filter: {SUBGROUP_LABELS[sgFilter]}
          </button>
        )}
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--tm)', fontFamily: 'var(--mono)', marginBottom: 4 }}>TOOL DEMAND</div>
          <div style={{ fontSize: 12, color: 'var(--tm)', marginBottom: 10 }}>
            What tools are community members asking about? <span style={{ color: '#34D399' }}>Green = in curriculum</span> · <span style={{ color: '#F43F5E' }}>Red = NOT in curriculum (gap)</span>
          </div>
          <ParetoChart items={toolItems} valueLabel={toolValLabel} minPosts={2} maxBars={12}
            onBarClick={item => item.posts?.length > 0 && setToolPosts(item)}
            sortOptions={TOOL_SORT_OPTIONS} activeSort={toolSort} onSortChange={setToolSort}
          />
        </div>

        <div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--tm)', fontFamily: 'var(--mono)', marginBottom: 4 }}>SUB-GROUP ACTIVITY</div>
          <div style={{ fontSize: 12, color: 'var(--tm)', marginBottom: 10 }}>Click any bar to filter all community data by that sub-group.</div>
          <ParetoChart items={subgroupItems} valueLabel={sgValLabel} minPosts={1} maxBars={8}
            onBarClick={item => setSgFilter(item._sg)}
            sortOptions={SUBGROUP_SORT_OPTIONS} activeSort={sgSort} onSortChange={setSgSort}
          />
        </div>
      </div>

      {/* Curriculum coverage */}
      {curriculum.length > 0 && (
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--tm)', fontFamily: 'var(--mono)', marginBottom: 10 }}>
            CURRICULUM MODULES ({curriculum.length} lessons)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {moduleBreakdown.map(([mod, count]) => {
              const max = moduleBreakdown[0]?.[1] || 1
              return (
                <div key={mod} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 140, fontSize: 13, color: 'var(--ts)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mod}</div>
                  <div style={{ flex: 1, height: 6, background: 'var(--s3)', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: (count / max * 100) + '%', background: 'var(--ac)', borderRadius: 3, opacity: 0.6 }} />
                  </div>
                  <div style={{ width: 24, textAlign: 'right', fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--ts)' }}>{count}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Community posts browser */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--tm)', fontFamily: 'var(--mono)' }}>
            COMMUNITY POSTS ({totalFiltered.toLocaleString()})
          </span>
          <div style={{ display: 'flex', gap: 3 }}>
            {POST_TYPE_FILTERS.map(f => {
              const a = postTypeFilter.has(f.id)
              return (
                <button key={f.id} onClick={() => togglePostType(f.id)}
                  style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: a ? 700 : 500, fontFamily: 'var(--mono)',
                    background: a ? f.color + '22' : 'var(--s3)', color: a ? f.color : 'var(--tm)',
                    border: `1px solid ${a ? f.color + '55' : 'var(--bd)'}` }}>{f.label}</button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {Object.entries(SUBGROUP_LABELS).map(([sg, label]) => (
              <button key={sg} onClick={() => setSgFilter(sgFilter === sg ? null : sg)}
                style={{ padding: '3px 6px', borderRadius: 4, fontSize: 10, fontWeight: sgFilter === sg ? 700 : 500, fontFamily: 'var(--mono)',
                  background: sgFilter === sg ? (SUBGROUP_COLORS[sg] || 'var(--ac)') + '22' : 'var(--s3)',
                  color: sgFilter === sg ? (SUBGROUP_COLORS[sg] || 'var(--ac)') : 'var(--tm)',
                  border: `1px solid ${sgFilter === sg ? (SUBGROUP_COLORS[sg] || 'var(--ac)') + '55' : 'var(--bd)'}` }}>
                {label.replace('Brainers Club ', '').replace('Main ', '')}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 500, overflow: 'auto' }}>
          {browsePosts.map(p => {
            const sgColor = SUBGROUP_COLORS[p.collection] || 'var(--tm)'
            return (
              <button key={p.id} onClick={() => setSelectedPost(p)}
                style={{ padding: '8px 12px', background: 'var(--s2)', borderRadius: 6, display: 'flex', gap: 10, alignItems: 'center', border: '1px solid var(--bd)', width: '100%', textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = sgColor} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--bd)'}>
                <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: p.post_type === 'QUESTION' ? '#60A5FA' : 'var(--tm)', padding: '1px 4px', borderRadius: 2, background: 'var(--s3)', flexShrink: 0, fontWeight: 700 }}>{(p.post_type || 'POST').slice(0, 4)}</span>
                <div style={{ width: 3, alignSelf: 'stretch', background: sgColor, borderRadius: 2, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--ts)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.hook_text_english || p.title_english || p.full_text_english?.slice(0, 100) || '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--tm)', fontFamily: 'var(--mono)', marginTop: 1 }}>{SUBGROUP_LABELS[p.collection] ?? p.collection} · {p.date_normalized}</div>
                </div>
              </button>
            )
          })}
        </div>
        {totalFiltered > browsePosts.length && (
          <button onClick={() => setShowAllPosts(o => !o)}
            style={{ marginTop: 8, padding: '8px 16px', borderRadius: 6, background: 'var(--s3)', border: '1px solid var(--bd)', color: 'var(--ts)', fontSize: 13, fontFamily: 'var(--mono)', cursor: 'pointer' }}>
            {showAllPosts ? '▲ Show fewer' : `▼ Show more (${totalFiltered.toLocaleString()} total)`}
          </button>
        )}
      </div>

      {selectedPost && (
        <Portal>
          <CommunityDetailPanel post={selectedPost} onClose={() => setSelectedPost(null)} />
        </Portal>
      )}

      {toolPosts && (
        <Portal>
          <>
            <div onClick={() => setToolPosts(null)} style={{ position: 'fixed', inset: 0, background: '#00000066', zIndex: 100 }} />
            <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 480, background: 'var(--s1)', borderLeft: '1px solid var(--bd)', zIndex: 101, overflow: 'auto', padding: 24, animation: 'slideIn 0.2s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: toolPosts.color || 'var(--ac)', fontFamily: 'var(--mono)' }}>{toolPosts.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--tm)', fontFamily: 'var(--mono)' }}>{toolPosts.count} mentions · {toolPosts.posts?.length} posts</div>
                </div>
                <button onClick={() => setToolPosts(null)} style={{ color: 'var(--tm)', fontSize: 20 }}>✕</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(toolPosts.posts || []).map(p => (
                  <button key={p.id} onClick={() => { setToolPosts(null); setSelectedPost(p) }}
                    style={{ padding: '8px 12px', background: 'var(--s2)', borderRadius: 6, display: 'flex', gap: 8, alignItems: 'center', border: '1px solid var(--bd)', width: '100%', textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--ac)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--bd)'}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: 'var(--ts)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.hook_text_english || p.title_english || p.full_text_english?.slice(0, 80) || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--tm)', fontFamily: 'var(--mono)' }}>{SUBGROUP_LABELS[p.collection] ?? p.collection} · {p.date_normalized}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        </Portal>
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--tm)', fontFamily: 'var(--mono)', letterSpacing: '0.06em' }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--tp)' }}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
    </div>
  )
}

function CommunityDetailPanel({ post, onClose }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: '#00000066', zIndex: 100 }} />
      <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 500, background: 'var(--s1)', borderLeft: '1px solid var(--bd)', zIndex: 101, overflow: 'auto', padding: 28, animation: 'slideIn 0.2s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 14, fontFamily: 'var(--mono)', color: '#60A5FA', fontWeight: 700 }}>{post.post_type || 'POST'}</div>
            <div style={{ fontSize: 13, color: 'var(--tm)', fontFamily: 'var(--mono)' }}>{SUBGROUP_LABELS[post.collection] ?? post.collection} · {post.date_normalized}</div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--tm)', fontSize: 20 }}>✕</button>
        </div>
        {(post.hook_text_english || post.title_english) && (
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--tp)', lineHeight: 1.4, marginBottom: 14 }}>{post.hook_text_english || post.title_english}</div>
        )}
        {post.tools_mentioned && post.tools_mentioned !== 'NONE' && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--tm)', fontFamily: 'var(--mono)', marginBottom: 5 }}>TOOLS MENTIONED</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {post.tools_mentioned.split(',').map(t => t.trim()).filter(t => t && t !== 'NONE').map(t => (
                <span key={t} style={{ fontSize: 12, padding: '2px 7px', borderRadius: 4, background: '#38BDF822', color: '#38BDF8', fontFamily: 'var(--mono)' }}>{t}</span>
              ))}
            </div>
          </div>
        )}
        {(post.full_text_english || post.full_text_hebrew) && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--tm)', fontFamily: 'var(--mono)', marginBottom: 5 }}>FULL POST</div>
            <div style={{ fontSize: 14, color: 'var(--ts)', lineHeight: 1.65, whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto', background: 'var(--s3)', borderRadius: 8, padding: '10px 12px' }}>
              {post.full_text_english || post.full_text_hebrew}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
