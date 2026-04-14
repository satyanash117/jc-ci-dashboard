/**
 * pipeline.js — Orchestrates the full dashboard update pipeline
 *
 * Called from server.js after a spy job completes.
 *
 * Steps:
 *   1. Flatten raw posts from job results
 *   2. Classify each post with AI (hook_type, intent, cta_method, etc.)
 *   3. Export to JSON files in output/dashboard/{slug}/
 *   4. Generate AI summary for each competitor
 *   5. Update public/data/manifest.json
 *   6. Push everything to GitHub
 *   7. Emit SSE progress event back to the UI
 */

const fs   = require('fs')
const path = require('path')

const { classifyPosts }     = require('./ai-post-analyzer.js')
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

    send(`Classifying ${allRawPosts.length} posts with AI...`)

    // ── Step 2: AI classification ─────────────────────────────────────────────
    let classifiedPosts
    try {
      classifiedPosts = await classifyPosts(allRawPosts, {
        onProgress: msg => send(msg),
      })
    } catch (err) {
      console.error('[Pipeline] Classification failed, using unclassified posts:', err.message)
      classifiedPosts = allRawPosts // proceed without classification
    }

    // ── Step 3: Export to local JSON ──────────────────────────────────────────
    send('Exporting to dashboard JSON...')
    const preparedPosts = preparePostsForExport(results, config, classifiedPosts)
    const exported = exportToDashboard(results, preparedPosts, config)

    // ── Step 4: AI summaries ──────────────────────────────────────────────────
    for (const { slug, name, postCount } of exported) {
      send(`Generating AI summary for ${name}...`)
      try {
        const organicPath = path.join(DASH_DATA, slug, 'organic_posts.json')
        const posts = JSON.parse(fs.readFileSync(organicPath, 'utf8'))
        await generateAISummary(slug, name, posts)
      } catch (err) {
        console.error(`[Pipeline] Summary failed for ${name}:`, err.message)
      }
    }

    // ── Step 5: Update manifest.json ──────────────────────────────────────────
    updateManifest(exported, config)

    // ── Step 6: Push to GitHub ────────────────────────────────────────────────
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

    // ── Step 7: Final SSE event ───────────────────────────────────────────────
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
