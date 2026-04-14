/**
 * insights.js — Centralized insight engine for JustCapable CI Dashboard
 *
 * Every insight follows one structure:
 *   stat:    The specific number from the data
 *   why:     What that number reveals about what the competitor is actually doing
 *   action:  What JustCapable should consider doing — clearly labelled as a recommendation
 *   type:    'opportunity' | 'warning' | 'pattern' | 'signal'
 *
 * Benchmarks derived from Eden Bibas 642-post dataset, March 2026.
 * For other competitors, generic insights are generated from live post data.
 */

export const BENCHMARKS = {
  dataset_avg_comments: 229,
  dataset_median_comments: 29,
  ck_avg: 1442,
  ck_lift: 16.2,
  non_ck_avg: 89,
  ig_ck_avg: 2237,
  ig_non_ck_avg: 123,
  ig_ck_lift: 18.2,
  linkedin_ck_avg: 289,
  linkedin_none_avg: 30,
  channel: {
    instagram:   { avg: 969,  posts: 100, followers: 68400  },
    fb_group:    { avg: 118,  posts: 275, followers: 192800 },
    tiktok:      { avg: 129,  posts: 13,  followers: 24100  },
    fb_personal: { avg: 110,  posts: 104, followers: 38000  },
    linkedin:    { avg: 47,   posts: 75,  followers: 31061  },
    youtube:     { avg: 18,   posts: 23,  followers: 7500   },
    threads:     { avg: 1,    posts: 24,  followers: 4100   },
    whatsapp:    { avg: 0,    posts: 11,  followers: 984    },
    email:       { avg: 0,    posts: 15,  followers: null   },
  },
  best_cta_per_channel: {
    instagram:   { cta: 'COMMENT-KEYWORD',    avg: 2237, n: 40 },
    fb_personal: { cta: 'COMMENT-TO-RECEIVE', avg: 258,  n: 18 },
    linkedin:    { cta: 'COMMENT-KEYWORD',    avg: 289,  n: 6  },
    fb_group:    { cta: 'LINK-IN-POST',       avg: 821,  n: 6  },
    tiktok:      { cta: 'COMMENT-KEYWORD',    avg: 122,  n: 3  },
  },
  best_hook_per_channel: {
    instagram:   { hook: 'FOMO',            avg: 1675, n: 6,  runnerUp: { hook: 'NUMBER-LISTICLE', avg: 1525, n: 4 } },
    fb_personal: { hook: 'NUMBER-LISTICLE', avg: 276,  n: 9,  runnerUp: { hook: 'FOMO',            avg: 252,  n: 14 } },
    linkedin:    { hook: 'FOMO',            avg: 491,  n: 3,  runnerUp: { hook: 'SOCIAL-PROOF',     avg: 41,   n: 4  } },
    fb_group:    { hook: 'CHALLENGE',       avg: 680,  n: 3,  runnerUp: { hook: 'VALUE-OFFER',      avg: 384,  n: 4  } },
    tiktok:      { hook: 'NEWS-BREAK',      avg: 123,  n: 3,  runnerUp: { hook: 'CURIOSITY-GAP',    avg: 120,  n: 3  } },
  },
  intent: {
    'SOFT-SELL':          { avg: 622, n: 129 },
    'GIVE-VALUE':         { avg: 146, n: 319 },
    'COMMUNITY-BUILDING': { avg: 126, n: 107 },
    'AUTHORITY':          { avg: 93,  n: 18  },
    'WARM-UP':            { avg: 80,  n: 16  },
    'SOCIAL-PROOF':       { avg: 77,  n: 38  },
    'HARD-SELL':          { avg: 12,  n: 12  },
  },
}

