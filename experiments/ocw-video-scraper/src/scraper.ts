/**
 * Core scraping engine for MIT OpenCourseWare.
 *
 * Key insight: YouTube IDs are embedded in transcript filenames on resource pages:
 *   /courses/.../3a61f4776e0bfc351c7f8fd88a62cc5c_McyxfIYo4lM.pdf
 * Pattern: _{YouTubeID}.(pdf|srt|vtt) — case-preserved, 11-char base64 IDs.
 *
 * Sitemap URL slugs also contain lowercased YouTube IDs, enabling a zero-fetch heuristic.
 */

import type { Lecture, CourseSitemapEntry } from './types.js'

const OCW_SITEMAP_INDEX = 'https://ocw.mit.edu/sitemap.xml'
const USER_AGENT = 'MITReels-Scraper/1.0 (educational research)'

// ─── HTTP Helpers ───────────────────────────────────────────────────────────

let totalBytesDownloaded = 0
let totalRequestCount = 0

export function resetCounters() {
  totalBytesDownloaded = 0
  totalRequestCount = 0
}

export function getCounters() {
  return { bytesDownloaded: totalBytesDownloaded, requestCount: totalRequestCount }
}

async function fetchText(url: string): Promise<string> {
  totalRequestCount++
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const text = await res.text()
  totalBytesDownloaded += new TextEncoder().encode(text).byteLength
  return text
}

async function fetchTextWithRetry(url: string, retries = 2): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchText(url)
    } catch (err: any) {
      if (attempt === retries) throw err
      const backoff = Math.pow(2, attempt) * 500
      await new Promise(r => setTimeout(r, backoff))
    }
  }
  throw new Error('unreachable')
}

// ─── XML Parsing (lightweight, no deps) ─────────────────────────────────────

function extractXmlTags(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}>([^<]+)</${tag}>`, 'g')
  const results: string[] = []
  let match
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1].trim())
  }
  return results
}

// ─── Sitemap Parsing ────────────────────────────────────────────────────────

export async function fetchSitemapIndex(): Promise<CourseSitemapEntry[]> {
  const xml = await fetchText(OCW_SITEMAP_INDEX)
  const locs = extractXmlTags(xml, 'loc')

  return locs
    .filter(url => url.includes('/courses/') && url.endsWith('/sitemap.xml'))
    .map(sitemapUrl => {
      const courseSlug = sitemapUrl
        .replace('https://ocw.mit.edu/courses/', '')
        .replace('/sitemap.xml', '')
      const parsed = parseCourseSlug(courseSlug)
      return {
        sitemapUrl,
        courseUrl: `https://ocw.mit.edu/courses/${courseSlug}/`,
        courseNumber: parsed.courseNumber,
        courseName: parsed.courseName,
      }
    })
}

function parseCourseSlug(slug: string): { courseNumber: string; courseName: string } {
  // Slug format examples:
  //   "6-006-introduction-to-algorithms-spring-2020"      → 6.006
  //   "21g-341-contemporary-french-film-spring-2014"      → 21G.341
  //   "res-7-005-biology-teaching-fall-2021"               → RES.7.005
  //   "mas-836-sensor-technologies-spring-2011"            → MAS.836
  //   "ec-711-d-lab-schools-spring-2010"                   → EC.711

  // Strip trailing semester-year
  const stripped = slug.replace(/-(spring|fall|january|summer|iap)-\d{4}$/, '')

  // Try to split into course number prefix and name
  // Pattern: one or more alphanumeric segments (joined by -) followed by name words
  // Course number segments are short (1-4 chars) and contain digits or known prefixes
  const parts = stripped.split('-')

  // Find where the course number ends and the name begins
  // Course number parts: digits, or known alpha prefixes (res, mas, ec, wgs, hst, etc.), or single letters (g, j, a)
  let numEnd = 0
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    // Pure digits or short alphanumeric codes (like "006", "7", "341")
    if (/^\d+\w*$/.test(p) && p.length <= 5) {
      numEnd = i + 1
      continue
    }
    // Known department/prefix codes (2-3 letter alpha)
    if (/^[a-z]{1,4}$/i.test(p) && i <= 1) {
      numEnd = i + 1
      continue
    }
    break
  }

  // Need at least 1 number part and 1 name part
  if (numEnd === 0 || numEnd >= parts.length) {
    return { courseNumber: slug, courseName: slug }
  }

  const courseNumber = parts.slice(0, numEnd).join('.').toUpperCase()
  const courseName = parts
    .slice(numEnd)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  return { courseNumber, courseName }
}

