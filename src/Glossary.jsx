import { useState } from 'react'

export const HOOK_GLOSSARY = {
  'NEWS-BREAK': {
    label: 'News Break',
    desc: 'Opens by reacting to a recent AI news event or product launch. Positions the creator as the translator — explaining what the news means for their audience before anyone else does. Works best when posted the same day as the news. Loses impact after 48-72 hours.',
    avg: 156, n: 118,
  },
  'CURIOSITY-GAP': {
    label: 'Curiosity Gap',
    desc: 'Withholds the key information in the opening line, forcing the reader to keep going to find out. Often paired with comment-to-DM automation — the answer arrives via DM after the reader comments a keyword. The hook creates the question; the CTA captures the person who wants the answer.',
    avg: 212, n: 78,
  },
  'PERSONAL-STORY': {
    label: 'Personal Story',
    desc: "Opens with a personal moment or narrative to build warmth and relatability. One of the lower performers by avg comments. Used primarily between campaigns to maintain a human presence rather than drive conversions.",
    avg: 114, n: 77,
  },
  'SHOCK': {
    label: 'Shock',
    desc: "Opens with a provocative, surprising, or alarming claim designed to stop the scroll. Creates reach and shares but doesn't drive lead capture on its own. Best for news-reaction content at the top of campaigns.",
    avg: 220, n: 77,
  },
  'FOMO': {
    label: 'FOMO',
    desc: "Makes inaction feel costly — framing the audience's non-adoption of a tool or skill as falling behind peers who are already ahead. One of the strongest performers, especially on Instagram and LinkedIn.",
    avg: 421, n: 45,
  },
  'AUTHORITY': {
    label: 'Authority',
    desc: "Leads with a credibility signal before making any claim — number of students trained, conference appearances, media mentions. Establishes why the reader should trust what follows. Works best on new audiences.",
    avg: 247, n: 38,
  },
  'NUMBER-LISTICLE': {
    label: 'Number Listicle',
    desc: "Promises a specific, bounded deliverable upfront: \"5 tools,\" \"3 mistakes,\" \"7 ways.\" Tells the reader exactly what they're getting before they commit to reading. Pairs naturally with comment-to-DM.",
    avg: 467, n: 36,
  },
  'QUESTION': {
    label: 'Question',
    desc: "Opens with a direct question to the reader. Creates engagement by making the reader self-assess. Mid-range performer — effective for community posts where discussion is the goal rather than lead capture.",
    avg: 156, n: 35,
  },
  'CONTRARIAN': {
    label: 'Contrarian',
    desc: "Challenges a widely-held belief or common practice. Creates discussion and shares but lower average engagement than FOMO or listicle hooks. Used for thought leadership rather than conversion.",
    avg: 111, n: 27,
  },
  'SOCIAL-PROOF': {
    label: 'Social Proof',
    desc: "Leads with evidence of scale or results — member counts, registration numbers, student outcomes, testimonials. Validates the offer before explaining it.",
    avg: 76, n: 24,
  },
  'VALUE-OFFER': {
    label: 'Value Offer',
    desc: "Opens by stating the free thing being offered upfront. Reduces friction because the reader knows immediately what they're getting. Strong performer — used most in campaign launch posts.",
    avg: 384, n: 13,
  },
  'CHALLENGE': {
    label: 'Challenge',
    desc: "Invites the audience to participate in or join a challenge. Creates community participation and accountability. Strong performer despite low usage.",
    avg: 408, n: 5,
  },
  'HOW-TO': {
    label: 'How-To',
    desc: "Straightforward instructional opening. Low average engagement compared to other hooks — tells the reader too much upfront, reducing the incentive to comment or click.",
    avg: 30, n: 16,
  },
  'NOVELTY': {
    label: 'Novelty',
    desc: "Leads with the newness of something. Low performer. Novelty alone doesn't motivate action — the reader needs to understand why the new thing matters to them.",
    avg: 16, n: 12,
  },
  'HUMOR': {
    label: 'Humor',
    desc: "Opens with something funny or absurd. Low conversion hook — humor creates warmth and shares but doesn't drive lead capture. Useful for maintaining a human presence between campaigns.",
    avg: 75, n: 5,
  },
  'CULTURAL-MOMENT': {
    label: 'Cultural Moment',
    desc: "Ties the post to a cultural event, holiday, or shared moment. Creates emotional resonance and relevance. Used to time offers or demonstrate community solidarity.",
    avg: 32, n: 6,
  },
  'PAIN-POINT': {
    label: 'Pain Point',
    desc: "Opens by naming a specific problem the audience experiences. Leads directly with the reader's frustration before offering a solution. Can produce extraordinary engagement when the pain is sharply named.",
    avg: 19600, n: 1,
  },
  'CTA-HOOK': {
    label: 'CTA Hook',
    desc: "The hook itself is the call to action — \"comment X to get Y,\" \"share this to unlock.\" The opening line and the mechanic are the same thing. Works best when the offer is strong enough to lead with.",
    avg: 244, n: 3,
  },
}

