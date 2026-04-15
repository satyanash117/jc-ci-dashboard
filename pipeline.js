/**
 * pipeline.js — Orchestrates the full dashboard update pipeline
 *
 * Called from server.js / recover.js after a spy job completes.
 *
 * Steps:
 *   1. Flatten raw posts from job results
 *   2. Per-post AI classification (hook_type, intent, cta_method,
 *      dest_ultimate, dest_immediate, sequence_position, campaign_id)
 *   3. Global campaign-grouper pass — assigns coherent campaign_ids
 *      across the full history so launch arcs are properly identified
 *   4. Export to JSON files in output/dashboard/{slug}/
 *   5. Generate AI summary for each competitor
 *      (funnel, campaign intel, opportunities)
 *   6. Update public/data/manifest.json
 *   7. Push everything to GitHub
 *   8. Emit SSE progress event back to the UI
 */

const fs   = require('fs')
const path = require('path')

const { classifyPosts }     = require('./ai-post-analyzer.js')
const { groupCampaigns }    = require('./ai-campaign-grouper.js')
const { exportToDashboard, preparePostsForExport, toSlug } = require('./exporter.js')
const { generateAISummary } = require('./ai-summary-generator.js')
const { publishToGitHub }   = require('./github-publisher.js')

const DASH_DATA = path.join(__dirname, '..', 'output', 'dashboard')
const PUB_DATA  = path.join(__dirname, 'public', 'data')

/**
 * Main pipeline entry point.
 *
 * @param {string}   jobId
 * @param {Object}   results  - spy job results: { results: { [name]: { [platform]: { posts } } } }
 * @param {Object}   config   - job config: { competitors: [...], platforms: [...] }
 * @param {Function} sendProgress - SSE sender: sendProgress(jobId, data)
 */
async function runDashboardPipeline(jobId, results, config, sendProgress) {
  const send = (msg, type = 'dashboard') => {
    console.log(`[Dashboard Pipeline] ${msg}`)
    sendProgress?.(jobId, { type, message: msg })
  }

  try {
    send('Starting dashboard pipeline...')

    // ── Step 1: Flatten all raw posts ─────────────────────────────────────────
    const allRawPosts = []
    for (const competitor of (config.competitors || [])) {
      const name = competitor.name
      const competitorResults = results.results?.[name] || {}
      for (const [platform, platformData] of Object.entries(competitorResults)) {
        const posts = platformData.posts || []
        posts.forEach(p => {
          allRawPosts.push({
            ...p,
            _competitorName: name,
            _competitorSlug: toSlug(name),
            _platform: platform,
          })
        })
      }
    }

    if (!allRawPosts.length) {
      send('No posts to process — pipeline done')
      return { skipped: true, reason: 'no posts' }
    }

    send(`Classifying ${allRawPosts.length} posts with AI (hook, intent, CTA, destination)...`)

    // ── Step 2: Per-post AI classification ────────────────────────────────────
    let classifiedPosts
    try {
      classifiedPosts = await classifyPosts(allRawPosts, {
        onProgress: msg => send(msg),
      })
    } catch (err) {
      console.error('[Pipeline] Classification failed, using unclassified posts:', err.message)
      classifiedPosts = allRawPosts
    }

    // ── Step 3: Global campaign-grouper (per competitor) ─────────────────────
    // Group posts by competitor, run the grouper, reassemble.
    send('Running global campaign-grouper pass...')
    const postsByCompetitor = {}
    for (const p of classifiedPosts) {
      const slug = p._competitorSlug || toSlug(p._competitorName || '')
      if (!postsByCompetitor[slug]) postsByCompetitor[slug] = []
      postsByCompetitor[slug].push(p)
    }

    const groupedPosts = []
    for (const [slug, competitorPosts] of Object.entries(postsByCompetitor)) {
      // Find the human-readable name for logging
      const competitorName = config.competitors?.find(c => toSlug(c.name) === slug)?.name || slug
      try {
        const grouped = await groupCampaigns(competitorName, competitorPosts, {
          onProgress: msg => send(msg),
        })
        groupedPosts.push(...grouped)
      } catch (err) {
        console.error(`[Pipeline] Campaign grouper failed for ${competitorName}:`, err.message)
        groupedPosts.push(...competitorPosts) // keep as-is
      }
    }

    // ── Step 4: Export to local JSON ──────────────────────────────────────────
    send('Exporting to dashboard JSON...')
    const preparedPosts = preparePostsForExport(results, config, groupedPosts)
    const exported = exportToDashboard(results, preparedPosts, config)

    if (!exported.length) {
      send('No new posts to export — pipeline done')
      return { skipped: true, reason: 'no new posts after dedup' }
    }

    // ── Step 5: AI summaries ──────────────────────────────────────────────────
    for (const { slug, name, postCount } of exported) {
      send(`Generating AI summary for ${name} (${postCount} total posts)...`)
      try {
        const organicPath = path.join(DASH_DATA, slug, 'organic_posts.json')
        const posts = JSON.parse(fs.readFileSync(organicPath, 'utf8'))
        await generateAISummary(slug, name, posts)
      } catch (err) {
        console.error(`[Pipeline] Summary failed for ${name}:`, err.message)
        send(`⚠ Summary failed for ${name}: ${err.message}`)
      }
    }

    // ── Step 6: Update manifest.json ──────────────────────────────────────────
    updateManifest(exported, config)

    // ── Step 7: Push to GitHub ────────────────────────────────────────────────
    const netlifyUrl = process.env.NETLIFY_URL || null

    for (const { slug, name, postCount } of exported) {
      send(`Pushing ${name} to GitHub...`)
      try {
        await publishToGitHub(slug, name, postCount, {
          onProgress: msg => send(msg),
        })
      } catch (err) {
        console.error(`[Pipeline] GitHub push failed for ${name}:`, err.message)
        send(`⚠ GitHub push failed for ${name}: ${err.message}`)
      }
    }

    // ── Step 8: Final SSE event ───────────────────────────────────────────────
    const updatedCompetitors = exported.map(e => e.name)
    send('Dashboard update complete ✅', 'dashboard_updated')
    sendProgress?.(jobId, {
      type: 'dashboard_updated',
      competitors: updatedCompetitors,
      url: netlifyUrl,
      message: `Dashboard updated for: ${updatedCompetitors.join(', ')}`,
    })

    return { success: true, exported }
  } catch (err) {
    console.error('[Pipeline] Fatal error:', err)
    send(`Dashboard pipeline error: ${err.message}`, 'dashboard_error')
    return { success: false, error: err.message }
  }
}

function updateManifest(exported, config) {
  const manifestPath = path.join(PUB_DATA, 'manifest.json')
  let manifest = { competitors: [] }

  if (fs.existsSync(manifestPath)) {
    try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) } catch {}
  }

  for (const { slug, name, postCount } of exported) {
    const existing = manifest.competitors.findIndex(c => c.slug === slug)
    const platforms = [...new Set(
      (config.competitors?.find(c => c.name === name)?.handles
        ? Object.keys(config.competitors.find(c => c.name === name).handles)
        : config.platforms) || []
    )]

    const entry = {
      slug,
      name,
      lastUpdated: new Date().toISOString(),
      platforms,
      postCount,
    }

    if (existing >= 0) {
      manifest.competitors[existing] = entry
    } else {
      manifest.competitors.push(entry)
    }
  }

  fs.mkdirSync(path.dirname(manifestPath), { recursive: true })
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.log(`[Pipeline] manifest.json updated (${manifest.competitors.length} competitors)`)
}

module.exports = { runDashboardPipeline }
