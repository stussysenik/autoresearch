/**
 * Phase 3: Analyze — Compare variants, generate ANALYSIS.md + 3 HTML views
 *
 * Reads:  data/results.json, data/sitemap_index.json, data/catalog.json
 * Outputs: ANALYSIS.md, dashboard.html, reels.html, courses.html
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { VariantResult, Lecture, CourseSitemapEntry } from './types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const dataDir = join(rootDir, 'data')

// ─── Shared CSS ───────────────────────────────────────────────────────────────

const sharedCSS = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Space+Grotesk:wght@400;600;700&display=swap');

  :root {
    --bg: #0a0a0b;
    --surface: #111113;
    --surface-2: #1a1a1e;
    --border: #2a2a30;
    --text: #e4e4e7;
    --text-dim: #71717a;
    --mit-red: #a31f34;
    --mit-red-glow: #ff2d4f;
    --accent: #22d3ee;
    --green: #4ade80;
    --amber: #fbbf24;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'JetBrains Mono', monospace;
    min-height: 100vh;
    overflow-x: hidden;
  }

  .container {
    max-width: 960px;
    margin: 0 auto;
    padding: 48px 24px;
  }

  /* Navigation */
  nav {
    position: sticky;
    top: 0;
    z-index: 100;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    padding: 12px 24px;
    display: flex;
    justify-content: center;
    gap: 24px;
  }

  nav a {
    color: var(--text-dim);
    text-decoration: none;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding: 4px 12px;
    transition: color 0.2s, border-color 0.2s;
    border-bottom: 2px solid transparent;
  }

  nav a:hover { color: var(--text); }
  nav a.active {
    color: var(--mit-red-glow);
    border-bottom-color: var(--mit-red);
  }

  header {
    text-align: center;
    margin-bottom: 48px;
    position: relative;
  }

  header::before {
    content: 'MIT OCW';
    position: absolute;
    top: -20px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 120px;
    font-weight: 700;
    color: var(--mit-red);
    opacity: 0.04;
    letter-spacing: -4px;
    white-space: nowrap;
    pointer-events: none;
  }

  .tag {
    display: inline-block;
    padding: 4px 12px;
    background: var(--mit-red);
    color: white;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 16px;
  }

  h1 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 32px;
    font-weight: 700;
    letter-spacing: -1px;
    margin-bottom: 8px;
  }

  .subtitle {
    color: var(--text-dim);
    font-size: 13px;
    font-weight: 300;
  }

  footer {
    margin-top: 64px;
    padding-top: 24px;
    border-top: 1px solid var(--border);
    text-align: center;
    font-size: 11px;
    color: var(--text-dim);
  }

  footer a {
    color: var(--mit-red);
    text-decoration: none;
  }
`

function navBar(active: 'benchmark' | 'reels' | 'courses') {
  return `<nav>
    <a href="dashboard.html" class="${active === 'benchmark' ? 'active' : ''}">Benchmark</a>
    <a href="reels.html" class="${active === 'reels' ? 'active' : ''}">Reels Feed</a>
    <a href="courses.html" class="${active === 'courses' ? 'active' : ''}">Courses</a>
  </nav>`
}

function footerHtml() {
  return `<footer>
    OCW Video Scraper Experiment &mdash; Generated ${new Date().toISOString().split('T')[0]}
  </footer>`
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const results: VariantResult[] = JSON.parse(
    readFileSync(join(dataDir, 'results.json'), 'utf-8')
  )

  // Load catalog (best variant's lectures)
  const catalogPath = join(dataDir, 'catalog.json')
  const catalog: { lectures: Lecture[] } = existsSync(catalogPath)
    ? JSON.parse(readFileSync(catalogPath, 'utf-8'))
    : { lectures: [] }

  // Load sitemap index for courses view
  const sitemapPath = join(dataDir, 'sitemap_index.json')
  const sitemapIndex = existsSync(sitemapPath)
    ? JSON.parse(readFileSync(sitemapPath, 'utf-8'))
    : { totalCourses: 0, sampleSize: 0, courses: [] }

  const withResults = results.filter(r => r.metrics.videosFound > 0)
  const sorted = [...results].sort((a, b) => a.metrics.wallClockMs - b.metrics.wallClockMs)
  const winner = withResults.length > 0
    ? withResults.reduce((a, b) => a.metrics.throughput > b.metrics.throughput ? a : b)
    : sorted[0]

  // Collect ALL unique lectures across all variants
  const allLectures = dedup(results.flatMap(r => r.lectures))
  const totalVideos = allLectures.length

  // ─── Generate ANALYSIS.md ─────────────────────────────────────────────────

  const analysis = `# OCW Video Scraper — Experiment Results

