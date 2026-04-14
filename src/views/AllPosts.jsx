import { GlossaryTip } from '../Glossary.jsx'
import { useState, useMemo } from 'react'
import { CHANNEL_LABELS, CHANNEL_META, HOOK_COLORS, INTENT_COLORS, CTA_COLORS } from '../useData.js'
import Portal from '../Portal.jsx'

function destLabel(raw) {
  if (!raw || raw === 'NONE' || raw === 'False' || raw === '') return null
  const r = (raw || '').toLowerCase()
  if (r.includes('landing page') || r.includes('registration') || r.includes('challenge register') || r.includes('free tutorial') || r.includes('webinar') || r.includes('live') || r.includes('signup') || r.includes('form')) return 'Landing page'
  if (r.includes('whatsapp') || r.includes('wa free') || r.includes('wa group')) return 'WhatsApp group'
  if (r.includes('brainers club') || r.includes('paid') || r.includes('purchase') || r.includes('checkout') || r.includes('50%') || r.includes('₪')) return 'Sales page'
  if (r.includes('dm') || r.includes('direct message') || r.includes('comment keyword') || r.includes('sent via')) return 'DM / automation'
  if (r.includes('youtube') || r.includes('video') || r.includes('watch')) return 'YouTube video'
  if (r.includes('awareness') || r.includes('no destination')) return null
  return raw
}

