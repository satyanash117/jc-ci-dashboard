import { useState, useMemo } from 'react'
import { CHANNEL_LABELS, CHANNEL_META } from '../useData.js'
import { PostListPanel } from '../PostPanel.jsx'

function cmts(p) { return typeof p.comments_n === 'number' ? p.comments_n : 0 }
function mean(arr) { return arr.length ? Math.round(arr.reduce((s,v)=>s+v,0)/arr.length) : 0 }

// ── Static Eden-specific gap analysis ────────────────────────────────────────
// Used only when competitor.slug === 'eden_bibas'. For other competitors,
// aiSummary.opportunities is used (or a "not enough data" placeholder).

const EDEN_CHANNEL_GAPS = [
  {
    id: 'tiktok',
    title: 'TikTok — 24,100 followers, 13 posts total',
    type: 'channel',
    severity: 'high',
    insight: 'Eden has 24,100 TikTok followers but has posted only 13 times across 2+ years. He averages less than once a month. TikTok is the only major short-form video channel where he has meaningful following but no real presence. His Hebrew-speaking audience is on TikTok — especially under-35s who aren\'t on Facebook.',
    opportunity: 'Consistent TikTok posting (3–5x/week) with no direct Eden competition. His best TikTok hook is news-break content averaging 123 comments despite minimal posting — with systematic posting this would compound. Short-form video tutorials on AI tools are the highest-reach format on TikTok right now.',
    how: 'Repurpose Instagram Reels content to TikTok. Eden\'s strongest Instagram content (FOMO hooks + comment-keyword CTA) translates directly. Unlike Facebook, TikTok\'s algorithm surfaces content to people who don\'t follow you — higher ceiling for new audience discovery.',
  },
  {
    id: 'youtube',
    title: 'YouTube — posted 25 videos, stopped in 2026',
    type: 'channel',
    severity: 'medium',
    insight: 'Eden posted on YouTube actively from late 2024 through early 2025, then slowed dramatically — only 3 videos in all of 2026. YouTube compounds over time in ways social media doesn\'t — old videos keep getting views. He appears to have deprioritised it.',
    opportunity: 'YouTube SEO for Hebrew AI content is essentially uncontested. Hebrew-language AI tutorials rank for searches that have no quality competition. A library of 50 structured tutorials would compound into a permanent traffic source Eden isn\'t building.',
    how: 'Focus on searchable topics: "ChatGPT for [profession] in Hebrew," "how to use Claude Code," "best AI tools 2026 Israel." Eden\'s best format is the 5–20 minute tutorial.',
  },
  {
    id: 'linkedin_ck',
    title: 'LinkedIn comment-to-DM — used only 6 times despite 10× engagement lift',
    type: 'mechanic',
    severity: 'high',
    insight: 'Eden\'s LinkedIn posts with comment-to-DM automation average 289 comments. His LinkedIn posts without it average 30. He has used this mechanic only 6 times out of 75 LinkedIn posts — 8% of his output on a channel where it produces a 10× engagement lift.',
    opportunity: 'If JustCapable deploys comment-to-DM automation on LinkedIn consistently from the start, it gets the benefit Eden hasn\'t claimed. LinkedIn is the only major channel where Eden is leaving a 10× multiplier mostly unused.',
    how: 'Every LinkedIn post with a resource to share (a guide, a framework, a tool list) should use a comment keyword. The keyword should be specific to the topic so you can track which content drives the most leads.',
  },
]

