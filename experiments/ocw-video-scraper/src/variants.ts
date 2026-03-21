/**
 * 4 scraping strategy variants, benchmarked head-to-head.
 *
 * Each variant takes a list of course sitemap entries and returns
 * discovered lectures + timing metrics. All share the same core
 * scraper utilities — the difference is concurrency strategy.
 */

import type { Lecture, Metrics, CourseSitemapEntry, VariantResult } from './types.js'
import {
  fetchCourseSitemap,
  scrapeResourcePage,
  filterVideoResourceUrls,
  extractYoutubeIdFromSlug,
  batchProcess,
  resetCounters,
  getCounters,
} from './scraper.js'

// ─── Variant Runner Type ────────────────────────────────────────────────────

type VariantRunner = (courses: CourseSitemapEntry[]) => Promise<VariantResult>

// ─── V1: Sequential (Baseline) ─────────────────────────────────────────────

const sequential: VariantRunner = async (courses) => {
  resetCounters()
  const start = performance.now()
  const lectures: Lecture[] = []
  let errors = 0

  for (const course of courses) {
    try {
      const urls = await fetchCourseSitemap(course.sitemapUrl)
      const resourceUrls = filterVideoResourceUrls(urls)

      for (const url of resourceUrls) {
        const lecture = await scrapeResourcePage(url, course)
        if (lecture) lectures.push(lecture)
      }
    } catch {
      errors++
    }
  }

  const wallClockMs = performance.now() - start
  const { bytesDownloaded, requestCount } = getCounters()

  return {
    variant: 'sequential',
    lectures: dedup(lectures),
    metrics: {
      variantName: 'sequential',
      wallClockMs,
      requestCount,
      videosFound: dedup(lectures).length,
      errorsCount: errors,
      throughput: dedup(lectures).length / (wallClockMs / 1000),
      bytesDownloaded,
    },
  }
}

// ─── V2: Parallel-8 (Conservative Concurrency) ─────────────────────────────

const parallel8: VariantRunner = async (courses) => {
  return parallelVariant(courses, 8, 'parallel-8')
}

// ─── V3: Parallel-32 (Aggressive Concurrency) ──────────────────────────────

const parallel32: VariantRunner = async (courses) => {
  return parallelVariant(courses, 32, 'parallel-32')
}

async function parallelVariant(
  courses: CourseSitemapEntry[],
  concurrency: number,
  name: string
): Promise<VariantResult> {
  resetCounters()
  const start = performance.now()
  let errors = 0

  // Phase 1: Fetch all course sitemaps in parallel
  const courseSitemaps = await batchProcess(courses, concurrency, async (course) => {
    try {
      const urls = await fetchCourseSitemap(course.sitemapUrl)
      return { course, urls: filterVideoResourceUrls(urls) }
    } catch {
      errors++
      return { course, urls: [] as string[] }
    }
  })

  // Phase 2: Flatten all resource URLs and scrape in parallel
  const allResources = courseSitemaps.flatMap(({ course, urls }) =>
    urls.map(url => ({ url, course }))
  )

  const lectures = await batchProcess(allResources, concurrency, async ({ url, course }) => {
    try {
      return await scrapeResourcePage(url, course)
    } catch {
      errors++
      return null
    }
  })

  const valid = lectures.filter((l): l is Lecture => l !== null)
  const deduped = dedup(valid)
  const wallClockMs = performance.now() - start
  const { bytesDownloaded, requestCount } = getCounters()

  return {
    variant: name,
    lectures: deduped,
    metrics: {
      variantName: name,
      wallClockMs,
      requestCount,
      videosFound: deduped.length,
      errorsCount: errors,
      throughput: deduped.length / (wallClockMs / 1000),
      bytesDownloaded,
    },
  }
}

// ─── V4: Sitemap-Heuristic (Zero Page Fetches) ─────────────────────────────

const sitemapHeuristic: VariantRunner = async (courses) => {
  resetCounters()
  const start = performance.now()
  let errors = 0
  const lectures: Lecture[] = []

  // Fetch course sitemaps in parallel (32 concurrency — sitemaps are small XML)
  const courseSitemaps = await batchProcess(courses, 32, async (course) => {
    try {
      const urls = await fetchCourseSitemap(course.sitemapUrl)
      return { course, urls }
    } catch {
      errors++
      return { course, urls: [] as string[] }
    }
  })

  // Extract YouTube IDs from URL slugs — NO individual page fetches
  for (const { course, urls } of courseSitemaps) {
    const resourceUrls = filterVideoResourceUrls(urls)
    const courseSlug = course.courseUrl
      .replace('https://ocw.mit.edu/courses/', '')
      .replace(/\/$/, '')
    const semYear = extractSemesterYearFromSlug(courseSlug)

    for (const url of resourceUrls) {
      const youtubeId = extractYoutubeIdFromSlug(url)
      if (youtubeId) {
        // Extract a readable title from the URL slug
        const slug = url.match(/\/resources\/([^/]+)\/?$/)?.[1] || ''
        lectures.push({
          title: slug, // lowercased slug as title (can be enriched later)
          youtubeId, // lowercased — trade-off for speed
          courseNumber: course.courseNumber,
          courseName: course.courseName,
          department: '',
          semester: semYear.semester,
          year: semYear.year,
          ocwUrl: url,
          topicName: '',
        })
      }
    }
  }

  const deduped = dedup(lectures)
  const wallClockMs = performance.now() - start
  const { bytesDownloaded, requestCount } = getCounters()

  return {
    variant: 'sitemap-heuristic',
    lectures: deduped,
    metrics: {
      variantName: 'sitemap-heuristic',
      wallClockMs,
      requestCount,
      videosFound: deduped.length,
      errorsCount: errors,
      throughput: deduped.length / (wallClockMs / 1000),
      bytesDownloaded,
    },
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function dedup(lectures: Lecture[]): Lecture[] {
  const seen = new Set<string>()
  return lectures.filter(l => {
    const key = l.youtubeId.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function extractSemesterYearFromSlug(slug: string): { semester: string; year: number } {
  const match = slug.match(/(spring|fall|january|summer|iap)-(\d{4})/)
  if (!match) return { semester: '', year: 0 }
  return {
    semester: match[1].charAt(0).toUpperCase() + match[1].slice(1),
    year: parseInt(match[2], 10),
  }
}

// ─── Export ─────────────────────────────────────────────────────────────────

export const variants: Record<string, VariantRunner> = {
  sequential,
  'parallel-8': parallel8,
  'parallel-32': parallel32,
  'sitemap-heuristic': sitemapHeuristic,
}

export const variantDescriptions: Record<string, string> = {
  sequential: 'Baseline — one request at a time, no concurrency',
  'parallel-8': 'Conservative — 8 concurrent requests per batch',
  'parallel-32': 'Aggressive — 32 concurrent requests with retry backoff',
  'sitemap-heuristic': 'Zero page fetches — extract YouTube IDs from URL slugs only',
}