## Winner: \`${winner.variant}\`

${winner.metrics.videosFound} videos discovered at **${winner.metrics.throughput.toFixed(2)} videos/sec** in ${(winner.metrics.wallClockMs / 1000).toFixed(1)}s.

## Benchmark Comparison

| Variant | Wall Clock | Videos | Requests | Throughput | Errors | Data |
|---------|-----------|--------|----------|------------|--------|------|
${sorted
  .map(
    r =>
      `| ${r.variant} | ${(r.metrics.wallClockMs / 1000).toFixed(1)}s | ${r.metrics.videosFound} | ${r.metrics.requestCount} | ${r.metrics.throughput.toFixed(2)} v/s | ${r.metrics.errorsCount} | ${(r.metrics.bytesDownloaded / 1024).toFixed(0)} KB |`
  )
  .join('\n')}

## Key Findings

${sorted.map((r, i) => {
  const speedup = i === 0 ? '(baseline)' : `${(sorted[sorted.length - 1].metrics.wallClockMs / r.metrics.wallClockMs).toFixed(1)}x faster than sequential`
  return `- **${r.variant}**: ${(r.metrics.wallClockMs / 1000).toFixed(1)}s — ${speedup}`
}).join('\n')}

## Total Unique Videos: ${totalVideos}

## Recommendation

The \`${winner.variant}\` strategy should be ported to Swift for the mit-ocw-reels app.
${winner.variant === 'sitemap-heuristic'
  ? 'Note: YouTube IDs from URL slugs are lowercased. Use YouTube oEmbed API for case restoration, or accept lowercase (YouTube resolves both).'
  : `Use Swift \`TaskGroup\` with concurrency matching this variant's batch size for equivalent performance.`
}

## Swift Integration Path

1. Copy \`swift/OCWScraper.swift\` into the mit-ocw-reels Xcode project
2. Call \`OCWScraper.scrapeAll()\` from a background task on first launch
3. Insert results into SwiftData — dedup against existing seed_data
4. Schedule periodic re-scrapes via BackgroundTasks framework

---
*Generated ${new Date().toISOString()}*
`

  writeFileSync(join(rootDir, 'ANALYSIS.md'), analysis)
  console.log('✅ Generated ANALYSIS.md')

  // ─── Generate Dashboard HTML ──────────────────────────────────────────────

  const dashboard = generateDashboard(results, winner, totalVideos)
  writeFileSync(join(rootDir, 'dashboard.html'), dashboard)
  console.log('✅ Generated dashboard.html')

  // ─── Generate Reels Feed HTML ─────────────────────────────────────────────

  const reels = generateReels(allLectures)
  writeFileSync(join(rootDir, 'reels.html'), reels)
  console.log(`✅ Generated reels.html (${allLectures.length} videos)`)

  // ─── Generate Courses HTML ────────────────────────────────────────────────

  const courses = generateCourses(sitemapIndex.courses, allLectures, sitemapIndex.totalCourses)
  writeFileSync(join(rootDir, 'courses.html'), courses)
  console.log(`✅ Generated courses.html (${sitemapIndex.courses.length} courses)`)

  console.log(`\n🏆 Winner: ${winner.variant} — ${winner.metrics.throughput.toFixed(2)} videos/sec`)
  console.log(`📺 ${totalVideos} unique videos discovered`)
}