const EDEN_TOPIC_GAPS = [
  {
    id: 'automation',
    title: 'Workflow automation — n8n, Zapier, Make: 0 mentions',
    severity: 'high',
    insight: 'Eden covers AI tools — ChatGPT, Claude, Gemini, Midjourney — but has no content on workflow automation platforms. n8n, Zapier, and Make have zero mentions in his 642-post dataset. These tools are the bridge between AI models and real business processes — exactly what his "AI Solutions" positioning claims to be about.',
    opportunity: 'The Hebrew-speaking audience for workflow automation is completely uncovered. Business owners who want AI to actually do things — not just answer questions — need automation knowledge.',
    how: 'Tutorial content on connecting AI tools to real workflows: "How I automated my client onboarding with ChatGPT + n8n," "5 automations any Israeli business owner can set up today."',
  },
  {
    id: 'cursor',
    title: 'Cursor/coding tools — barely covered despite Claude Code being his biggest campaign',
    severity: 'high',
    insight: 'Eden ran his biggest campaign ever on Claude Code (12,000 registrants, 20 posts) but Cursor — the AI code editor with a much larger developer audience — has only 2 mentions in his entire dataset.',
    opportunity: 'Developer-focused Hebrew content on Cursor, Replit, and AI-assisted coding is essentially uncovered. Position as "the AI coding guide for non-programmers."',
    how: 'Tutorial series: "Build your first business tool without knowing how to code." Eden\'s Claude Code campaign showed 12,000 people registered for a beginner coding challenge — the demand is there.',
  },
  {
    id: 'pain_point',
    title: 'Pain-point hooks — 1 post, 19,600 comments',
    severity: 'high',
    insight: 'Eden\'s single pain-point hook ("ChatGPT\'s sycophancy is costing you dearly") is his highest-performing post in the entire dataset at 19,600 comments — by a factor of 10× over anything else. He has used this hook type exactly once.',
    opportunity: 'Pain-point hooks frame a specific cost the audience is already experiencing. The 19,600-comment post worked because it named something the audience felt but hadn\'t articulated.',
    how: 'Build a content series around specific AI pain points the audience experiences. Each pain point opens with the cost, then offers a solution — with a comment-keyword CTA to receive a guide.',
  },
  {
    id: 'hard_sell_timing',
    title: 'Hard-sell content averages 12 comments — 52× below soft-sell',
    severity: 'medium',
    insight: 'Eden\'s hard-sell posts average 12 comments. His soft-sell posts average 622 comments — a 52× gap.',
    opportunity: 'JustCapable can outperform Eden on conversion by using soft-sell mechanics exclusively. The data says never hard-sell — always frame offers as value delivery with a call to action.',
    how: 'Replace every "buy now / limited spots / last chance" post with a "here\'s what you get / who this is for / comment X if you want the details" soft-sell post.',
  },
  {
    id: 'english_gap',
    title: 'English-language content — zero posts',
    severity: 'medium',
    insight: 'Every single post in Eden\'s 642-post dataset is in Hebrew. He has never posted English-language content.',
    opportunity: 'A bilingual content strategy would serve Israelis who work in English-speaking companies and reach Israeli diaspora audiences globally. This is a segment Eden has explicitly left uncovered.',
    how: 'Don\'t translate content — create English content that\'s adapted for context. LinkedIn is the natural channel for this.',
  },
]

