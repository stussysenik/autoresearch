/**
 * Core types for the OCW Video Scraper experiment.
 * Lecture shape matches mit-ocw-reels seed_data.json exactly.
 */

export interface Lecture {
  title: string
  youtubeId: string
  courseNumber: string
  courseName: string
  department: string
  semester: string
  year: number
  ocwUrl: string
  topicName: string
}

export interface Metrics {
  variantName: string
  wallClockMs: number
  requestCount: number
  videosFound: number
  errorsCount: number
  throughput: number // videos/sec
  bytesDownloaded: number
}

export interface CourseSitemapEntry {
  courseUrl: string
  sitemapUrl: string
  courseNumber: string
  courseName: string
}

export interface VariantResult {
  variant: string
  lectures: Lecture[]
  metrics: Metrics
}

export interface ExperimentInput {
  sitemapIndex: CourseSitemapEntry[]
  sampleSize: number
}