function dedup(lectures: Lecture[]): Lecture[] {
  const seen = new Set<string>()
  return lectures.filter(l => {
    const key = l.youtubeId.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ─── Dashboard (Benchmark View) ──────────────────────────────────────────────

function generateDashboard(results: VariantResult[], winner: VariantResult, totalVideos: number): string {
  const maxTime = Math.max(...results.map(r => r.metrics.wallClockMs))
  const maxThroughput = Math.max(...results.map(r => r.metrics.throughput))

  const variantCards = results
    .sort((a, b) => a.metrics.wallClockMs - b.metrics.wallClockMs)
    .map((r, i) => {
      const isWinner = r.variant === winner.variant
      const timePct = (r.metrics.wallClockMs / maxTime) * 100
      const throughputPct = maxThroughput > 0 ? (r.metrics.throughput / maxThroughput) * 100 : 0

      return `
      <div class="card ${isWinner ? 'winner' : ''}">
        <div class="card-header">
          <span class="rank">#${i + 1}</span>
          <h3>${r.variant}${isWinner ? '<span class="badge">FASTEST</span>' : ''}</h3>
        </div>
        <div class="metrics">
          <div class="metric">
            <span class="label">WALL CLOCK</span>
            <span class="value">${(r.metrics.wallClockMs / 1000).toFixed(1)}<small>s</small></span>
            <div class="bar-track"><div class="bar time" style="width: ${timePct}%"></div></div>
          </div>
          <div class="metric">
            <span class="label">THROUGHPUT</span>
            <span class="value">${r.metrics.throughput.toFixed(2)}<small>v/s</small></span>
            <div class="bar-track"><div class="bar throughput" style="width: ${throughputPct}%"></div></div>
          </div>
          <div class="metric-row">
            <div class="mini">
              <span class="label">VIDEOS</span>
              <span class="value">${r.metrics.videosFound}</span>
            </div>
            <div class="mini">
              <span class="label">REQUESTS</span>
              <span class="value">${r.metrics.requestCount}</span>
            </div>
            <div class="mini">
              <span class="label">DATA</span>
              <span class="value">${(r.metrics.bytesDownloaded / 1024).toFixed(0)}<small>KB</small></span>
            </div>
            <div class="mini">
              <span class="label">ERRORS</span>
              <span class="value ${r.metrics.errorsCount > 0 ? 'error' : ''}">${r.metrics.errorsCount}</span>
            </div>
          </div>
        </div>
      </div>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>OCW Scraper Benchmark</title>
<style>
${sharedCSS}

  .cards {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 24px;
    position: relative;
    transition: border-color 0.2s;
  }

  .card:hover { border-color: var(--text-dim); }

  .card.winner {
    border-color: var(--mit-red);
    box-shadow: 0 0 40px -10px rgba(163, 31, 52, 0.3);
  }

  .card.winner::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, var(--mit-red), var(--mit-red-glow), var(--mit-red));
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
  }

  .rank { font-size: 11px; color: var(--text-dim); font-weight: 300; }

  .card-header h3 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 18px;
    font-weight: 600;
    flex: 1;
  }

  .badge {
    display: inline-block;
    margin-left: 8px;
    padding: 2px 8px;
    background: var(--mit-red);
    color: white;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.5px;
    vertical-align: middle;
    font-family: 'JetBrains Mono', monospace;
  }

  .metric { margin-bottom: 16px; }

  .metric .label {
    display: block;
    font-size: 9px;
    letter-spacing: 2px;
    color: var(--text-dim);
    margin-bottom: 4px;
  }

  .metric .value {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -1px;
  }

  .metric .value small {
    font-size: 14px;
    font-weight: 300;
    color: var(--text-dim);
    margin-left: 2px;
  }

  .bar-track {
    height: 4px;
    background: var(--surface-2);
    margin-top: 8px;
    overflow: hidden;
  }

  .bar {
    height: 100%;
    transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .bar.time { background: linear-gradient(90deg, var(--accent), var(--amber)); }
  .bar.throughput { background: linear-gradient(90deg, var(--green), var(--accent)); }
  .winner .bar.time { background: linear-gradient(90deg, var(--mit-red), var(--mit-red-glow)); }
  .winner .bar.throughput { background: linear-gradient(90deg, var(--mit-red), var(--mit-red-glow)); }

  .metric-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  .mini .label {
    display: block;
    font-size: 8px;
    letter-spacing: 2px;
    color: var(--text-dim);
    margin-bottom: 4px;
  }

  .mini .value { font-size: 16px; font-weight: 500; }
  .mini .value small { font-size: 11px; color: var(--text-dim); }
  .mini .value.error { color: var(--mit-red-glow); }

  .swift-callout {
    margin-top: 32px;
    padding: 20px 24px;
    background: var(--surface);
    border-left: 3px solid var(--accent);
  }

  .swift-callout h4 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 14px;
    margin-bottom: 8px;
    color: var(--accent);
  }

  .swift-callout p {
    font-size: 12px;
    color: var(--text-dim);
    line-height: 1.6;
  }

  .swift-callout code {
    color: var(--text);
    background: var(--surface-2);
    padding: 1px 6px;
  }
</style>
</head>
<body>
${navBar('benchmark')}
<div class="container">
  <header>
    <div class="tag">EXPERIMENT</div>
    <h1>OCW Video Scraper Benchmark</h1>
    <p class="subtitle">4 strategies. ${results.reduce((s, r) => s + r.metrics.requestCount, 0)} total requests. ${totalVideos} videos discovered.</p>
  </header>

  <div class="cards">
    ${variantCards}
  </div>

  <div class="swift-callout">
    <h4>Swift Implementation Ready</h4>
    <p>
      The winning <code>${winner.variant}</code> strategy has been ported to
      <code>swift/OCWScraper.swift</code> using <code>URLSession</code> +
      <code>async/await</code> + <code>TaskGroup</code>. Drop it into the
      mit-ocw-reels Xcode project to scrape the full catalog on-device.
    </p>
  </div>

  ${footerHtml()}
</div>
</body>
</html>`
}

// ─── Reels Feed View ────────────────────────────────────────────────────────

function generateReels(lectures: Lecture[]): string {
  // Group lectures by course
  const courseNames = [...new Set(lectures.map(l => l.courseName))]

  const courseOptions = courseNames
    .map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join('\n        ')

  const reelCards = lectures
    .map((l, i) => `
      <div class="reel-card" data-course="${escapeAttr(l.courseName)}">
        <div class="video-wrapper">
          <iframe
            src="https://www.youtube.com/embed/${escapeAttr(l.youtubeId)}"
            title="${escapeAttr(l.title)}"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
            loading="${i < 3 ? 'eager' : 'lazy'}"
          ></iframe>
        </div>
        <div class="reel-info">
          <h3 class="reel-title">${escapeHtml(l.title)}</h3>
          <div class="reel-meta">
            <span class="course-number">${escapeHtml(l.courseNumber)}</span>
            <span class="course-name">${escapeHtml(l.courseName)}</span>
            ${l.semester && l.year ? `<span class="semester">${escapeHtml(l.semester)} ${l.year}</span>` : ''}
          </div>
          <a class="ocw-link" href="${escapeAttr(l.ocwUrl)}" target="_blank" rel="noopener">View on MIT OCW</a>
        </div>
      </div>`)
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>OCW Reels Feed</title>
<style>
${sharedCSS}

  .controls {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 32px;
    flex-wrap: wrap;
  }

  .controls .count {
    font-size: 13px;
    color: var(--text-dim);
  }

  .controls select {
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
    padding: 8px 12px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    cursor: pointer;
    min-width: 200px;
  }

  .controls select:focus {
    outline: none;
    border-color: var(--mit-red);
  }

  .reels {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .reel-card {
    background: var(--surface);
    border: 1px solid var(--border);
    overflow: hidden;
    transition: border-color 0.2s;
  }

  .reel-card:hover {
    border-color: var(--text-dim);
  }

  .video-wrapper {
    position: relative;
    width: 100%;
    padding-bottom: 56.25%; /* 16:9 */
    background: #000;
  }

  .video-wrapper iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  .reel-info {
    padding: 16px 20px;
  }

  .reel-title {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 8px;
    line-height: 1.3;
  }

  .reel-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
  }

  .course-number {
    background: var(--mit-red);
    color: white;
    padding: 2px 8px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1px;
  }

  .course-name {
    color: var(--text-dim);
    font-size: 12px;
  }

  .semester {
    color: var(--text-dim);
    font-size: 11px;
    opacity: 0.7;
  }

  .ocw-link {
    display: inline-block;
    color: var(--accent);
    font-size: 11px;
    text-decoration: none;
    letter-spacing: 0.5px;
  }

  .ocw-link:hover {
    text-decoration: underline;
  }

  .empty-state {
    text-align: center;
    padding: 64px 24px;
    color: var(--text-dim);
  }

  .empty-state h2 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 20px;
    margin-bottom: 8px;
    color: var(--text);
  }
</style>
</head>
<body>
${navBar('reels')}
<div class="container">
  <header>
    <div class="tag">REELS FEED</div>
    <h1>MIT OCW Videos</h1>
    <p class="subtitle">${lectures.length} lecture videos discovered from MIT OpenCourseWare</p>
  </header>

  ${lectures.length > 0 ? `
  <div class="controls">
    <select id="courseFilter" onchange="filterReels()">
      <option value="">All Courses</option>
      ${courseOptions}
    </select>
    <span class="count" id="visibleCount">${lectures.length} videos</span>
  </div>

  <div class="reels" id="reelsContainer">
    ${reelCards}
  </div>
  ` : `
  <div class="empty-state">
    <h2>No videos discovered yet</h2>
    <p>Run the experiment with a larger sample size to discover videos.</p>
    <p style="margin-top: 8px; font-size: 12px;">SAMPLE_SIZE=200 bun run experiment</p>
  </div>
  `}

  ${footerHtml()}
</div>
<script>
function filterReels() {
  const filter = document.getElementById('courseFilter').value;
  const cards = document.querySelectorAll('.reel-card');
  let visible = 0;
  cards.forEach(card => {
    const match = !filter || card.dataset.course === filter;
    card.style.display = match ? '' : 'none';
    if (match) visible++;
  });
  document.getElementById('visibleCount').textContent = visible + ' video' + (visible !== 1 ? 's' : '');
}
</script>
</body>
</html>`
}

// ─── Courses Catalog View ───────────────────────────────────────────────────

function generateCourses(
  courses: CourseSitemapEntry[],
  lectures: Lecture[],
  totalInIndex: number
): string {
  // Count videos per course
  const videoCountByCourse = new Map<string, number>()
  for (const l of lectures) {
    const key = l.courseNumber
    videoCountByCourse.set(key, (videoCountByCourse.get(key) || 0) + 1)
  }

  // Extract department from course number (first segment before .)
  function getDept(courseNumber: string): string {
    const dot = courseNumber.indexOf('.')
    return dot > 0 ? courseNumber.substring(0, dot) : courseNumber.split('-')[0] || '?'
  }

  // Sort courses: those with videos first, then by course number
  const sortedCourses = [...courses].sort((a, b) => {
    const aVideos = videoCountByCourse.get(a.courseNumber) || 0
    const bVideos = videoCountByCourse.get(b.courseNumber) || 0
    if (aVideos !== bVideos) return bVideos - aVideos
    return a.courseNumber.localeCompare(b.courseNumber)
  })

  const coursesWithVideos = sortedCourses.filter(c => videoCountByCourse.has(c.courseNumber)).length
  const departments = [...new Set(sortedCourses.map(c => getDept(c.courseNumber)))].sort()

  const deptOptions = departments
    .map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`)
    .join('\n        ')

  const courseRows = sortedCourses
    .map(c => {
      const vCount = videoCountByCourse.get(c.courseNumber) || 0
      const dept = getDept(c.courseNumber)
      const slug = c.courseUrl.replace('https://ocw.mit.edu/courses/', '').replace(/\/$/, '')
      const semYear = extractSemYearFromSlug(slug)

      return `
        <tr class="course-row" data-dept="${escapeAttr(dept)}" data-has-video="${vCount > 0 ? '1' : '0'}" data-search="${escapeAttr((c.courseNumber + ' ' + c.courseName).toLowerCase())}">
          <td class="col-number">${escapeHtml(c.courseNumber)}</td>
          <td class="col-name">
            <a href="${escapeAttr(c.courseUrl)}" target="_blank" rel="noopener">${escapeHtml(c.courseName)}</a>
          </td>
          <td class="col-sem">${semYear}</td>
          <td class="col-videos">${vCount > 0 ? `<span class="video-badge">${vCount}</span>` : '<span class="no-videos">—</span>'}</td>
        </tr>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>OCW Course Catalog</title>
<style>
${sharedCSS}

  .container { max-width: 1100px; }

  .stats {
    display: flex;
    gap: 32px;
    justify-content: center;
    margin-bottom: 32px;
  }

  .stat {
    text-align: center;
  }

  .stat .num {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -1px;
    color: var(--text);
  }

  .stat .num.highlight { color: var(--mit-red-glow); }

  .stat .lbl {
    font-size: 9px;
    letter-spacing: 2px;
    color: var(--text-dim);
    margin-top: 4px;
  }

  .controls {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }

  .controls input,
  .controls select {
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
    padding: 8px 12px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
  }

  .controls input {
    flex: 1;
    min-width: 200px;
  }

  .controls input:focus,
  .controls select:focus {
    outline: none;
    border-color: var(--mit-red);
  }

  .controls label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-dim);
    cursor: pointer;
  }

  .controls input[type="checkbox"] {
    min-width: auto;
    flex: none;
    accent-color: var(--mit-red);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  thead th {
    text-align: left;
    padding: 8px 12px;
    font-size: 9px;
    letter-spacing: 2px;
    color: var(--text-dim);
    border-bottom: 1px solid var(--border);
    font-weight: 500;
    cursor: pointer;
    user-select: none;
  }

  thead th:hover { color: var(--text); }

  tbody tr {
    border-bottom: 1px solid var(--border);
    transition: background 0.15s;
  }

  tbody tr:hover { background: var(--surface); }

  td {
    padding: 10px 12px;
    vertical-align: middle;
  }

  .col-number {
    font-weight: 600;
    white-space: nowrap;
    color: var(--accent);
    font-size: 12px;
  }

  .col-name a {
    color: var(--text);
    text-decoration: none;
  }

  .col-name a:hover {
    color: var(--mit-red-glow);
    text-decoration: underline;
  }

  .col-sem {
    color: var(--text-dim);
    font-size: 11px;
    white-space: nowrap;
  }

  .col-videos { text-align: center; }

  .video-badge {
    display: inline-block;
    background: var(--mit-red);
    color: white;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 700;
    min-width: 24px;
    text-align: center;
  }

  .no-videos {
    color: var(--border);
    font-size: 14px;
  }

  .results-count {
    font-size: 12px;
    color: var(--text-dim);
    margin-bottom: 16px;
  }
</style>
</head>
<body>
${navBar('courses')}
<div class="container">
  <header>
    <div class="tag">CATALOG</div>
    <h1>MIT OCW Courses</h1>
    <p class="subtitle">Consolidated view of all indexed courses</p>
  </header>

  <div class="stats">
    <div class="stat">
      <div class="num">${totalInIndex.toLocaleString()}</div>
      <div class="lbl">TOTAL IN INDEX</div>
    </div>
    <div class="stat">
      <div class="num">${courses.length}</div>
      <div class="lbl">SAMPLED</div>
    </div>
    <div class="stat">
      <div class="num highlight">${coursesWithVideos}</div>
      <div class="lbl">WITH VIDEOS</div>
    </div>
    <div class="stat">
      <div class="num highlight">${lectures.length}</div>
      <div class="lbl">TOTAL VIDEOS</div>
    </div>
  </div>

  <div class="controls">
    <input type="text" id="search" placeholder="Search courses..." oninput="filterCourses()">
    <select id="deptFilter" onchange="filterCourses()">
      <option value="">All Departments</option>
      ${deptOptions}
    </select>
    <label>
      <input type="checkbox" id="videoOnly" onchange="filterCourses()">
      Videos only
    </label>
  </div>

  <div class="results-count" id="resultsCount">${courses.length} courses</div>

  <table>
    <thead>
      <tr>
        <th>COURSE</th>
        <th>NAME</th>
        <th>SEMESTER</th>
        <th>VIDEOS</th>
      </tr>
    </thead>
    <tbody id="courseTableBody">
      ${courseRows}
    </tbody>
  </table>

  ${footerHtml()}
</div>
<script>
function filterCourses() {
  const query = document.getElementById('search').value.toLowerCase();
  const dept = document.getElementById('deptFilter').value;
  const videoOnly = document.getElementById('videoOnly').checked;
  const rows = document.querySelectorAll('.course-row');
  let visible = 0;
  rows.forEach(row => {
    const matchSearch = !query || row.dataset.search.includes(query);
    const matchDept = !dept || row.dataset.dept === dept;
    const matchVideo = !videoOnly || row.dataset.hasVideo === '1';
    const show = matchSearch && matchDept && matchVideo;
    row.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  document.getElementById('resultsCount').textContent = visible + ' course' + (visible !== 1 ? 's' : '');
}
</script>
</body>
</html>`
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function extractSemYearFromSlug(slug: string): string {
  const match = slug.match(/(spring|fall|january|summer|iap)-(\d{4})/)
  if (!match) return ''
  return match[1].charAt(0).toUpperCase() + match[1].slice(1) + ' ' + match[2]
}

main()