const EDEN_STRUCTURAL_GAPS = [
  {
    id: 'give_value_ratio',
    title: 'Eden gives value 50% of the time — the other 50% is selling or community',
    insight: 'Of Eden\'s 642 posts: 321 (50%) are give-value, 129 (20%) are soft-sell, 107 (17%) are community-building, 38 (6%) are social proof. The give-value ratio is his strategic moat — but it also means 50% of his content is not purely educational.',
    opportunity: 'A content mix tilted more heavily toward pure value (70%+ give-value) would be distinctive in the Hebrew AI space.',
  },
  {
    id: 'single_product',
    title: 'Everything points to Brainers Club — one product, one price point',
    insight: '60% of Eden\'s posts ultimately drive to Brainers Club at ₪49/month. He has no free tier below WhatsApp group and no structured upsell ladder above the club.',
    opportunity: 'A deliberate three-tier structure — free content → free community → low-cost membership → premium course → high-ticket consulting — would capture more value at each level.',
  },
  {
    id: 'linkedin_timing',
    title: 'Eden fires LinkedIn last — an opportunity to get there first',
    insight: 'Eden\'s consistent pattern is to hold LinkedIn until the end of a campaign, after he has social proof numbers from Facebook and Instagram.',
    opportunity: 'If JustCapable launches on LinkedIn first with original content — not repurposed Facebook posts — it can own the LinkedIn AI education space before Eden makes it a priority.',
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function ViewOpportunity({ posts, allPosts, competitor, aiSummary, onNavigate }) {
  const [panel, setPanel] = useState(null)
  const [activeSection, setActiveSection] = useState('channels')

  const isEden = competitor?.slug === 'eden_bibas'
  const name = competitor?.name ?? 'This competitor'

  // Determine gap data: Eden hardcoded, others from aiSummary, else empty
  const channelGaps = isEden
    ? EDEN_CHANNEL_GAPS
    : aiSummary?.opportunities?.channelGaps ?? []
  const topicGaps = isEden
    ? EDEN_TOPIC_GAPS
    : aiSummary?.opportunities?.topicGaps ?? []
  const structuralGaps = isEden
    ? EDEN_STRUCTURAL_GAPS
    : aiSummary?.opportunities?.structuralGaps ?? []

  const hasAI = !!aiSummary?.opportunities
  const postCount = (allPosts || posts || []).length

  const stats = useMemo(() => {
    if (!posts?.length) return null
    const ck = posts.filter(p => p.cta_method === 'COMMENT-KEYWORD')
    const ckAvg = mean(ck.map(p => cmts(p)))
    const ttAvg = mean(posts.filter(p => p.channel === 'tiktok').map(p => cmts(p)))
    const igAvg = mean(posts.filter(p => p.channel === 'instagram').map(p => cmts(p)))
    const pp = mean(posts.filter(p => p.hook_type === 'PAIN-POINT').map(p => cmts(p)))
    const newsAvg = mean(posts.filter(p => p.hook_type === 'NEWS-BREAK').map(p => cmts(p)))
    const hardSell = mean(posts.filter(p => p.intent === 'HARD-SELL').map(p => cmts(p)))
    const softSell = mean(posts.filter(p => p.intent === 'SOFT-SELL').map(p => cmts(p)))
    return { ckAvg, ttAvg, igAvg, pp, newsAvg, hardSell, softSell }
  }, [posts])

  const sections = [
    { id: 'channels', label: 'Channel Gaps' },
    { id: 'topics', label: 'Topic Gaps' },
    { id: 'structural', label: 'Structural Gaps' },
  ]

  // Placeholder for when we don't have data yet
  function NoDataCard() {
    return (
      <div style={{ padding: '28px 24px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 10, textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>⏳</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--tp)', marginBottom: 8 }}>Opportunity analysis not yet generated</div>
        <div style={{ fontSize: 14, color: 'var(--ts)', lineHeight: 1.6, maxWidth: 480, margin: '0 auto' }}>
          AI-generated gap analysis appears here once {name} has 50+ posts scraped.
          {postCount > 0 && postCount < 50 && ` Currently at ${postCount} posts — run more scrapes to unlock this view.`}
          {postCount >= 50 && !hasAI && ' Enough posts exist — the AI summary will be generated on the next scheduled scrape.'}
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--bd)', paddingBottom: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--tp)', marginBottom: 6 }}>Where {name} is weak</div>
        <div style={{ fontSize: 14, color: 'var(--ts)', lineHeight: 1.6 }}>
          {isEden
            ? `Everything in the dashboard so far tells you what Eden does well. This view is the opposite — where he's underinvesting, what he's not covering, and where JustCapable can compete effectively. All gaps are derived from the full ${(allPosts||posts||[]).length}-post dataset.`
            : hasAI
            ? `AI-generated gap analysis based on ${postCount} scraped posts. Generated ${new Date(aiSummary.generatedAt).toLocaleDateString()}.`
            : `Gap analysis is generated automatically after 50+ posts are scraped.`
          }
        </div>
      </div>

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 6 }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
            padding: '6px 16px', borderRadius: 6, fontSize: 13, fontWeight: 700,
            fontFamily: 'var(--mono)', cursor: 'pointer', transition: 'all 0.12s',
            background: activeSection === s.id ? 'var(--ac)' : 'var(--s2)',
            color: activeSection === s.id ? '#000' : 'var(--ts)',
            border: `1px solid ${activeSection === s.id ? 'var(--ac)' : 'var(--bd)'}`,
          }}>{s.label}</button>
        ))}
      </div>

      {/* Channel gaps */}
      {activeSection === 'channels' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--ts)', lineHeight: 1.6 }}>
            {name} is present on multiple channels but effort and results are unevenly distributed. These are the channels where they're underinvesting relative to the opportunity.
          </div>
          {channelGaps.length === 0
            ? <NoDataCard />
            : channelGaps.map(gap => (
              <GapCard key={gap.id} gap={gap} severity={gap.severity}
                evidence={isEden && gap.id === 'tiktok' ? [
                  { label: 'TikTok posts total', value: '13', sub: 'across 2+ years' },
                  { label: 'TikTok avg comments', value: stats?.ttAvg || 129, sub: 'per post' },
                  { label: 'Instagram avg comments', value: stats?.igAvg || 969, sub: 'per post — same audience' },
                ] : isEden && gap.id === 'linkedin_ck' ? [
                  { label: 'LinkedIn CK avg', value: '289', sub: 'comments (6 posts)' },
                  { label: 'LinkedIn baseline avg', value: '30', sub: 'comments (no CTA)' },
                  { label: 'Times used', value: '6 of 75', sub: 'LinkedIn posts' },
                ] : (gap.evidence || [])}
              />
            ))
          }
        </div>
      )}

      {/* Topic gaps */}
      {activeSection === 'topics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--ts)', lineHeight: 1.6 }}>
            Topics {name} hasn't covered, or hooks they rarely use despite evidence they work better than their defaults.
          </div>
          {topicGaps.length === 0
            ? <NoDataCard />
            : topicGaps.map(gap => (
              <GapCard key={gap.id} gap={gap} severity={gap.severity}
                evidence={isEden && gap.id === 'pain_point' ? [
                  { label: 'Pain-point posts', value: '1', sub: 'in entire dataset' },
                  { label: 'Pain-point avg', value: stats?.pp || 19600, sub: 'comments' },
                  { label: 'News-break avg', value: stats?.newsAvg || 156, sub: 'comments (118 posts)' },
                ] : isEden && gap.id === 'hard_sell_timing' ? [
                  { label: 'Hard-sell avg', value: stats?.hardSell || 12, sub: 'comments' },
                  { label: 'Soft-sell avg', value: stats?.softSell || 622, sub: 'comments' },
                  { label: 'Gap', value: '52×', sub: 'soft-sell outperforms' },
                ] : (gap.evidence || [])}
              />
            ))
          }
        </div>
      )}

      {/* Structural gaps */}
      {activeSection === 'structural' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--ts)', lineHeight: 1.6 }}>
            Strategic and structural patterns in {name}'s approach that create exploitable gaps.
          </div>
          {structuralGaps.length === 0
            ? <NoDataCard />
            : structuralGaps.map(gap => (
              <GapCard key={gap.id} gap={gap} severity="medium" evidence={[]} />
            ))
          }
        </div>
      )}

      {panel && <PostListPanel title={panel.title} posts={panel.posts} accentColor={panel.color||'var(--ac)'} onClose={() => setPanel(null)} />}
    </div>
  )
}

