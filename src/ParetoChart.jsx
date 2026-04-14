import { useState } from 'react'

const PALETTE = [
  '#38BDF8','#34D399','#FBBF24','#F43F5E','#A78BFA','#F97316','#22D3EE','#F472B6',
  '#60A5FA','#4ADE80','#FCD34D','#FB7185','#818CF8','#FB923C','#67E8F9','#E879F9',
  '#6366F1','#10B981','#EAB308','#EF4444','#8B5CF6','#D946EF','#14B8A6','#E11D48',
]

export default function ParetoChart({
  items = [],
  onBarClick,
  valueLabel = 'avg comments',
  minPosts = 3,
  maxBars = 14,
  sortOptions,
  activeSort,
  onSortChange,
  filterOptions,
  activeFilters,
  onFilterToggle,
  descriptions,
}) {
  const [expanded, setExpanded] = useState(false)
  const [hoveredIdx, setHoveredIdx] = useState(null)
  const [expandedInsight, setExpandedInsight] = useState(null)
  const [infoOpen, setInfoOpen] = useState(null)

  if (!items.length) return (
    <div style={{ padding: '24px 0', color: 'var(--tm)', fontSize: 15, fontFamily: 'var(--mono)' }}>No data in current filter.</div>
  )

  const coloredItems = items.map((item, i) => ({
    ...item,
    color: (item.color && item.color !== 'var(--ac)') ? item.color : PALETTE[i % PALETTE.length],
  }))

  const visible = expanded ? coloredItems : coloredItems.slice(0, maxBars)
  const maxVal = Math.max(...coloredItems.map(d => d.value), 1)
  const isLongList = visible.length > 20
  const rowPad = isLongList ? '6px 10px' : '8px 12px'
  const rankSize = isLongList ? 12 : 14
  const labelSize = isLongList ? 12 : 14
  const valSize = isLongList ? 14 : 16
  const barH = isLongList ? 18 : 24
  const labelW = isLongList ? 120 : 150

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isLongList ? 2 : 4 }}>
      {(sortOptions || filterOptions) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
          {sortOptions && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--tm)', fontFamily: 'var(--mono)', marginRight: 4 }}>SORT</span>
              {sortOptions.map(s => (
                <button key={s.id} onClick={() => onSortChange && onSortChange(s.id)}
                  style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: activeSort === s.id ? 700 : 500, fontFamily: 'var(--mono)',
                    background: activeSort === s.id ? 'var(--ac2)' : 'var(--s3)', color: activeSort === s.id ? '#fff' : 'var(--tm)',
                    border: `1px solid ${activeSort === s.id ? 'var(--ac2)' : 'var(--bd)'}`, transition: 'all 0.12s' }}>
                  {s.label}
                </button>
              ))}
            </div>
          )}
          {filterOptions && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginLeft: sortOptions ? 12 : 0 }}>
              <span style={{ fontSize: 11, color: 'var(--tm)', fontFamily: 'var(--mono)', marginRight: 4 }}>FILTER</span>
              {filterOptions.map(f => {
                const active = activeFilters?.has(f.id)
                return (
                  <button key={f.id} onClick={() => onFilterToggle && onFilterToggle(f.id)}
                    style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: active ? 700 : 500, fontFamily: 'var(--mono)',
                      background: active ? (f.color || 'var(--ac2)') + '22' : 'var(--s3)', color: active ? (f.color || 'var(--ac)') : 'var(--tm)',
                      border: `1px solid ${active ? (f.color || 'var(--ac2)') + '55' : 'var(--bd)'}`, transition: 'all 0.12s' }}>
                    {f.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {visible.map((item, i) => {
        const pct = Math.max((item.value / maxVal) * 100, 2)
        const isHovered = hoveredIdx === i
        const hasInsight = !!item.insight
        const isInsightOpen = expandedInsight === i
        const desc = descriptions?.[item.label]
        const isInfoOpen = infoOpen === item.label

        return (
          <div key={item.label + i}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, position: 'relative' }}>
              <button
                onClick={() => { if (item.posts?.length > 0 && onBarClick) onBarClick(item) }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{
                  flex: 1, textAlign: 'left', display: 'flex', alignItems: 'center', gap: isLongList ? 6 : 8,
                  padding: rowPad, borderRadius: isLongList ? 5 : 7,
                  background: isHovered ? 'var(--s3)' : i % 2 === 0 ? 'var(--s2)' : '#0f172a',
                  border: `1px solid ${isHovered ? item.color + '55' : 'transparent'}`,
                  transition: 'all 0.12s', cursor: item.posts?.length > 0 ? 'pointer' : 'default',
                }}
              >
                <div style={{ width: 22, textAlign: 'center', fontSize: rankSize, fontWeight: 800, fontFamily: 'var(--mono)', color: i < 3 ? item.color : 'var(--tm)' }}>{i + 1}</div>
                <div style={{ width: 3, height: barH, background: item.color, borderRadius: 2, flexShrink: 0 }} />
                <div style={{ width: labelW, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: labelSize, fontWeight: 700, color: 'var(--tp)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
                    {item.sublabel && !isLongList && <div style={{ fontSize: 10, color: 'var(--tm)', fontFamily: 'var(--mono)' }}>{item.sublabel}</div>}
                  </div>
                  {desc && (
                    <button onClick={e => { e.stopPropagation(); setInfoOpen(isInfoOpen ? null : item.label) }}
                      style={{ width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        background: isInfoOpen ? item.color + '22' : 'transparent', color: isInfoOpen ? item.color : 'var(--bd2)',
                        border: `1px solid ${isInfoOpen ? item.color + '44' : 'var(--bd)'}`,
                        fontSize: 9, fontWeight: 700, transition: 'all 0.12s' }}>ⓘ</button>
                  )}
                  {isInfoOpen && desc && (
                    <div style={{ position: 'absolute', left: 0, top: 'calc(100% + 4px)', zIndex: 50, background: 'var(--s1)', border: '1px solid var(--bd2)', borderRadius: 8, padding: '10px 14px', minWidth: 260, maxWidth: 360, boxShadow: '0 8px 24px #00000066', fontSize: 13, color: 'var(--ts)', lineHeight: 1.5 }}>
                      <div style={{ fontWeight: 700, color: item.color, marginBottom: 4, fontFamily: 'var(--mono)' }}>{item.label}</div>
                      {desc}
                    </div>
                  )}
                </div>

                <div style={{ flex: 1, position: 'relative', height: barH, background: 'var(--s3)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: pct + '%',
                    background: `linear-gradient(90deg, ${item.color}55, ${item.color}22)`,
                    borderRadius: 4, borderRight: `2px solid ${item.color}`,
                    transition: 'width 0.4s ease',
                  }} />
                </div>

                <div style={{ width: isLongList ? 65 : 80, textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: valSize, fontWeight: 800, fontFamily: 'var(--mono)', color: item.color }}>
                    {typeof item.value === 'number' ? (item.value >= 1000 ? (item.value / 1000).toFixed(1) + 'K' : Math.round(item.value)) : item.value}
                  </div>
                  {!isLongList && <div style={{ fontSize: 10, color: 'var(--tm)', fontFamily: 'var(--mono)' }}>{valueLabel}</div>}
                </div>

                <div style={{ width: isLongList ? 50 : 65, textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--tm)' }}>{item.count} {isLongList ? '' : 'post' + (item.count !== 1 ? 's' : '')}</div>
                  {item.posts?.length > 0 && !isLongList && <div style={{ fontSize: 9, color: isHovered ? item.color : 'var(--bd2)', fontFamily: 'var(--mono)', transition: 'color 0.12s' }}>click →</div>}
                </div>
              </button>

              {hasInsight && !isLongList && (
                <button onClick={() => setExpandedInsight(isInsightOpen ? null : i)}
                  style={{ width: 24, height: 24, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 4,
                    background: isInsightOpen ? item.color + '22' : 'var(--s3)', color: isInsightOpen ? item.color : 'var(--tm)',
                    border: `1px solid ${isInsightOpen ? item.color + '44' : 'var(--bd)'}`, fontSize: 12, fontWeight: 700, flexShrink: 0, transition: 'all 0.12s' }}>?</button>
              )}
            </div>

            {isInsightOpen && item.insight && (
              <div style={{ margin: '3px 0 3px 40px', padding: '12px 16px', background: item.color + '08', border: `1px solid ${item.color}22`, borderRadius: 7, animation: 'fadeIn 0.15s ease' }}>
                {item.insight.stat && <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tp)', marginBottom: 5, lineHeight: 1.4 }}>{item.insight.stat}</div>}
                {item.insight.why && <div style={{ fontSize: 12, color: 'var(--ts)', lineHeight: 1.55, marginBottom: item.insight.action ? 5 : 0 }}>{item.insight.why}</div>}
                {item.insight.action && <div style={{ fontSize: 12, color: item.color, lineHeight: 1.5, fontStyle: 'italic' }}>→ {item.insight.action}</div>}
              </div>
            )}
          </div>
        )
      })}

      {coloredItems.length > maxBars && (
        <button onClick={() => setExpanded(e => !e)}
          style={{ padding: '8px 14px', borderRadius: 6, fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 700,
            background: 'var(--s3)', color: 'var(--ac)', border: '1px solid var(--bd)', cursor: 'pointer',
            transition: 'border-color 0.12s', marginTop: 4 }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--ac)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--bd)'}>
          {expanded ? `▲ Show top ${maxBars} only` : `▼ Show all ${coloredItems.length} (${coloredItems.length - maxBars} more)`}
        </button>
      )}
    </div>
  )
}
