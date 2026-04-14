import { useState } from 'react'
import Portal from './Portal.jsx'
import { CHANNEL_LABELS, CHANNEL_META } from './useData.js'

export function PostDetailPanel({ post, onClose, zIndex = 201 }) {
  if (!post) return null
  const color = CHANNEL_META[post.channel]?.color ?? '#666'
  const er = post.er_computed != null ? post.er_computed.toFixed(2) + '%' : 'N/A'

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: '#00000055', zIndex: zIndex - 1 }}
      />
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 500,
        background: 'var(--s1)', borderLeft: '1px solid var(--bd2)',
        zIndex, overflow: 'auto', padding: 28,
        animation: 'slideIn 0.18s ease',
        boxShadow: '-8px 0 32px #00000044',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: 'var(--mono)', letterSpacing: '0.06em' }}>
              {CHANNEL_LABELS[post.channel] ?? post.channel}
            </div>
            <div style={{ fontSize: 13, color: 'var(--tm)', fontFamily: 'var(--mono)', marginTop: 2 }}>
              {post.date_normalized} {post.day_of_week ? `· ${post.day_of_week}` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--tm)', fontSize: 20, lineHeight: 1, padding: '0 2px', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--tp)', lineHeight: 1.4, marginBottom: 16 }}>
          {post.hook_text_english || post.hook_text_hebrew || '(no hook)'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 18 }}>
          {[
            ['Likes',    post.likes_n ?? '—'],
            ['Comments', post.comments_n ?? '—'],
            ['ER',       er],
          ].map(([label, val]) => (
            <div key={label} style={{ background: 'var(--s3)', borderRadius: 7, padding: '8px 10px' }}>
              <div style={{ fontSize: 12, color: 'var(--tm)', fontFamily: 'var(--mono)' }}>{label}</div>
              <div style={{ fontSize: 17, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--tp)' }}>{val}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {post.intent && post.intent !== 'False' && <Tag label={post.intent} color="#FB923C" />}
          {post.hook_type && <Tag label={post.hook_type} color="#60A5FA" />}
          {post.cta_method && post.cta_method !== 'NONE' && post.cta_method !== 'False' && <Tag label={post.cta_method} color="#F472B6" />}
          {post.campaign_id && !['NONE','UNKNOWN','STANDALONE','SERIES',''].includes(post.campaign_id) && (
            <Tag label={post.campaign_id.replace('CAMP-', '')} color="#A78BFA" />
          )}
        </div>

        {(post.dest_immediate || post.dest_ultimate) && (
          <DetailField label="Funnel path">
            <div style={{ fontSize: 13, color: 'var(--ts)', lineHeight: 1.6 }}>
              {post.dest_immediate && post.dest_immediate !== 'NONE' && (
                <span>→ <span style={{ color: '#25D366' }}>{post.dest_immediate}</span></span>
              )}
              {post.dest_ultimate && post.dest_ultimate !== 'NONE' && (
                <span style={{ marginLeft: 8 }}>⟹ <span style={{ color: '#FBBF24', fontWeight: 700 }}>{post.dest_ultimate}</span></span>
              )}
            </div>
          </DetailField>
        )}

        {(post.full_text_english || post.full_text_hebrew) && (
          <DetailField label="Post copy">
            <div style={{
              fontSize: 13, color: 'var(--ts)', lineHeight: 1.7,
              whiteSpace: 'pre-wrap', maxHeight: 320, overflow: 'auto',
              background: 'var(--s3)', borderRadius: 8, padding: '12px 14px',
            }}>
              {post.full_text_english || post.full_text_hebrew}
            </div>
          </DetailField>
        )}

        {post.image_description && post.image_description !== 'NONE' && post.image_description !== '' && (
          <DetailField label="Image description">
            <div style={{
              fontSize: 13, color: 'var(--tm)', lineHeight: 1.6,
              background: 'var(--s3)', borderRadius: 8, padding: '10px 14px',
              borderLeft: '3px solid var(--bd2)',
              fontStyle: 'italic',
            }}>
              {post.image_description}
            </div>
            {post.visual_type && post.visual_type !== 'NONE' && (
              <div style={{ fontSize: 11, color: 'var(--tm)', fontFamily: 'var(--mono)', marginTop: 4 }}>
                Visual type: {post.visual_type}
              </div>
            )}
          </DetailField>
        )}

        {post.post_url && (
          <div style={{ marginTop: 16 }}>
            <a
              href={post.post_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, color: 'var(--ac)', fontFamily: 'var(--mono)' }}
            >
              Open original post →
            </a>
          </div>
        )}
      </div>
    </>
  )
}

export function PostListPanel({ title, subtitle, posts, onClose, accentColor = '#38BDF8', zIndex = 100 }) {
  const [detailPost, setDetailPost] = useState(null)

  return (
    <Portal>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: '#00000066', zIndex }} />

      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 480,
        background: 'var(--s1)', borderLeft: '1px solid var(--bd)',
        zIndex: zIndex + 1, overflow: 'auto', padding: 24,
        animation: 'slideIn 0.2s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div style={{ flex: 1, paddingRight: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: accentColor, fontFamily: 'var(--mono)', letterSpacing: '0.06em', marginBottom: 4 }}>
              {title}
            </div>
            {subtitle && (
              <div style={{ fontSize: 13, color: 'var(--tm)', lineHeight: 1.5 }}>{subtitle}</div>
            )}
          </div>
          <button onClick={onClose} style={{ color: 'var(--tm)', fontSize: 20, lineHeight: 1, padding: '0 2px', cursor: 'pointer', flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ fontSize: 12, color: 'var(--tm)', fontFamily: 'var(--mono)', marginBottom: 16 }}>
          {posts.length} post{posts.length !== 1 ? 's' : ''} · click any to see full content
        </div>

        {posts.length === 0 ? (
          <div style={{ fontSize: 14, color: 'var(--tm)', fontStyle: 'italic', padding: '12px 0' }}>
            No posts match this filter.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {posts.map(p => (
              <PostRow
                key={p.id ?? (p.hook_text_english + p.date_normalized)}
                post={p}
                accentColor={accentColor}
                onClick={() => setDetailPost(p)}
              />
            ))}
          </div>
        )}
      </div>

      {detailPost && (
        <PostDetailPanel
          post={detailPost}
          onClose={() => setDetailPost(null)}
          zIndex={zIndex + 10}
        />
      )}
    </Portal>
  )
}