export default function ViewAllPosts({ posts, competitor, initialChannel, onNavigate }) {
  const [search, setSearch] = useState('')
  const [channelFilter, setChannelFilter] = useState(initialChannel ?? null)
  const [sortBy, setSortBy] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [detailPost, setDetailPost] = useState(null)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  const sorted = useMemo(() => {
    let filtered = channelFilter ? posts.filter(p => p.channel === channelFilter) : posts
    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = filtered.filter(p =>
        (p.hook_text_english ?? '').toLowerCase().includes(q) ||
        (p.hook_text_hebrew ?? '').toLowerCase().includes(q) ||
        (p.full_text_english ?? '').toLowerCase().includes(q) ||
        (p.campaign_id ?? '').toLowerCase().includes(q) ||
        (p.channel ?? '').toLowerCase().includes(q)
      )
    }
    const dir = sortDir === 'desc' ? -1 : 1
    return [...filtered].sort((a, b) => {
      if (sortBy === 'date') return dir * ((a.date_obj ?? 0) - (b.date_obj ?? 0))
      if (sortBy === 'comments') return dir * (a.comments_n - b.comments_n)
      if (sortBy === 'likes') return dir * (a.likes_n - b.likes_n)
      if (sortBy === 'er') return dir * ((a.er_computed ?? -1) - (b.er_computed ?? -1))
      return 0
    })
  }, [posts, search, sortBy, sortDir, channelFilter])

  const pageCount = Math.ceil(sorted.length / PAGE_SIZE)
  const visible = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortBy(col); setSortDir('desc') }
    setPage(0)
  }

  function SortBtn({ col, label }) {
    const active = sortBy === col
    return (
      <button onClick={() => toggleSort(col)} style={{
        padding: '4px 10px', borderRadius: 6, fontSize: 15, fontWeight: active ? 700 : 500,
        fontFamily: 'var(--mono)',
        background: active ? 'var(--ac2)' : 'var(--s3)',
        color: active ? '#fff' : 'var(--ts)',
        transition: 'all 0.15s',
      }}>
        {label} {active ? (sortDir === 'desc' ? '↓' : '↑') : ''}
      </button>
    )
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Channel filter pills */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {['ALL', ...[...new Set(posts.map(p => p.channel))].sort()].map(ch => {
          const isAll = ch === 'ALL'
          const active = isAll ? !channelFilter : channelFilter === ch
          const color = isAll ? 'var(--ac)' : (CHANNEL_META[ch]?.color ?? '#666')
          return (
            <button key={ch}
              onClick={() => { setChannelFilter(isAll ? null : (channelFilter === ch ? null : ch)); setPage(0) }}
              style={{ fontSize: 14, fontFamily: 'var(--mono)', fontWeight: 700, padding: '3px 9px', borderRadius: 4, cursor: 'pointer', background: active ? color + '22' : 'var(--s3)', color: active ? color : 'var(--tm)', border: `1px solid ${active ? color + '55' : 'var(--bd)'}`, transition: 'all 0.12s' }}>
              {isAll ? 'ALL' : (CHANNEL_LABELS[ch] ?? ch)}
            </button>
          )
        })}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
          placeholder="Search posts, campaigns, channels…"
          style={{ flex: 1, minWidth: 240, padding: '8px 12px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 8, color: 'var(--tp)', fontSize: 15, outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          <SortBtn col="date" label="Date" />
          <SortBtn col="comments" label="Comments" />
          <SortBtn col="likes" label="Likes" />
          <SortBtn col="er" label="ER%" />
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 15, color: 'var(--tm)' }}>
          {sorted.length} posts
        </div>
      </div>

      {/* Table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '100px 100px 1fr 60px 60px 70px 80px', gap: 8, padding: '6px 14px', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--tm)', letterSpacing: '0.08em' }}>
          <span>CHANNEL</span>
          <span>DATE</span>
          <span>HOOK</span>
          <span style={{ textAlign: 'right' }}>💬</span>
          <span style={{ textAlign: 'right' }}>👍</span>
          <span style={{ textAlign: 'right' }}>ER%</span>
          <span>INTENT</span>
        </div>

        {visible.map(p => <PostTableRow key={p.id} post={p} onClick={() => setDetailPost(p)} />)}
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', paddingTop: 8 }}>
          <PageBtn disabled={page === 0} onClick={() => setPage(p => p - 1)}>←</PageBtn>
          {Array.from({ length: Math.min(pageCount, 7) }, (_, i) => {
            const p2 = pageCount <= 7 ? i : Math.max(0, Math.min(pageCount - 7, page - 3)) + i
            return (
              <PageBtn key={p2} active={p2 === page} onClick={() => setPage(p2)}>
                {p2 + 1}
              </PageBtn>
            )
          })}
          <PageBtn disabled={page >= pageCount - 1} onClick={() => setPage(p => p + 1)}>→</PageBtn>
        </div>
      )}

      {detailPost && <Portal><DetailPanel post={detailPost} onClose={() => setDetailPost(null)} onNavigate={onNavigate} /></Portal>}
    </div>
  )
}

function PostTableRow({ post, onClick }) {
  const color = CHANNEL_META[post.channel]?.color ?? '#666'
  const intentColor = INTENT_COLORS[post.intent] ?? 'var(--bd2)'
  return (
    <button onClick={onClick} style={{
      display: 'grid', gridTemplateColumns: '100px 100px 1fr 60px 60px 70px 80px',
      gap: 8, padding: '8px 14px', borderRadius: 8,
      background: 'var(--s2)', border: '1px solid transparent',
      textAlign: 'left', cursor: 'pointer', width: '100%',
      transition: 'border-color 0.12s',
      alignItems: 'center',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--bd)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
    >
      <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {CHANNEL_LABELS[post.channel]}
      </span>
      <span style={{ fontSize: 14, fontFamily: 'var(--mono)', color: 'var(--tm)' }}>
        {post.date_normalized?.slice(2) ?? '—'}
      </span>
      <span style={{ fontSize: 15, color: 'var(--ts)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {post.hook_text_english || post.hook_text_hebrew || '—'}
      </span>
      <span style={{ fontSize: 14, fontFamily: 'var(--mono)', color: 'var(--tp)', textAlign: 'right' }}>{post.comments_n || '—'}</span>
      <span style={{ fontSize: 14, fontFamily: 'var(--mono)', color: 'var(--tp)', textAlign: 'right' }}>{post.likes_n || '—'}</span>
      <span style={{ fontSize: 15, fontFamily: 'var(--mono)', color: post.er_computed != null ? 'var(--ts)' : 'var(--tm)', textAlign: 'right' }}>
        {post.er_computed != null ? post.er_computed.toFixed(2) + '%' : (CHANNEL_META[post.channel]?.erMethod === 'na') ? 'N/A' : '—'}
      </span>
      <span style={{ fontSize: 15, fontFamily: 'var(--mono)', fontWeight: 700, padding: '2px 5px', borderRadius: 3, background: intentColor + '22', color: intentColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {post.intent || '—'}
      </span>
    </button>
  )
}

function PageBtn({ children, onClick, disabled, active }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: 32, height: 32, borderRadius: 6, fontSize: 14,
      fontFamily: 'var(--mono)', cursor: disabled ? 'default' : 'pointer',
      background: active ? 'var(--ac2)' : 'var(--s3)',
      color: active ? '#fff' : disabled ? 'var(--tm)' : 'var(--ts)',
      opacity: disabled ? 0.4 : 1,
    }}>
      {children}
    </button>
  )
}

function DetailPanel({ post, onClose, onNavigate }) {
  const color = CHANNEL_META[post.channel]?.color ?? '#666'
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: '#00000066', zIndex: 100 }} />
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 500,
        background: 'var(--s1)', borderLeft: '1px solid var(--bd)',
        zIndex: 101, overflow: 'auto', padding: 28,
        animation: 'slideIn 0.2s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: 'var(--mono)' }}>{CHANNEL_LABELS[post.channel]}</div>
            <div style={{ fontSize: 15, color: 'var(--tm)', fontFamily: 'var(--mono)' }}>{post.date_normalized} · {post.day_of_week}</div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--tm)', fontSize: 20 }}>✕</button>
        </div>

        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tp)', lineHeight: 1.4, marginBottom: 6 }}>
          {post.hook_text_english || post.hook_text_hebrew}
        </div>
        {post.hook_text_hebrew && post.hook_text_english && (
          <div style={{ fontSize: 15, color: 'var(--ts)', fontStyle: 'italic', marginBottom: 16, direction: 'rtl' }}>{post.hook_text_hebrew}</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            ['Likes', post.likes_n],
            ['Comments', post.comments_n],
            ['Shares', post.shares_n],
            ['Views', post.views_n || '—'],
            ['ER', post.er_computed != null ? post.er_computed.toFixed(3) + '%' : 'N/A'],
            ['Emojis', post.emoji_count || '—'],
          ].map(([l, v]) => (
            <div key={l} style={{ background: 'var(--s3)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 15, color: 'var(--tm)', letterSpacing: '0.08em', marginBottom: 3 }}>{l}</div>
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--tp)' }}>
                {(v !== null && v !== undefined && String(v) !== '0' && v !== '') ? v : '—'}
              </div>
            </div>
          ))}
        </div>

        <DF label="Classification">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {post.hook_type && <Tag color={HOOK_COLORS[post.hook_type] ?? 'var(--bd2)'}><GlossaryTip fieldType="hook_type" value={post.hook_type}>{post.hook_type}</GlossaryTip></Tag>}
            {post.intent && <Tag color={INTENT_COLORS[post.intent] ?? 'var(--bd2)'}><GlossaryTip fieldType="intent" value={post.intent}>{post.intent}</GlossaryTip></Tag>}
            {post.cta_method && <Tag color={CTA_COLORS[post.cta_method] ?? 'var(--bd2)'}><GlossaryTip fieldType="cta_method" value={post.cta_method}>{post.cta_method}</GlossaryTip></Tag>}
            {post.media_format && <Tag color="#475569">{post.media_format}</Tag>}
          </div>
        </DF>

        {post.campaign_id && post.campaign_id !== 'NONE' && post.campaign_id !== '' && (
          <DF label="Campaign">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => onNavigate && onNavigate('campaigns', { campaignId: post.campaign_id })} style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--ac)', background: 'var(--ac)18', border: '1px solid var(--ac)44', borderRadius: 4, padding: '1px 7px', cursor: 'pointer' }}>
                {post.campaign_id} →
              </button>
            </div>
          </DF>
        )}

        {(destLabel(post.dest_immediate) || destLabel(post.dest_ultimate)) && (
          <DF label="Funnel">
            {destLabel(post.dest_immediate) && <div style={{ fontSize: 15, color: 'var(--ts)', marginBottom: 4 }}>Immediate: {destLabel(post.dest_immediate)}</div>}
            {destLabel(post.dest_ultimate) && <div style={{ fontSize: 15, color: 'var(--ts)' }}>Ultimate: {destLabel(post.dest_ultimate)}</div>}
          </DF>
        )}

        {(post.full_text_english || post.full_text_hebrew) && (
          <DF label="Full post (English)">
            <div style={{ fontSize: 15, color: 'var(--ts)', lineHeight: 1.65, whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto', background: 'var(--s3)', borderRadius: 8, padding: '10px 12px' }}>
              {post.full_text_english || post.full_text_hebrew}
            </div>
          </DF>
        )}

        {post.image_description && (
          <DF label="Visual">
            <div style={{ fontSize: 15, color: 'var(--ts)', fontStyle: 'italic', lineHeight: 1.6 }}>{post.image_description}</div>
          </DF>
        )}

        <DF label="Source">
          <span style={{ fontFamily: 'var(--mono)', fontSize: 15, color: 'var(--tm)' }}>{post.source_file} · ID: {post.id}</span>
        </DF>

        {post.post_url && (
          <DF label="Post URL">
            <a href={post.post_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 15, color: 'var(--ac)', textDecoration: 'underline' }}>
              Open original →
            </a>
          </DF>
        )}
      </div>
    </>
  )
}

function Tag({ color, children }) {
  return (
    <span style={{ fontSize: 15, fontFamily: 'var(--mono)', fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: color + '22', color, border: `1px solid ${color}33` }}>
      {children}
    </span>
  )
}

function DF({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 15, fontFamily: 'var(--mono)', color: 'var(--tm)', letterSpacing: '0.1em', marginBottom: 5 }}>{label.toUpperCase()}</div>
      {children}
    </div>
  )
}