export async function fetchCourseSitemap(sitemapUrl: string): Promise<string[]> {
  const xml = await fetchTextWithRetry(sitemapUrl)
  return extractXmlTags(xml, 'loc')
}

// ─── YouTube ID Extraction ──────────────────────────────────────────────────

/**
 * Extract YouTube ID from a resource page's HTML.
 * Looks for transcript/caption filenames: {hash}_{YouTubeID}.(pdf|srt|vtt)
 */
export function extractYoutubeId(html: string): string | null {
  // Primary: transcript/caption filename with case-preserved YouTube ID
  // Pattern: {32-char-hex}_{11-char-ID}.(srt|vtt|webvtt) — captions are video-specific
  const captionMatch = html.match(/[a-f0-9]{32}_([A-Za-z0-9_-]{11})\.(srt|vtt|webvtt)/)
  if (captionMatch && looksLikeYoutubeId(captionMatch[1])) return captionMatch[1]

  // Secondary: transcript PDF with YouTube ID (require mixed case to avoid false positives)
  const transcriptMatch = html.match(/[a-f0-9]{32}_([A-Za-z0-9_-]{11})\.pdf/)
  if (transcriptMatch && looksLikeYoutubeId(transcriptMatch[1])) return transcriptMatch[1]

  // Fallback: YouTube embed iframe
  const iframeMatch = html.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/)
  if (iframeMatch) return iframeMatch[1]

  // Fallback: youtube.com/watch link
  const watchMatch = html.match(/youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/)
  if (watchMatch) return watchMatch[1]

  return null
}

/**
 * Validate a candidate string looks like a YouTube ID, not a filename.
 * Real YouTube IDs are base64url encoded — they have mixed case and digits.
 * File names like "302pre_test" or "tunnelingpc" are human-readable lowercase.
 */
function looksLikeYoutubeId(candidate: string): boolean {
  const hasUpper = /[A-Z]/.test(candidate)
  const hasLower = /[a-z]/.test(candidate)
  const hasDigit = /\d/.test(candidate)
  const hasSpecial = /[_-]/.test(candidate)

  // Mixed case = very likely YouTube ID
  if (hasUpper && hasLower) return true
  if (hasUpper && hasDigit) return true

  // Reject obvious human-readable filenames
  if (/^[a-z]+\d*_[a-z]+/.test(candidate)) return false  // word_word
  if (/^\d+[a-z]+_/.test(candidate)) return false          // 302pre_
  if (/^[a-z]{6,}$/.test(candidate)) return false          // pure long lowercase word

  // All-lowercase but has digits AND special chars = likely YouTube ID (base64url)
  if (hasLower && hasDigit && hasSpecial) return true

  // Has 3+ digits mixed in = likely YouTube ID, not filename
  if (hasDigit && (candidate.match(/\d/g) || []).length >= 3) return true

  return false
}

/**
 * Extract YouTube ID from a sitemap URL slug (lowercased).
 * Used by the sitemap-heuristic variant.
 *
 * URL pattern: /resources/{slug}/ or /resources/{slug}-2/
 * Where slug might be a lowercased 11-char YouTube ID.
 *
 * Real YouTube IDs (lowercased): "mcyxfiyo4lm", "17vftjvgbly", "4_tngskfxes"
 * False positives to reject: "assignments", "302pre_test", "10-01s20-th"
 */