export function avgN(arr) {
  if (!arr || !arr.length) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

function pct(n, total) {
  return total ? Math.round(n / total * 100) : 0
}

function round1(n) { return Math.round(n * 10) / 10 }

// ─── Channel Insights ────────────────────────────────────────────────────────

export function getChannelInsight(channelKey, allPosts) {
  const posts = allPosts.filter(p => p.channel === channelKey)
  if (!posts.length) return null

  const bench   = BENCHMARKS.channel[channelKey]
  const bestCta = BENCHMARKS.best_cta_per_channel[channelKey]
  const bestHook= BENCHMARKS.best_hook_per_channel[channelKey]
  const myAvg   = Math.round(avgN(posts.map(p => p.comments_n)))
  const dAvg    = BENCHMARKS.dataset_avg_comments

  if (channelKey === 'instagram') {
    const ckPosts = posts.filter(p => p.cta_method === 'COMMENT-KEYWORD')
    const ckShare = pct(ckPosts.length, posts.length)
    return {
      type: 'opportunity',
      stat: `Instagram COMMENT-KEYWORD posts: ${BENCHMARKS.ig_ck_avg.toLocaleString()} avg comments. Non-COMMENT-KEYWORD: ${BENCHMARKS.ig_non_ck_avg}. Used on ${ckShare}% of Instagram posts.`,
      why: `Instagram is the highest-engagement channel (${bench?.avg?.toLocaleString() ?? myAvg} avg comments). Almost all of that gap comes from posts where people comment a specific word — automation sends them a DM with a link. Without that mechanic, Instagram posts average only ${BENCHMARKS.ig_non_ck_avg} comments.`,
      action: `Recommendation: before your first Instagram post, set up comment-to-DM automation (ManyChat). The strongest hook on Instagram is FOMO${bestHook ? ` (avg ${bestHook.avg.toLocaleString()} comments, ${bestHook.n} posts), followed by numbered lists (avg ${bestHook.runnerUp.avg.toLocaleString()})` : ''}.`,
      topPost: [...posts].sort((a, b) => b.comments_n - a.comments_n)[0],
    }
  }

  if (channelKey === 'fb_personal') {
    const lic    = posts.filter(p => p.cta_method === 'LINK-IN-COMMENT')
    const licPct = pct(lic.length, posts.length)
    const ctr    = posts.filter(p => p.cta_method === 'COMMENT-TO-RECEIVE')
    const ctrAvg = ctr.length ? Math.round(avgN(ctr.map(p => p.comments_n))) : 0
    const licAvg = lic.length ? Math.round(avgN(lic.map(p => p.comments_n))) : 0
    return {
      type: 'pattern',
      stat: `FB Personal: ${licPct}% of posts put the link in the first comment. Posts asking people to comment and receive a link average ${ctrAvg} comments vs ${licAvg} for posts with the link in the first comment.`,
      why: `Facebook shows posts with external links in the caption to fewer people, so links go in the first comment instead. The highest-performing tactic is asking people to "comment and I'll send you the link" — this generates far more comments than putting the link in the first comment.`,
      action: `Recommendation: on Facebook, never put outbound links in the caption. For important content, ask people to comment and reply to them with the link.`,
      topPost: [...posts].sort((a, b) => b.comments_n - a.comments_n)[0],
    }
  }

  if (channelKey === 'linkedin') {
    const ckPosts = posts.filter(p => p.cta_method === 'COMMENT-KEYWORD')
    const ckShare = pct(ckPosts.length, posts.length)
    return {
      type: 'opportunity',
      stat: `LinkedIn COMMENT-KEYWORD posts: ${BENCHMARKS.linkedin_ck_avg} avg comments vs ${BENCHMARKS.linkedin_none_avg} with no CTA. Used on only ${ckShare}% of LinkedIn posts (${ckPosts.length} of ${posts.length}).`,
      why: `Comment-to-DM automation on LinkedIn produces ~10× the engagement of posts without it, but it's rarely used. LinkedIn also works best when fired later in a campaign — after engagement numbers from other channels exist to reference.`,
      action: `Recommendation: use comment-to-DM automation on LinkedIn more consistently. Post LinkedIn content later in a campaign, after you have real numbers to mention.`,
      topPost: [...posts].sort((a, b) => b.comments_n - a.comments_n)[0],
    }
  }

  if (channelKey === 'fb_group') {
    const softSell = posts.filter(p => p.intent === 'SOFT-SELL')
    const softAvg  = softSell.length ? Math.round(avgN(softSell.map(p => p.comments_n))) : 0
    return {
      type: 'pattern',
      stat: `FB Group: SOFT-SELL posts average ${softAvg} comments (${softSell.length} posts).`,
      why: `Large Facebook Groups work primarily for community and announcements, not closing sales. The best hook is CHALLENGE — posts that invite people to comment and receive something.`,
      action: `Recommendation: use FB Group for community and value posts. Open campaigns by announcing them here first before firing other channels.`,
      topPost: [...posts].sort((a, b) => b.comments_n - a.comments_n)[0],
    }
  }

  if (channelKey === 'tiktok') {
    return {
      type: 'opportunity',
      stat: `TikTok: ${posts.length} posts, ${myAvg} avg comments/post.`,
      why: `TikTok's algorithm surfaces content to people who don't follow you — higher ceiling for new audience discovery. But it requires consistent posting to compound.`,
      action: `Recommendation: if consistently posted (3-5x/week), TikTok has no ceiling for new audience growth. The strongest hook is NEWS-BREAK for this content type.`,
      topPost: [...posts].sort((a, b) => b.comments_n - a.comments_n)[0],
    }
  }

  if (channelKey === 'threads') {
    return {
      type: 'warning',
      stat: `Threads: ${posts.length} posts, ${myAvg} avg comments.`,
      why: `Threads has produced near-zero engagement in most Hebrew AI content accounts.`,
      action: `Recommendation: don't invest in Threads. Low ROI for this content type and language.`,
      topPost: null,
    }
  }

  if (channelKey === 'youtube') {
    return {
      type: 'warning',
      stat: `YouTube: ${posts.length} posts, ${myAvg} avg comments/post.`,
      why: `YouTube audiences consume without engaging the way Facebook/Instagram audiences do. Comments are low but video views may be high.`,
      action: `Recommendation: treat YouTube as a long-form reference resource rather than a channel to drive immediate responses.`,
      topPost: [...posts].sort((a, b) => b.comments_n - a.comments_n)[0],
    }
  }

  if (channelKey === 'whatsapp') {
    return {
      type: 'signal',
      stat: `WhatsApp: ${posts.length} posts tracked. No public engagement data.`,
      why: `WhatsApp shows no public engagement but is used to send direct links to the warmest audience. Posts here go out before or alongside public posts.`,
      action: `Recommendation: build a WhatsApp subscriber list before you need it. Use it to give your most engaged followers early access before public announcements.`,
      topPost: null,
    }
  }

  if (channelKey === 'email') {
    return {
      type: 'signal',
      stat: `Email: ${posts.length} posts tracked. No public engagement data.`,
      why: `Email is used as a direct-link channel during campaigns. Metrics are private. Typical pattern: email 1 delivers value, email 2 makes the offer, email 3 delivers more value with the offer mentioned again.`,
      action: `Recommendation: treat email and WhatsApp as paired direct channels. Never hard-sell twice in a row.`,
      topPost: null,
    }
  }

  // Generic fallback
  return {
    type: 'pattern',
    stat: `${channelKey}: ${myAvg} avg comments/post (${myAvg > dAvg ? 'above' : 'below'} dataset avg of ${dAvg}).`,
    why: `${posts.length} posts analysed for this channel.`,
    action: `Review the CTA and hook breakdown for this channel to identify what's driving or limiting performance.`,
    topPost: [...posts].sort((a, b) => b.comments_n - a.comments_n)[0],
  }
}

// ─── Hook Insights ────────────────────────────────────────────────────────────

export function getHookInsight(hookType, allPosts) {
  const posts  = allPosts.filter(p => p.hook_type === hookType)
  const others = allPosts.filter(p => p.hook_type !== hookType)
  if (!posts.length) return null

  const myAvg  = Math.round(avgN(posts.map(p => p.comments_n)))
  const othAvg = Math.round(avgN(others.map(p => p.comments_n)))
  const lift   = othAvg > 0 ? round1(myAvg / othAvg) : null

  const byCh = {}
  posts.forEach(p => { if (!byCh[p.channel]) byCh[p.channel] = []; byCh[p.channel].push(p.comments_n) })
  const chRanked = Object.entries(byCh)
    .filter(([, arr]) => arr.length >= 2)
    .map(([ch, arr]) => ({ ch, avg: Math.round(avgN(arr)), n: arr.length }))
    .sort((a, b) => b.avg - a.avg)
  const bestCh = chRanked[0]

  const HOOK_WHY = {
    'FOMO':            "frames the audience's inaction as a cost — people who aren't using this tool are already falling behind",
    'NUMBER-LISTICLE': "promises a specific, bounded list upfront — pairs naturally with comment-to-DM because the list arrives via automated DM",
    'SHOCK':           "a provocative opening claim designed to stop the scroll before anything else is read",
    'CURIOSITY-GAP':   "the opening withholds the answer, forcing the reader to comment or keep reading to get it",
    'NEWS-BREAK':      "reacts fast to relevant news and frames it for the audience — urgency with built-in relevance",
    'PERSONAL-STORY':  "opens with a personal moment — builds warmth and trust before any ask appears",
    'AUTHORITY':       "leads with results, student counts, or press — earns the right to make an offer",
    'SOCIAL-PROOF':    "opens with scale evidence — registrant numbers, member counts, testimonials",
    'QUESTION':        "asks the audience something directly, triggering reflexive engagement",
    'CONTRARIAN':      "challenges a belief the audience holds — provokes a reaction by disagreeing with conventional wisdom",
    'PAIN-POINT':      "names a cost or frustration the audience is already feeling — they immediately recognise themselves",
    'HOW-TO':          "promises a practical, step-by-step payoff — clear value before the reader has to do anything",
    'VALUE-OFFER':     "leads with a free deliverable — the reader knows exactly what they're getting before engaging",
  }

  const why = HOOK_WHY[hookType] || `used in ${posts.length} posts`
  const perfLabel = !lift ? '' : lift >= 1.5 ? 'strong performer' : lift >= 0.8 ? 'average performer' : 'underperformer'

  return {
    type: lift >= 1.5 ? 'opportunity' : lift < 0.7 ? 'warning' : 'pattern',
    stat: `${hookType}: ${myAvg} avg comments across ${posts.length} posts${lift ? ' (' + lift + '× vs other hooks)' : ''}.`,
    why: bestCh
      ? `${why}. Performs best on ${bestCh.ch} (avg ${bestCh.avg} comments, ${bestCh.n} posts). ${perfLabel ? 'A ' + perfLabel + '.' : ''}`
      : `${why}. ${perfLabel ? 'A ' + perfLabel + '.' : ''}`,
    action: bestCh
      ? `Recommendation: ${lift >= 1.5 ? 'use this hook in campaign opening posts, particularly on ' + bestCh.ch + '.' : lift < 0.7 ? 'results are below average — test carefully before committing.' : 'combine with a strong CTA to improve engagement.'}`
      : `Not enough data to recommend a specific channel — test on 2–3 channels before committing.`,
    topPost: [...posts].sort((a, b) => b.comments_n - a.comments_n)[0],
  }
}

// ─── CTA Insights ─────────────────────────────────────────────────────────────

export function getCTAInsight(ctaMethod, allPosts) {
  const posts  = allPosts.filter(p => p.cta_method === ctaMethod)
  const others = allPosts.filter(p => p.cta_method !== ctaMethod && p.cta_method !== 'NONE')
  if (!posts.length) return null

  const myAvg  = Math.round(avgN(posts.map(p => p.comments_n)))
  const othAvg = Math.round(avgN(others.map(p => p.comments_n)))

  if (ctaMethod === 'COMMENT-KEYWORD') {
    return {
      type: 'opportunity',
      stat: `COMMENT-KEYWORD: ${myAvg.toLocaleString()} avg comments across ${posts.length} posts — ${BENCHMARKS.ck_lift}× the ${BENCHMARKS.non_ck_avg}-comment average of all other CTAs.`,
      why: `When people comment a specific word, automation sends them a DM with a link. Every commenter becomes a contact, and each comment increases the post's engagement count — which platforms show to more people.`,
      action: `Recommendation: set up comment-to-DM automation before using this mechanic. Use a different keyword per campaign to track which campaign a lead came from.`,
      topPost: [...posts].sort((a, b) => b.comments_n - a.comments_n)[0],
    }
  }

  if (ctaMethod === 'LINK-IN-COMMENT') {
    return {
      type: 'pattern',
      stat: `LINK-IN-COMMENT: ${myAvg} avg comments across ${posts.length} posts.`,
      why: `Facebook shows posts with outbound links in the caption to fewer people, so the link goes in the first comment instead. This is a structural workaround for Facebook, not a strategic preference.`,
      action: `Recommendation: on any Facebook post with an outbound link, put it in the first comment, not the caption.`,
      topPost: [...posts].sort((a, b) => b.comments_n - a.comments_n)[0],
    }
  }

  if (ctaMethod === 'COMMENT-TO-RECEIVE') {
    return {
      type: 'opportunity',
      stat: `COMMENT-TO-RECEIVE: ${myAvg} avg comments across ${posts.length} posts.`,
      why: `Asking people to "comment and I'll send you the link" generates more comments than putting a link in the first comment because each reply counts as engagement and people who comment are self-selecting as genuinely interested.`,
      action: `Recommendation: use this on Facebook and LinkedIn where automated comment-to-DM isn't set up. Reply within an hour — slow replies reduce the engagement benefit.`,
      topPost: [...posts].sort((a, b) => b.comments_n - a.comments_n)[0],
    }
  }

  if (ctaMethod === 'NONE') {
    return {
      type: 'pattern',
      stat: `Posts with no CTA: ${myAvg} avg comments across ${posts.length} posts.`,
      why: `Posts with no CTA are used for brand-building and news-reaction posts where the goal is reach and awareness, not lead capture.`,
      action: `Recommendation: every post meant to capture leads should have a CTA. CTA-free posts make sense for social proof moments or news reactions only.`,
      topPost: [...posts].sort((a, b) => b.comments_n - a.comments_n)[0],
    }
  }

  const lift = othAvg > 0 ? round1(myAvg / othAvg) : null
  return {
    type: lift > 1.3 ? 'opportunity' : lift < 0.7 ? 'warning' : 'pattern',
    stat: `${ctaMethod}: ${myAvg} avg comments across ${posts.length} posts${lift ? ' (' + lift + '× vs other CTAs)' : ''}.`,
    why: lift > 1.3 ? 'Above-average result for this CTA.' : lift < 0.7 ? 'Below-average result — used for specific functional reasons, not for engagement volume.' : 'Mid-range result.',
    action: lift > 1.3 ? `Recommendation: this CTA performs well. Look at which channels it's used on most before deploying.` : `Recommendation: combine with a strong hook to improve performance.`,
    topPost: [...posts].sort((a, b) => b.comments_n - a.comments_n)[0],
  }
}

// ─── Campaign Brief Insights ──────────────────────────────────────────────────

export function getCampaignBriefInsights(campaign, allPosts) {
  if (!campaign || !campaign.posts) return []
  const posts = campaign.posts
  const total = posts.length
  if (!total) return []

  const myAvg    = Math.round(avgN(posts.map(p => p.comments_n)))
  const globalAvg = Math.round(avgN((allPosts || posts).map(p => p.comments_n)))
  const diffPct  = Math.round(Math.abs(myAvg - globalAvg) / (globalAvg || 1) * 100)
  const aboveAvg = myAvg > globalAvg

  const chCounts = {}
  posts.forEach(p => { chCounts[p.channel] = (chCounts[p.channel] || 0) + 1 })
  const topCh = Object.entries(chCounts).sort((a, b) => b[1] - a[1])[0]

  const ckCount  = posts.filter(p => p.cta_method === 'COMMENT-KEYWORD').length
  const hardSell = posts.filter(p => p.intent === 'HARD-SELL').length
  const hardPct  = pct(hardSell, total)
  const gvCount  = posts.filter(p => p.intent === 'GIVE-VALUE').length
  const gvPct    = pct(gvCount, total)
  const sellCount= posts.filter(p => p.intent === 'SOFT-SELL' || p.intent === 'HARD-SELL').length

  const byDate = {}
  posts.forEach(p => {
    if (p.date_normalized) {
      if (!byDate[p.date_normalized]) byDate[p.date_normalized] = new Set()
      byDate[p.date_normalized].add(p.channel)
    }
  })
  const blastDay = Object.entries(byDate).filter(([, chs]) => chs.size >= 3).sort((a, b) => b[1].size - a[1].size)[0]

  const insights = []

  if (myAvg > 0) {
    insights.push({
      emoji: '📊', color: aboveAvg ? '#34D399' : '#F97316',
      stat: `${myAvg} avg comments/post across ${total} posts`,
      why: aboveAvg ? `${diffPct}% above the ${globalAvg}-comment dataset average.` : `${diffPct}% below the ${globalAvg}-comment dataset average.`,
      action: aboveAvg ? `Study the hook and CTA combination from this campaign — it outperformed the baseline.` : `Identify what drove performance down. Was it hard-sell content, weak hooks, or a channel mismatch?`,
    })
  }

  if (total >= 4 && hardPct > 30) {
    insights.push({
      emoji: '⚠️', color: '#F43F5E',
      stat: `${hardPct}% hard-sell posts in this campaign`,
      why: `Hard-sell is the worst-performing intent — averages 12 comments vs 622 for soft-sell (52× gap). This campaign has an unusually high hard-sell share.`,
      action: `Keep hard-sell content to the final 1–2 posts of a campaign, after giving value and building trust first.`,
    })
  } else if (total >= 4 && gvPct >= 50) {
    insights.push({
      emoji: '🎁', color: '#34D399',
      stat: `${gvPct}% give-value posts before the sell`,
      why: `Best-performing campaigns warm the audience with value content before making any offer. This campaign follows that pattern.`,
      action: `Maintain this ratio — for every sell post, publish at least 2 value posts first.`,
    })
  }

  if (ckCount > 0) {
    insights.push({
      emoji: '🔔', color: '#FBBF24',
      stat: `${ckCount} post${ckCount > 1 ? 's' : ''} used comment-to-DM`,
      why: `Each comment-to-DM post automatically sends the commenter a link via DM, filling the contact pipeline while the campaign was active.`,
      action: `Include at least 2–3 comment-to-DM posts per campaign. Use a different keyword per campaign to track lead sources.`,
    })
  } else if (total >= 5) {
    insights.push({
      emoji: '💡', color: '#94A3B8',
      stat: `No comment-to-DM posts in this campaign`,
      why: `This campaign ran ${total} posts without any automated DM capture.`,
      action: `Any campaign with 5+ posts should include at least 1 comment-to-DM post to capture contacts.`,
    })
  }

  if (blastDay) {
    const chList = [...blastDay[1]].join(', ')
    insights.push({
      emoji: '🚀', color: '#F43F5E',
      stat: `${blastDay[1].size} channels posted on the same day: ${blastDay[0]}`,
      why: `Publishing on multiple channels simultaneously on launch day ensures the audience sees the announcement regardless of which platform they use.`,
      action: `Prepare posts for multiple channels in advance and post them within a short window on launch day.`,
    })
  }

  if (topCh) {
    insights.push({
      emoji: '📡', color: '#38BDF8',
      stat: `${topCh[0].replace(/_/g, ' ')} was the primary channel — ${topCh[1]} of ${total} posts (${pct(topCh[1], total)}%)`,
      why: `This channel carried the most campaign posts.`,
      action: `Consider whether a higher-engagement channel could have carried more of the campaign load.`,
    })
  }

  return insights.filter(Boolean).slice(0, 5)
}

// ─── Pulse Signals ────────────────────────────────────────────────────────────

export function getPulseSignals(windowPosts, priorPosts, days) {
  if (!windowPosts.length) return []
  const signals = []

  const volNow   = windowPosts.length
  const volPrior = priorPosts.length
  const enoughToCompare = volNow >= 5 && volPrior >= 3

  if (enoughToCompare) {
    const pctChange = Math.round(((volNow - volPrior) / volPrior) * 100)
    if (Math.abs(pctChange) >= 20) {
      const up = pctChange > 0
      signals.push({
        emoji: up ? '📈' : '📉', type: up ? 'up' : 'down',
        stat: `Post volume ${up ? 'up' : 'down'} ${Math.abs(pctChange)}% (${volNow} posts this period vs ${volPrior} prior)`,
        why: up ? `Volume spikes almost always accompany or precede a campaign.` : `A drop in posting volume usually means the competitor is between campaigns.`,
        action: up ? `Watch which channels are driving the volume increase.` : `If they've gone quiet, their audience is still there but not being sent anywhere in particular.`,
      })
    }
  }

  const ckNow   = windowPosts.filter(p => p.cta_method === 'COMMENT-KEYWORD').length
  const ckPrior = priorPosts.filter(p => p.cta_method === 'COMMENT-KEYWORD').length
  if (volNow >= 5) {
    if (ckNow > 0 && ckPrior === 0 && volPrior >= 3) {
      signals.push({
        emoji: '🔔', type: 'up',
        stat: `Comment-to-DM posts restarted — ${ckNow} this period after none in the prior period`,
        why: `Using comment-to-DM automation signals they are building a list for something.`,
        action: `Check which posts are using this mechanic and what keyword — that tells you what they're about to launch.`,
      })
    } else if (ckNow >= 2) {
      signals.push({
        emoji: '💬', type: 'neutral',
        stat: `Comment-to-DM active — ${ckNow} post${ckNow > 1 ? 's' : ''} this period (${Math.round(ckNow / volNow * 100)}% of output)`,
        why: `DM contact collection is running. Every person who comments on those posts gets sent a link automatically.`,
        action: `Track which keywords they're using — each keyword is a different campaign or product.`,
      })
    }
  }

  if (enoughToCompare) {
    const sellNow   = windowPosts.filter(p => p.intent === 'SOFT-SELL' || p.intent === 'HARD-SELL').length
    const sellPrior = priorPosts.filter(p => p.intent === 'SOFT-SELL' || p.intent === 'HARD-SELL').length
    const sellRateNow   = sellNow   / volNow
    const sellRatePrior = sellPrior / volPrior
    if (Math.abs(sellRateNow - sellRatePrior) > 0.15) {
      const more = sellRateNow > sellRatePrior
      signals.push({
        emoji: more ? '💰' : '🎁', type: more ? 'up' : 'shift',
        stat: `Sell content ${more ? 'up to' : 'down to'} ${Math.round(sellRateNow * 100)}% of posts (was ${Math.round(sellRatePrior * 100)}% prior period)`,
        why: more ? `A higher proportion of sell posts means they're in the closing phase of a campaign.` : `Sell content has dropped — likely in give-value mode before the next launch.`,
        action: more ? `Watch the destination URL to understand what they're selling.` : `Look at which topics they're covering — they often preview what the next campaign will be about.`,
      })
    }
  }

  const topPost = [...windowPosts].filter(p => p.comments_n > 0).sort((a, b) => b.comments_n - a.comments_n)[0]
  if (topPost) {
    const hook = topPost.hook_text_english || topPost.hook_text_hebrew || '(no hook text)'
    signals.push({
      emoji: '🏆', type: 'neutral', post: topPost,
      stat: `Top post: "${hook.slice(0, 70)}${hook.length > 70 ? '…' : ''}" — ${topPost.comments_n.toLocaleString()} comments on ${topPost.channel.replace(/_/g, ' ')}`,
      why: `Highest-engagement post this period.`,
      action: `Read the full post to understand the hook format and CTA structure.`,
    })
  }

  return [
    ...signals.filter(s => s.type !== 'neutral'),
    ...signals.filter(s => s.type === 'neutral'),
  ].slice(0, 5)
}

// ─── Monetization Insights ────────────────────────────────────────────────────

export function getMonetizationInsights(posts) {
  if (!posts || !posts.length) return []
  const insights = []
  const total    = posts.length
  const hardSell = posts.filter(p => p.intent === 'HARD-SELL')
  const softSell = posts.filter(p => p.intent === 'SOFT-SELL')
  const giveVal  = posts.filter(p => p.intent === 'GIVE-VALUE')
  const hsAvg    = hardSell.length ? Math.round(avgN(hardSell.map(p => p.comments_n))) : 0
  const ssAvg    = softSell.length ? Math.round(avgN(softSell.map(p => p.comments_n))) : 0
  const gvAvg    = giveVal.length  ? Math.round(avgN(giveVal.map(p => p.comments_n)))  : 0
  const hsShare  = pct(hardSell.length, total)
  const ssShare  = pct(softSell.length, total)
  const gvShare  = pct(giveVal.length, total)

  if (hardSell.length > 0) {
    insights.push({
      emoji: '⚠️', color: '#F43F5E',
      stat: `Hard-sell: ${hsAvg} avg comments (${hsShare}% of posts). Soft-sell: ${ssAvg} avg. Give-value: ${gvAvg} avg.`,
      why: `Hard-sell is the worst-performing intent — ${Math.round(ssAvg / (hsAvg || 1))}× below soft-sell. Used almost exclusively in the final post of a campaign.`,
      action: `Keep hard-sell posts to the final 1–2 posts of a campaign sequence, after value and soft-sell posts have run first.`,
    })
  }

  const waFree = posts.filter(p =>
    (p.dest_ultimate || '').toLowerCase().includes('whatsapp') ||
    (p.dest_immediate || '').toLowerCase().includes('whatsapp')
  )
  if (waFree.length > 0) {
    insights.push({
      emoji: '📲', color: '#25D366',
      stat: `${waFree.length} posts (${pct(waFree.length, total)}%) drive to a free WhatsApp group before the paid offer`,
      why: `The free community is the middle step between a social media post and a paid product. It reduces friction.`,
      action: `Build a free entry-point community (WhatsApp, Telegram) before selling anything. The free step lowers the barrier to the paid offer.`,
    })
  }

  const ckPosts = posts.filter(p => p.cta_method === 'COMMENT-KEYWORD')
  if (ckPosts.length > 0) {
    const ckAvg = Math.round(avgN(ckPosts.map(p => p.comments_n)))
    insights.push({
      emoji: '🔔', color: '#FBBF24',
      stat: `${ckPosts.length} comment-to-DM posts average ${ckAvg.toLocaleString()} comments — primary contact collection method`,
      why: `Each post where people comment a keyword automatically sends that person a DM with a link. This is how the paid membership pipeline gets filled.`,
      action: `Set up comment-to-DM automation before building any content strategy around this mechanic.`,
    })
  }

  const destCounts = {}
  posts.forEach(p => { const d = p.dest_ultimate; if (d && d !== 'NONE' && d !== 'False') destCounts[d] = (destCounts[d] || 0) + 1 })
  const topDest = Object.entries(destCounts).sort((a, b) => b[1] - a[1])[0]
  if (topDest) {
    insights.push({
      emoji: '🎯', color: '#38BDF8',
      stat: `Top destination: "${topDest[0]}" — ${topDest[1]} posts (${pct(topDest[1], total)}%)`,
      why: `Most content points to one destination. Clear single-product focus compounds over time.`,
      action: `Decide on one primary offer before building a content strategy. Content that leads to a clear single destination converts better than content pointing to multiple products.`,
    })
  }

  return insights.filter(Boolean).slice(0, 5)
}
