/**
 * github-publisher.js — Pushes dashboard data files to a GitHub repo
 *
 * Required env vars:
 *   GITHUB_TOKEN  — personal access token with contents:write
 *   GITHUB_REPO   — repo name, e.g. "jc-ci-dashboard"
 *   GITHUB_OWNER  — GitHub username, e.g. "satyanash117"
 *
 * Uses only the Node.js built-in https module — no extra dependencies.
 */

const https = require('https')
const fs    = require('fs')
const path  = require('path')

const DASH_DATA = path.join(__dirname, '..', 'output', 'dashboard')
const PUB_DATA  = path.join(__dirname, 'public', 'data')

/**
 * Makes a GitHub API request.
 */
function githubRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const token = process.env.GITHUB_TOKEN
    const owner = process.env.GITHUB_OWNER
    const repo  = process.env.GITHUB_REPO

    if (!token || !owner || !repo) {
      reject(new Error('GITHUB_TOKEN, GITHUB_OWNER and GITHUB_REPO must be set in .env'))
      return
    }

    const payload = body ? JSON.stringify(body) : null
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/contents/${endpoint}`,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'JC-CI-Spy-Agent/2.0',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }

    const req = https.request(options, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (res.statusCode >= 400 && res.statusCode !== 404) {
            reject(new Error(`GitHub API ${method} ${endpoint}: ${res.statusCode} — ${json.message || data}`))
          } else {
            resolve({ status: res.statusCode, data: json })
          }
        } catch {
          resolve({ status: res.statusCode, data })
        }
      })
    })
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

/**
 * Gets the current SHA of a file in the repo (needed for updates).
 * Returns null if the file doesn't exist yet.
 */
async function getFileSha(repoPath) {
  const { status, data } = await githubRequest('GET', repoPath)
  if (status === 404) return null
  return data.sha || null
}

/**
 * Uploads a single file to the GitHub repo.
 */
async function uploadFile(repoPath, localPath, commitMessage) {
  const content = fs.readFileSync(localPath)
  const base64  = content.toString('base64')
  const sha     = await getFileSha(repoPath)

  const body = {
    message: commitMessage,
    content: base64,
    ...(sha ? { sha } : {}),
  }

  const { status, data } = await githubRequest('PUT', repoPath, body)
  return { status, sha: data.content?.sha }
}

/**
 * Publishes all data files for a competitor + updates manifest.json.
 *
 * @param {string} competitorSlug
 * @param {string} competitorName
 * @param {number} postCount
 * @param {Object} onProgress - callback(message)
 */
async function publishToGitHub(competitorSlug, competitorName, postCount, { onProgress } = {}) {
  const owner = process.env.GITHUB_OWNER
  const repo  = process.env.GITHUB_REPO

  if (!process.env.GITHUB_TOKEN) {
    console.warn('[GitHub] GITHUB_TOKEN not set — skipping publish')
    return { skipped: true }
  }

  const timestamp = new Date().toISOString()
  const commitMsg = `Update ${competitorName} — ${postCount} posts [${timestamp.slice(0,16)}]`

  onProgress?.(`Publishing ${competitorName} to GitHub...`)

  const localDir  = path.join(DASH_DATA, competitorSlug)
  const repoBase  = `public/data/${competitorSlug}`

  const dataFiles = [
    'organic_posts.json',
    'community_posts.json',
    'admin_posts.json',
    'curriculum.json',
    'paid_ads.json',
    'ai_summary.json',
  ]

  let uploaded = 0
  for (const file of dataFiles) {
    const localPath = path.join(localDir, file)
    if (!fs.existsSync(localPath)) continue
    try {
      await uploadFile(`${repoBase}/${file}`, localPath, commitMsg)
      uploaded++
      onProgress?.(`  ✓ Uploaded ${file}`)
    } catch (err) {
      console.error(`[GitHub] Failed to upload ${file}:`, err.message)
    }
  }

  // Update manifest.json
  const manifestLocal = path.join(PUB_DATA, 'manifest.json')
  if (fs.existsSync(manifestLocal)) {
    try {
      await uploadFile('public/data/manifest.json', manifestLocal, commitMsg)
      onProgress?.('  ✓ Updated manifest.json')
    } catch (err) {
      console.error('[GitHub] Failed to upload manifest.json:', err.message)
    }
  }

  onProgress?.(`✅ Published ${uploaded} files for ${competitorName}`)
  return { uploaded, commitMsg }
}

module.exports = { publishToGitHub }