export function extractYoutubeIdFromSlug(resourceUrl: string): string | null {
  // Match exactly 11-char slugs (with optional -2 suffix for OCW dedup)
  const match = resourceUrl.match(/\/resources\/([a-z0-9_-]{11})(?:-\d+)?\/?\s*$/)
  if (!match) return null

  const candidate = match[1]

  // YouTube IDs are base64url: [A-Za-z0-9_-]. When lowercased, they're dense
  // alphanumeric strings — NOT readable English words.
  // Heuristics to filter false positives:

  // 1. Must contain at least 3 digits (YouTube IDs are dense alphanumeric)
  const digitCount = (candidate.match(/\d/g) || []).length
  if (digitCount < 3) return null

  // 2. Reject if it contains dashes in word-boundary positions (course codes, human slugs)
  //    YouTube IDs can have dashes but randomly, not as word separators
  if (candidate.split('-').length > 2) return null

  // 3. Reject word_number or name+number patterns (author references, file IDs)
  //    e.g. "duran87_119", "fraser37_66", "302pre_test"
  if (/^[a-z]+\d+_\d+$/.test(candidate)) return null
  if (/^\d+[a-z]+_/.test(candidate)) return null
  if (/^[a-z]+\d+_[a-z]+/.test(candidate)) return null

  // 4. Reject common resource names that happen to be 11 chars
  const reject = /^(assignments|information|description|examination|performance|connections|composition|instruments|programming|environment|engineering|definitions|observation|compression|derivatives|preparation)$/
  if (reject.test(candidate)) return null

  return candidate
}

// ─── Metadata Extraction ────────────────────────────────────────────────────

export function extractTitle(html: string): string {
  const match = html.match(/<title>([^<]+)<\/title>/)
  if (!match) return 'Unknown'
  // OCW titles: "Video Title | Course Name | MIT OpenCourseWare"
  return match[1].split('|')[0].trim()
}

function extractDepartment(html: string): string {
  const match = html.match(/department["\s:]+([^"<,]+)/i)
  return match ? match[1].trim() : ''
}

function extractSemesterYear(courseSlug: string): { semester: string; year: number } {
  const match = courseSlug.match(/(spring|fall|january|summer|iap)-(\d{4})/)
  if (!match) return { semester: '', year: 0 }
  return {
    semester: match[1].charAt(0).toUpperCase() + match[1].slice(1),
    year: parseInt(match[2], 10),
  }
}

// ─── Full Page Scrape ───────────────────────────────────────────────────────

export async function scrapeResourcePage(
  url: string,
  courseEntry: CourseSitemapEntry
): Promise<Lecture | null> {
  try {
    const html = await fetchTextWithRetry(url)
    const youtubeId = extractYoutubeId(html)
    if (!youtubeId) return null

    const courseSlug = courseEntry.courseUrl
      .replace('https://ocw.mit.edu/courses/', '')
      .replace(/\/$/, '')
    const { semester, year } = extractSemesterYear(courseSlug)

    return {
      title: extractTitle(html),
      youtubeId,
      courseNumber: courseEntry.courseNumber,
      courseName: courseEntry.courseName,
      department: extractDepartment(html),
      semester,
      year,
      ocwUrl: url,
      topicName: '',
    }
  } catch {
    return null
  }
}

// ─── Batch Fetching ─────────────────────────────────────────────────────────

/**
 * Process URLs in batches with controlled concurrency.
 * Maps directly to Swift's TaskGroup pattern.
 */
export async function batchProcess<T, R>(
  items: T[],
  concurrency: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchResults = await Promise.allSettled(batch.map(processor))

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      }
    }
  }

  return results
}

/**
 * Filter resource URLs to likely video pages (skip pages/, lists/, etc.)
 */
export function filterVideoResourceUrls(urls: string[]): string[] {
  return urls.filter(url => {
    if (!url.includes('/resources/')) return false
    // Skip gallery/index pages
    if (url.includes('video_galleries') || url.includes('video-galleries')) return false
    if (url.endsWith('/resources/') || url.endsWith('/resources')) return false
    return true
  })
}