export const INTENT_GLOSSARY = {
  'GIVE-VALUE': {
    label: 'Give Value',
    desc: "Free tutorials, tool breakdowns, tips, AI news explanations. No offer attached. The most common intent in high-performing accounts. Rule of thumb: at least 2 give-value posts for every sell post.",
    avg: 146, n: 319,
  },
  'SOFT-SELL': {
    label: 'Soft Sell',
    desc: "Makes an offer but frames it around value rather than urgency. The product is mentioned, the benefit is explained, but there's no deadline pressure. Highest-performing intent by avg comments.",
    avg: 622, n: 129,
  },
  'COMMUNITY-BUILDING': {
    label: 'Community Building',
    desc: "Posts designed to create participation, discussion, or belonging — questions, challenges, milestone celebrations. No direct offer. Keeps the community active and engaged between campaigns.",
    avg: 126, n: 107,
  },
  'SOCIAL-PROOF': {
    label: 'Social Proof',
    desc: "Showcases results, numbers, testimonials, or milestones. Used mid-campaign to validate the offer after the launch announcement.",
    avg: 77, n: 38,
  },
  'AUTHORITY': {
    label: 'Authority',
    desc: "Establishes credibility — conference talks, media appearances, expert positioning. No direct offer. Used to build the professional reputation that makes future offers more credible.",
    avg: 93, n: 18,
  },
  'WARM-UP': {
    label: 'Warm Up',
    desc: "Teaser content before a campaign launches. Builds anticipation without revealing the full offer. Creates curiosity and primes the audience to pay attention when the actual announcement arrives.",
    avg: 80, n: 16,
  },
  'HARD-SELL': {
    label: 'Hard Sell',
    desc: "Direct sales content with urgency, deadlines, and explicit price/offer details. Worst-performing intent by a wide margin — 52× below soft-sell in Eden's data. Use sparingly and only after multiple value and soft-sell posts.",
    avg: 12, n: 12,
  },
  'URGENCY': {
    label: 'Urgency',
    desc: "Last-chance posts — deadlines, closing windows, limited spots. Used in the final 1-2 days of a campaign. Short, direct, no new information — just the deadline and the link.",
    avg: 21, n: 1,
  },
}

export const CTA_GLOSSARY = {
  'COMMENT-KEYWORD': {
    label: 'Comment Keyword',
    desc: "Asks people to comment a specific word. Automation detects the comment and sends the commenter a DM with a link. Every comment is simultaneously a lead captured and an engagement signal to the algorithm. Average: 1,442 comments per post in Eden's data — 16× his non-CK posts.",
    avg: 1442, n: 66,
  },
  'COMMENT-TO-RECEIVE': {
    label: 'Comment to Receive',
    desc: "Asks people to comment anything — \"comment YES,\" \"comment and I'll send you the link\" — then replies manually with the link. Each reply signals engagement to the platform. Gets 258 avg comments on FB Personal vs 28 for posts with the link in the caption.",
    avg: 258, n: 85,
  },
  'LINK-IN-COMMENT': {
    label: 'Link in Comment',
    desc: "Puts the outbound link in the first comment instead of the post caption. Facebook reduces the reach of posts with external links in the caption — this is a standard workaround.",
    avg: 28, n: 111,
  },
  'LINK-IN-POST': {
    label: 'Link in Post',
    desc: "Direct link in the post caption. Used on channels where link penalties don't apply — WhatsApp, Email — or when the goal is direct conversion rather than engagement volume.",
    avg: 0, n: 0,
  },
  'ENGAGEMENT-QUESTION': {
    label: 'Engagement Question',
    desc: "Ends with a question to drive comments but no link or offer. Pure community post. Keeps channels active and generates discussion without making an ask.",
    avg: 0, n: 0,
  },
  'NONE': {
    label: 'No CTA',
    desc: "No call to action at all. Used for news-reaction posts, authority content, and personal stories where the goal is reach and brand presence rather than immediate lead capture.",
    avg: 0, n: 0,
  },
  'SHARE-CTA': {
    label: 'Share CTA',
    desc: "Asks people to share the post. Used for community-growth content where the goal is reaching new audiences rather than converting existing followers.",
    avg: 0, n: 0,
  },
  'WHATSAPP-JOIN': {
    label: 'WhatsApp Join',
    desc: "Direct link to join a free WhatsApp group. The middle funnel step — lower friction than a paid offer, higher commitment than just liking a post.",
    avg: 0, n: 0,
  },
  'DM-AUTOMATION': {
    label: 'DM Automation',
    desc: "Variant of comment-to-DM. The specific automation trigger may differ from a keyword — e.g. any comment, a reaction, or a specific phrase.",
    avg: 0, n: 0,
  },
}

export function glossaryLookup(fieldType, value) {
  if (fieldType === 'hook_type') return HOOK_GLOSSARY[value]
  if (fieldType === 'intent') return INTENT_GLOSSARY[value]
  if (fieldType === 'cta_method') return CTA_GLOSSARY[value]
  return null
}

export function GlossaryTip({ fieldType, value, children }) {
  const [show, setShow] = useState(false)
  const entry = glossaryLookup(fieldType, value)
  if (!entry) return <>{children}</>
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      {children}
      <button
        onClick={e => { e.stopPropagation(); setShow(s => !s) }}
        style={{ marginLeft: 4, width: 14, height: 14, borderRadius: '50%', background: 'var(--bd2)', border: 'none', cursor: 'pointer', fontSize: 9, color: 'var(--tm)', fontWeight: 700, lineHeight: '14px', textAlign: 'center', verticalAlign: 'middle', flexShrink: 0 }}>
        ?
      </button>
      {show && (
        <div
          onClick={e => e.stopPropagation()}
          style={{ position: 'absolute', top: 22, left: 0, zIndex: 200, width: 280, background: 'var(--s3)', border: '1px solid var(--bd)', borderRadius: 8, padding: '12px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--tp)', fontFamily: 'var(--mono)' }}>{entry.label}</span>
            {entry.avg > 0 && entry.n > 0 && (
              <span style={{ fontSize: 10, color: 'var(--ts)', fontFamily: 'var(--mono)' }}>{entry.avg} avg cmts · {entry.n} posts</span>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--ts)', lineHeight: 1.65, margin: 0 }}>{entry.desc}</p>
          <button onClick={() => setShow(false)} style={{ marginTop: 10, fontSize: 11, color: 'var(--tm)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>close ×</button>
        </div>
      )}
    </span>
  )
}