function PostRow({ post, accentColor, onClick }) {
  const chColor = CHANNEL_META[post.channel]?.color ?? '#666'
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', padding: '10px 12px',
        background: 'var(--s2)', borderRadius: 8,
        border: `1px solid var(--bd)`,
        cursor: 'pointer', transition: 'border-color 0.12s',
        display: 'flex', gap: 10, alignItems: 'center',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = accentColor}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--bd)'}
    >
      <div style={{ width: 3, alignSelf: 'stretch', background: chColor, borderRadius: 2, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--ts)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
          {post.hook_text_english || post.hook_text_hebrew || '(no hook)'}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 700, color: chColor }}>
            {CHANNEL_LABELS[post.channel] ?? post.channel}
          </span>
          <span style={{ fontSize: 12, color: 'var(--tm)', fontFamily: 'var(--mono)' }}>{post.date_normalized}</span>
          {post.intent && post.intent !== 'False' && (
            <span style={{ fontSize: 11, color: '#FB923C', fontFamily: 'var(--mono)' }}>{post.intent}</span>
          )}
        </div>
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--tp)' }}>
          {post.comments_n ?? '—'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--tm)', fontFamily: 'var(--mono)' }}>cmts</div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--tm)', flexShrink: 0 }}>→</div>
    </button>
  )
}

function Tag({ label, color }) {
  return (
    <span style={{
      fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 700, letterSpacing: '0.04em',
      padding: '2px 6px', borderRadius: 3,
      background: color + '22', color,
      border: `1px solid ${color}44`,
    }}>{label}</span>
  )
}

function DetailField({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--tm)', letterSpacing: '0.1em', marginBottom: 6 }}>
        {label.toUpperCase()}
      </div>
      {children}
    </div>
  )
}
