/**
 * seed-eden.js — One-time script to convert existing Eden Bibas CSV data
 * into the dashboard's JSON format.
 *
 * Run once from the Spy Agent root:
 *   node dashboard/seed-eden.js
 *
 * Writes to:
 *   dashboard/public/data/eden_bibas/*.json
 *   dashboard/public/data/manifest.json
 */

const fs = require('fs')
const path = require('path')
const Papa = require('papaparse')

const SRC_DIR  = path.join(__dirname, '..', 'JC CI Dash', 'Data')
const OUT_DIR  = path.join(__dirname, 'public', 'data', 'eden_bibas')
const MANIFEST = path.join(__dirname, 'public', 'data', 'manifest.json')

const FILES = [
  { src: 'organic_posts.csv',   out: 'organic_posts.json'   },
  { src: 'community_posts.csv', out: 'community_posts.json' },
  { src: 'admin_posts.csv',     out: 'admin_posts.json'     },
  { src: 'curriculum.csv',      out: 'curriculum.json'      },
  { src: 'paid_ads.csv',        out: 'paid_ads.json'        },
]

function parseCsv(text) {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  })
  if (result.errors.length) {
    console.warn(`  ⚠ Parse warnings: ${result.errors.slice(0,3).map(e=>e.message).join(', ')}`)
  }
  return result.data
}

async function main() {
  console.log('🌱 Seeding Eden Bibas data...\n')

  // Check source exists
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`❌ Source directory not found: ${SRC_DIR}`)
    console.error('   Make sure the "JC CI Dash/Data/" folder exists in the Spy Agent root.')
    process.exit(1)
  }

  // Ensure output directory exists
  fs.mkdirSync(OUT_DIR, { recursive: true })

  let totalPosts = 0
  let latestDate = null

  for (const { src, out } of FILES) {
    const srcPath = path.join(SRC_DIR, src)
    const outPath = path.join(OUT_DIR, out)

    if (!fs.existsSync(srcPath)) {
      console.warn(`  ⚠ Skipping ${src} — file not found`)
      // Write empty array so dashboard doesn't 404
      fs.writeFileSync(outPath, JSON.stringify([]))
      continue
    }

    const text = fs.readFileSync(srcPath, 'utf8')
    const rows = parseCsv(text)
    fs.writeFileSync(outPath, JSON.stringify(rows, null, 2))
    console.log(`  ✓ ${src} → ${out} (${rows.length} rows)`)

    if (src === 'organic_posts.csv') {
      totalPosts = rows.length
      // Find latest date
      const dates = rows
        .map(r => r.date_normalized)
        .filter(d => d && d !== 'UNKNOWN' && d.match(/^\d{4}-\d{2}-\d{2}$/))
        .sort()
      latestDate = dates[dates.length - 1] ?? null
    }
  }

  // Write / update manifest.json
  let manifest = { competitors: [] }
  if (fs.existsSync(MANIFEST)) {
    try { manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) } catch {}
  }

  const platforms = ['instagram', 'fb_personal', 'fb_group', 'linkedin', 'whatsapp', 'email', 'tiktok', 'youtube']
  const existing = manifest.competitors.findIndex(c => c.slug === 'eden_bibas')
  const entry = {
    slug: 'eden_bibas',
    name: 'Eden Bibas',
    lastUpdated: latestDate ? `${latestDate}T00:00:00.000Z` : new Date().toISOString(),
    platforms,
    postCount: totalPosts,
  }

  if (existing >= 0) {
    manifest.competitors[existing] = entry
  } else {
    manifest.competitors.unshift(entry)
  }

  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true })
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2))
  console.log(`\n  ✓ manifest.json updated (${manifest.competitors.length} competitor${manifest.competitors.length !== 1 ? 's' : ''})`)

  console.log('\n✅ Seed complete!')
  console.log(`   Eden Bibas: ${totalPosts} posts, last date: ${latestDate ?? 'unknown'}`)
  console.log('\nNext steps:')
  console.log('  1. cd dashboard && npm install && npm run dev')
  console.log('  2. Verify dashboard loads at http://localhost:5173')
  console.log('  3. npm run build → push dist/ to Netlify')
}

main().catch(err => { console.error('❌ Seed failed:', err); process.exit(1) })