function GapCard({ gap, severity, evidence = [] }) {
  const [open, setOpen] = useState(false)
  const sevColor = severity === 'high' ? '#F43F5E' : severity === 'medium' ? '#FBBF24' : '#94A3B8'
  const sevLabel = severity === 'high' ? 'HIGH PRIORITY' : severity === 'medium' ? 'MEDIUM' : 'LOW'

  return (
    <div style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 10, borderLeft: `4px solid ${sevColor}`, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', textAlign: 'left', padding: '16px 18px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tp)' }}>{gap.title}</span>
            <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--mono)', padding: '2px 7px', borderRadius: 3, background: sevColor+'22', color: sevColor, border: `1px solid ${sevColor}44` }}>{sevLabel}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--ts)', lineHeight: 1.6 }}>{gap.insight}</div>
        </div>
        <span style={{ fontSize: 18, color: 'var(--tm)', flexShrink: 0, marginTop: 2 }}>{open ? '↑' : '↓'}</span>
      </button>

      {evidence.length > 0 && (
        <div style={{ display: 'flex', gap: 1, borderTop: '1px solid var(--bd)', borderBottom: open ? '1px solid var(--bd)' : 'none' }}>
          {evidence.map((e, i) => (
            <div key={i} style={{ flex: 1, padding: '10px 14px', background: 'var(--s3)', borderRight: i < evidence.length - 1 ? '1px solid var(--bd)' : 'none' }}>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--mono)', color: sevColor }}>{typeof e.value === 'number' ? e.value.toLocaleString() : e.value}</div>
              <div style={{ fontSize: 11, color: 'var(--ts)', fontFamily: 'var(--mono)' }}>{e.label}</div>
              {e.sub && <div style={{ fontSize: 11, color: 'var(--tm)' }}>{e.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {open && (gap.opportunity || gap.how) && (
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {gap.opportunity && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--mono)', letterSpacing: '0.08em', color: 'var(--ac)', marginBottom: 6, textTransform: 'uppercase' }}>The opportunity</div>
              <div style={{ fontSize: 14, color: 'var(--tp)', lineHeight: 1.7 }}>{gap.opportunity}</div>
            </div>
          )}
          {gap.how && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--mono)', letterSpacing: '0.08em', color: 'var(--ts)', marginBottom: 6, textTransform: 'uppercase' }}>How to act on it</div>
              <div style={{ fontSize: 14, color: 'var(--ts)', lineHeight: 1.7 }}>{gap.how}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
