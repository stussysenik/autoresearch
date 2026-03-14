/**
 * Phase 4: Interactive Dashboard Generator
 *
 * Reads scored prompts from data/results.json, pre-computes 10 aggregation
 * objects (~2KB total JSON), and emits a self-contained dashboard.html with
 * Chart.js loaded from CDN. No raw prompt data in the HTML — only aggregated
 * numbers.
 *
 * Charts:
 *  1. Grade Distribution (Doughnut)
 *  2. Score Distribution (Bar histogram)
 *  3. Dimension Radar (Spider chart)
 *  4. Benchmark Comparison (Grouped bar)
 *  5. Monthly Trend (Line chart)
 *  6. Hourly Performance (Bar chart)
 *  7. Top Projects (Horizontal bar)
 *  8. Anti-pattern Frequency (Horizontal bar)
 *  9. Prompt Type Mix (Pie chart)
 * 10. Day of Week (Bar chart)
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import type { ScoredPrompt } from "./scoring";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function projectName(fullPath: string): string {
  const parts = fullPath.split("/");
  return parts[parts.length - 1] || fullPath;
}

function assignGradeFromAvg(avg: number): string {
  if (avg >= 78) return "A+";
  if (avg >= 72) return "A";
  if (avg >= 66) return "A-";
  if (avg >= 60) return "B+";
  if (avg >= 55) return "B";
  if (avg >= 50) return "B-";
  if (avg >= 47) return "C+";
  if (avg >= 44) return "C";
  if (avg >= 41) return "C-";
  if (avg >= 38) return "D+";
  if (avg >= 35) return "D";
  if (avg >= 30) return "D-";
  return "F";
}

function percentile(sorted: number[], p: number): number {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function classifyPromptType(text: string): string {
  const firstWord = text.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") || "";
  if (["fix", "debug", "resolve", "diagnose", "troubleshoot"].includes(firstWord)) return "fix/debug";
  if (["implement", "build", "add", "create", "write", "generate", "make"].includes(firstWord)) return "implement/build";
  if (["review", "analyze", "check", "examine", "investigate", "explain", "read", "show", "search", "find", "look"].includes(firstWord)) return "review/analyze";
  if (["run", "test", "execute", "start", "deploy"].includes(firstWord)) return "run/test";
  if (["update", "modify", "change", "refactor", "rename", "move", "replace", "remove", "delete"].includes(firstWord)) return "update/modify";
  return "other";
}

// ─── Aggregation Types ────────────────────────────────────────────────────────

interface Summary {
  totalPrompts: number;
  avgComposite: number;
  medianComposite: number;
  p90: number;
  p10: number;
  overallGrade: string;
  projects: number;
  dateRange: [string, string];
}

interface GradeData {
  labels: string[];
  counts: number[];
}

interface HistogramData {
  labels: string[];
  counts: number[];
}

interface DimensionData {
  labels: string[];
  yours: number[];
  benchmark: number[];
}

interface MonthlyData {
  labels: string[];
  scores: number[];
  counts: number[];
}

interface HourlyData {
  labels: string[];
  scores: number[];
  counts: number[];
}

interface ProjectData {
  labels: string[];
  scores: number[];
  counts: number[];
}

interface AntiPatternData {
  labels: string[];
  counts: number[];
  percentages: number[];
}

interface PromptTypeData {
  labels: string[];
  counts: number[];
  scores: number[];
}

interface DayOfWeekData {
  labels: string[];
  scores: number[];
  counts: number[];
}

// ─── Aggregation Functions ────────────────────────────────────────────────────

function computeSummary(prompts: ScoredPrompt[]): Summary {
  const composites = prompts.map((p) => p.composite);
  const avg = composites.reduce((a, b) => a + b, 0) / composites.length;
  const sorted = [...composites].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const timestamps = prompts.map((p) => p.timestamp).sort((a, b) => a - b);

  return {
    totalPrompts: prompts.length,
    avgComposite: Math.round(avg * 10) / 10,
    medianComposite: Math.round(median * 10) / 10,
    p90: Math.round(percentile(sorted, 90) * 10) / 10,
    p10: Math.round(percentile(sorted, 10) * 10) / 10,
    overallGrade: assignGradeFromAvg(avg),
    projects: new Set(prompts.map((p) => p.project)).size,
    dateRange: [
      new Date(timestamps[0]).toISOString().split("T")[0],
      new Date(timestamps[timestamps.length - 1]).toISOString().split("T")[0],
    ],
  };
}

function computeGrades(prompts: ScoredPrompt[]): GradeData {
  const gradeOrder = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F"];
  const counts: Record<string, number> = {};
  for (const p of prompts) counts[p.grade] = (counts[p.grade] || 0) + 1;

  const labels: string[] = [];
  const values: number[] = [];
  for (const g of gradeOrder) {
    if (counts[g]) {
      labels.push(g);
      values.push(counts[g]);
    }
  }
  return { labels, counts: values };
}

function computeHistogram(prompts: ScoredPrompt[]): HistogramData {
  const buckets = new Array(10).fill(0);
  for (const p of prompts) {
    const idx = Math.min(Math.floor(p.composite / 10), 9);
    buckets[idx]++;
  }
  return {
    labels: ["0-9", "10-19", "20-29", "30-39", "40-49", "50-59", "60-69", "70-79", "80-89", "90-100"],
    counts: buckets,
  };
}

function computeDimensions(prompts: ScoredPrompt[]): DimensionData {
  const n = prompts.length;
  const withSession = prompts.filter((p) => p.scores.toolLeverage !== null);
  const nSession = withSession.length;

  const avgSpec = prompts.reduce((s, p) => s + p.scores.specificity, 0) / n;
  const avgAction = prompts.reduce((s, p) => s + p.scores.actionDensity, 0) / n;
  const avgContext = prompts.reduce((s, p) => s + p.scores.contextLoading, 0) / n;
  const avgIter = prompts.reduce((s, p) => s + p.scores.iterationPattern, 0) / n;
  const avgCompound = prompts.reduce((s, p) => s + p.scores.compoundEfficiency, 0) / n;
  const avgTool = nSession > 0 ? withSession.reduce((s, p) => s + (p.scores.toolLeverage ?? 0), 0) / nSession : 0;
  const avgOutcome = nSession > 0 ? withSession.reduce((s, p) => s + (p.scores.outcomeSignal ?? 0), 0) / nSession : 0;

  return {
    labels: ["Specificity", "Action Density", "Context Loading", "Iteration", "Compound Eff.", "Tool Leverage", "Outcome Signal"],
    yours: [avgSpec, avgAction, avgContext, avgIter, avgCompound, avgTool, avgOutcome].map((v) => Math.round(v * 10) / 10),
    benchmark: [85, 78, 80, 75, 72, 82, 90],
  };
}

function computeMonthly(prompts: ScoredPrompt[]): MonthlyData {
  const monthly = new Map<string, number[]>();
  for (const p of prompts) {
    const month = new Date(p.timestamp).toISOString().substring(0, 7);
    if (!monthly.has(month)) monthly.set(month, []);
    monthly.get(month)!.push(p.composite);
  }

  const entries = [...monthly.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return {
    labels: entries.map(([m]) => m),
    scores: entries.map(([, s]) => Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10),
    counts: entries.map(([, s]) => s.length),
  };
}

function computeHourly(prompts: ScoredPrompt[]): HourlyData {
  const hourly = new Map<number, number[]>();
  for (const p of prompts) {
    const hour = new Date(p.timestamp).getHours();
    if (!hourly.has(hour)) hourly.set(hour, []);
    hourly.get(hour)!.push(p.composite);
  }

  const labels: string[] = [];
  const scores: number[] = [];
  const counts: number[] = [];
  for (let h = 0; h < 24; h++) {
    labels.push(`${String(h).padStart(2, "0")}:00`);
    const vals = hourly.get(h) || [];
    scores.push(vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0);
    counts.push(vals.length);
  }
  return { labels, scores, counts };
}

function computeProjects(prompts: ScoredPrompt[]): ProjectData {
  const byProject = new Map<string, number[]>();
  for (const p of prompts) {
    const name = projectName(p.project);
    if (!byProject.has(name)) byProject.set(name, []);
    byProject.get(name)!.push(p.composite);
  }

  const filtered = [...byProject.entries()]
    .filter(([, s]) => s.length >= 5)
    .map(([name, s]) => ({
      name,
      avg: Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10,
      count: s.length,
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 15);

  return {
    labels: filtered.map((p) => p.name),
    scores: filtered.map((p) => p.avg),
    counts: filtered.map((p) => p.count),
  };
}

function computeAntiPatterns(prompts: ScoredPrompt[]): AntiPatternData {
  const freq: Record<string, number> = {};
  for (const p of prompts) {
    for (const ap of p.antiPatterns) {
      freq[ap.name] = (freq[ap.name] || 0) + 1;
    }
  }

  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  return {
    labels: sorted.map(([name]) => name),
    counts: sorted.map(([, count]) => count),
    percentages: sorted.map(([, count]) => Math.round((count / prompts.length) * 1000) / 10),
  };
}

function computePromptTypes(prompts: ScoredPrompt[]): PromptTypeData {
  const groups: Record<string, { count: number; totalScore: number }> = {};
  for (const p of prompts) {
    const type = classifyPromptType(p.text);
    if (!groups[type]) groups[type] = { count: 0, totalScore: 0 };
    groups[type].count++;
    groups[type].totalScore += p.composite;
  }

  const sorted = Object.entries(groups).sort((a, b) => b[1].count - a[1].count);
  return {
    labels: sorted.map(([type]) => type),
    counts: sorted.map(([, g]) => g.count),
    scores: sorted.map(([, g]) => Math.round((g.totalScore / g.count) * 10) / 10),
  };
}

function computeDayOfWeek(prompts: ScoredPrompt[]): DayOfWeekData {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const daily = new Map<number, number[]>();
  for (const p of prompts) {
    const day = new Date(p.timestamp).getDay();
    if (!daily.has(day)) daily.set(day, []);
    daily.get(day)!.push(p.composite);
  }

  const labels: string[] = [];
  const scores: number[] = [];
  const counts: number[] = [];
  for (let d = 0; d < 7; d++) {
    labels.push(dayNames[d]);
    const vals = daily.get(d) || [];
    scores.push(vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0);
    counts.push(vals.length);
  }
  return { labels, scores, counts };
}

// ─── HTML Template ────────────────────────────────────────────────────────────

function generateHTML(
  summary: Summary,
  grades: GradeData,
  histogram: HistogramData,
  dimensions: DimensionData,
  monthly: MonthlyData,
  hourly: HourlyData,
  projects: ProjectData,
  antiPatterns: AntiPatternData,
  promptTypes: PromptTypeData,
  dayOfWeek: DayOfWeekData
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Prompt Performance Dashboard</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"><\/script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0d1117;
    color: #c9d1d9;
    padding: 24px;
    min-height: 100vh;
  }
  h1 { color: #f0f6fc; font-size: 28px; margin-bottom: 8px; }
  .subtitle { color: #8b949e; font-size: 14px; margin-bottom: 24px; }
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
    margin-bottom: 24px;
  }
  .stat-card {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 16px;
    text-align: center;
  }
  .stat-value {
    font-size: 28px;
    font-weight: 700;
    color: #58a6ff;
  }
  .stat-value.grade { color: #3fb950; font-size: 32px; }
  .stat-label {
    font-size: 12px;
    color: #8b949e;
    margin-top: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .charts-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
  @media (max-width: 768px) {
    .charts-grid { grid-template-columns: 1fr; }
    body { padding: 12px; }
    h1 { font-size: 22px; }
  }
  .chart-card {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 20px;
  }
  .chart-card.tall { grid-row: span 2; }
  .chart-card h2 {
    font-size: 15px;
    color: #f0f6fc;
    margin-bottom: 16px;
    font-weight: 600;
  }
  .chart-container {
    position: relative;
    width: 100%;
  }
  footer {
    text-align: center;
    color: #484f58;
    font-size: 12px;
    margin-top: 32px;
    padding-top: 16px;
    border-top: 1px solid #21262d;
  }
</style>
</head>
<body>
<h1>Prompt Performance Dashboard</h1>
<p class="subtitle">
  ${summary.totalPrompts.toLocaleString()} prompts &middot;
  ${summary.projects} projects &middot;
  ${summary.dateRange[0]} &rarr; ${summary.dateRange[1]}
</p>

<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-value">${summary.totalPrompts.toLocaleString()}</div>
    <div class="stat-label">Total Prompts</div>
  </div>
  <div class="stat-card">
    <div class="stat-value grade">${summary.overallGrade}</div>
    <div class="stat-label">Overall Grade</div>
  </div>
  <div class="stat-card">
    <div class="stat-value">${summary.avgComposite}</div>
    <div class="stat-label">Avg Score</div>
  </div>
  <div class="stat-card">
    <div class="stat-value">${summary.medianComposite}</div>
    <div class="stat-label">Median</div>
  </div>
  <div class="stat-card">
    <div class="stat-value">${summary.p90}</div>
    <div class="stat-label">P90</div>
  </div>
  <div class="stat-card">
    <div class="stat-value">${summary.p10}</div>
    <div class="stat-label">P10</div>
  </div>
</div>

<div class="charts-grid">
  <!-- 1. Grade Distribution -->
  <div class="chart-card">
    <h2>Grade Distribution</h2>
    <div class="chart-container"><canvas id="gradeChart"></canvas></div>
  </div>

  <!-- 2. Score Histogram -->
  <div class="chart-card">
    <h2>Score Distribution</h2>
    <div class="chart-container"><canvas id="histogramChart"></canvas></div>
  </div>

  <!-- 3. Dimension Radar -->
  <div class="chart-card">
    <h2>Dimension Profile vs Benchmark</h2>
    <div class="chart-container"><canvas id="radarChart"></canvas></div>
  </div>

  <!-- 4. Benchmark Comparison -->
  <div class="chart-card">
    <h2>Benchmark Gap Analysis</h2>
    <div class="chart-container"><canvas id="benchmarkChart"></canvas></div>
  </div>

  <!-- 5. Monthly Trend -->
  <div class="chart-card">
    <h2>Monthly Trend</h2>
    <div class="chart-container"><canvas id="monthlyChart"></canvas></div>
  </div>

  <!-- 6. Hourly Performance -->
  <div class="chart-card">
    <h2>Performance by Hour</h2>
    <div class="chart-container"><canvas id="hourlyChart"></canvas></div>
  </div>

  <!-- 7. Top Projects -->
  <div class="chart-card tall">
    <h2>Top Projects (min 5 prompts)</h2>
    <div class="chart-container" style="height:100%"><canvas id="projectChart"></canvas></div>
  </div>

  <!-- 8. Anti-patterns -->
  <div class="chart-card tall">
    <h2>Anti-pattern Frequency</h2>
    <div class="chart-container" style="height:100%"><canvas id="antiPatternChart"></canvas></div>
  </div>

  <!-- 9. Prompt Type Mix -->
  <div class="chart-card">
    <h2>Prompt Type Mix</h2>
    <div class="chart-container"><canvas id="promptTypeChart"></canvas></div>
  </div>

  <!-- 10. Day of Week -->
  <div class="chart-card">
    <h2>Performance by Day of Week</h2>
    <div class="chart-container"><canvas id="dayOfWeekChart"></canvas></div>
  </div>
</div>

<footer>
  Generated ${new Date().toISOString().split("T")[0]} &middot; Heuristic analysis &mdash; no LLM calls
</footer>

<script>
// ─── Data (pre-aggregated) ──────────────────────────────────────────────────

const grades = ${JSON.stringify(grades)};
const histogram = ${JSON.stringify(histogram)};
const dimensions = ${JSON.stringify(dimensions)};
const monthly = ${JSON.stringify(monthly)};
const hourly = ${JSON.stringify(hourly)};
const projects = ${JSON.stringify(projects)};
const antiPatterns = ${JSON.stringify(antiPatterns)};
const promptTypes = ${JSON.stringify(promptTypes)};
const dayOfWeek = ${JSON.stringify(dayOfWeek)};

// ─── Theme ──────────────────────────────────────────────────────────────────

Chart.defaults.color = '#8b949e';
Chart.defaults.borderColor = '#30363d';
Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const gradeColors = {
  'A+': '#2ea043', 'A': '#3fb950', 'A-': '#56d364',
  'B+': '#1f6feb', 'B': '#388bfd', 'B-': '#58a6ff',
  'C+': '#d29922', 'C': '#e3b341', 'C-': '#f0c84d',
  'D+': '#da3633', 'D': '#f85149', 'D-': '#ff7b72',
  'F': '#484f58'
};

const accent = '#58a6ff';
const accentAlt = '#3fb950';
const chartBg = 'rgba(88, 166, 255, 0.15)';
const chartBorder = 'rgba(88, 166, 255, 0.8)';

// ─── 1. Grade Doughnut ──────────────────────────────────────────────────────

new Chart(document.getElementById('gradeChart'), {
  type: 'doughnut',
  data: {
    labels: grades.labels,
    datasets: [{
      data: grades.counts,
      backgroundColor: grades.labels.map(g => gradeColors[g] || '#484f58'),
      borderWidth: 0,
      hoverOffset: 8
    }]
  },
  options: {
    responsive: true,
    plugins: {
      legend: { position: 'right', labels: { padding: 12, usePointStyle: true, pointStyle: 'circle' } },
      tooltip: {
        callbacks: {
          label: ctx => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct = ((ctx.parsed / total) * 100).toFixed(1);
            return \` \${ctx.label}: \${ctx.parsed} (\${pct}%)\`;
          }
        }
      }
    }
  }
});

// ─── 2. Score Histogram ─────────────────────────────────────────────────────

new Chart(document.getElementById('histogramChart'), {
  type: 'bar',
  data: {
    labels: histogram.labels,
    datasets: [{
      label: 'Prompts',
      data: histogram.counts,
      backgroundColor: chartBg,
      borderColor: chartBorder,
      borderWidth: 1,
      borderRadius: 4
    }]
  },
  options: {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, grid: { color: '#21262d' } }
    }
  }
});

// ─── 3. Dimension Radar ─────────────────────────────────────────────────────

new Chart(document.getElementById('radarChart'), {
  type: 'radar',
  data: {
    labels: dimensions.labels,
    datasets: [
      {
        label: 'Your Average',
        data: dimensions.yours,
        backgroundColor: 'rgba(88, 166, 255, 0.2)',
        borderColor: accent,
        borderWidth: 2,
        pointBackgroundColor: accent,
        pointRadius: 4
      },
      {
        label: 'Top 0.01%',
        data: dimensions.benchmark,
        backgroundColor: 'rgba(63, 185, 80, 0.1)',
        borderColor: accentAlt,
        borderWidth: 2,
        borderDash: [5, 5],
        pointBackgroundColor: accentAlt,
        pointRadius: 3
      }
    ]
  },
  options: {
    responsive: true,
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        ticks: { stepSize: 20, backdropColor: 'transparent' },
        grid: { color: '#21262d' },
        angleLines: { color: '#21262d' },
        pointLabels: { font: { size: 11 } }
      }
    },
    plugins: {
      legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true } }
    }
  }
});

// ─── 4. Benchmark Grouped Bar ───────────────────────────────────────────────

new Chart(document.getElementById('benchmarkChart'), {
  type: 'bar',
  data: {
    labels: dimensions.labels,
    datasets: [
      {
        label: 'Your Average',
        data: dimensions.yours,
        backgroundColor: 'rgba(88, 166, 255, 0.6)',
        borderColor: accent,
        borderWidth: 1,
        borderRadius: 4
      },
      {
        label: 'Top 0.01%',
        data: dimensions.benchmark,
        backgroundColor: 'rgba(63, 185, 80, 0.3)',
        borderColor: accentAlt,
        borderWidth: 1,
        borderRadius: 4
      }
    ]
  },
  options: {
    responsive: true,
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, max: 100, grid: { color: '#21262d' } }
    },
    plugins: {
      legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true } },
      tooltip: {
        callbacks: {
          afterLabel: ctx => {
            if (ctx.datasetIndex === 0) {
              const gap = dimensions.benchmark[ctx.dataIndex] - ctx.parsed.y;
              return gap > 0 ? \`Gap: \${gap.toFixed(1)} pts\` : 'At or above benchmark';
            }
            return '';
          }
        }
      }
    }
  }
});

// ─── 5. Monthly Trend ───────────────────────────────────────────────────────

new Chart(document.getElementById('monthlyChart'), {
  type: 'line',
  data: {
    labels: monthly.labels,
    datasets: [{
      label: 'Avg Composite',
      data: monthly.scores,
      borderColor: accent,
      backgroundColor: chartBg,
      borderWidth: 2,
      fill: true,
      tension: 0.3,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: accent
    }]
  },
  options: {
    responsive: true,
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: '#21262d' } }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          afterLabel: ctx => \`Prompts: \${monthly.counts[ctx.dataIndex]}\`
        }
      }
    }
  }
});

// ─── 6. Hourly Performance ──────────────────────────────────────────────────

new Chart(document.getElementById('hourlyChart'), {
  type: 'bar',
  data: {
    labels: hourly.labels,
    datasets: [{
      label: 'Avg Score',
      data: hourly.scores,
      backgroundColor: hourly.scores.map(s =>
        s === 0 ? 'transparent' :
        s >= 55 ? 'rgba(63, 185, 80, 0.5)' :
        s >= 45 ? 'rgba(88, 166, 255, 0.5)' :
        'rgba(210, 153, 34, 0.5)'
      ),
      borderColor: hourly.scores.map(s =>
        s === 0 ? 'transparent' :
        s >= 55 ? '#3fb950' :
        s >= 45 ? accent :
        '#d29922'
      ),
      borderWidth: 1,
      borderRadius: 3
    }]
  },
  options: {
    responsive: true,
    scales: {
      x: { grid: { display: false }, ticks: { maxRotation: 45, font: { size: 10 } } },
      y: { beginAtZero: true, grid: { color: '#21262d' } }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          afterLabel: ctx => \`Prompts: \${hourly.counts[ctx.dataIndex]}\`
        }
      }
    }
  }
});

// ─── 7. Top Projects ────────────────────────────────────────────────────────

new Chart(document.getElementById('projectChart'), {
  type: 'bar',
  data: {
    labels: projects.labels,
    datasets: [{
      label: 'Avg Score',
      data: projects.scores,
      backgroundColor: projects.scores.map(s =>
        s >= 55 ? 'rgba(63, 185, 80, 0.5)' :
        s >= 45 ? 'rgba(88, 166, 255, 0.5)' :
        'rgba(210, 153, 34, 0.5)'
      ),
      borderColor: projects.scores.map(s =>
        s >= 55 ? '#3fb950' :
        s >= 45 ? accent :
        '#d29922'
      ),
      borderWidth: 1,
      borderRadius: 4
    }]
  },
  options: {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { beginAtZero: true, max: 80, grid: { color: '#21262d' } },
      y: { grid: { display: false }, ticks: { font: { size: 11 } } }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          afterLabel: ctx => \`Prompts: \${projects.counts[ctx.dataIndex]}\`
        }
      }
    }
  }
});

// ─── 8. Anti-patterns ───────────────────────────────────────────────────────

new Chart(document.getElementById('antiPatternChart'), {
  type: 'bar',
  data: {
    labels: antiPatterns.labels,
    datasets: [{
      label: 'Occurrences',
      data: antiPatterns.counts,
      backgroundColor: 'rgba(248, 81, 73, 0.4)',
      borderColor: '#f85149',
      borderWidth: 1,
      borderRadius: 4
    }]
  },
  options: {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { beginAtZero: true, grid: { color: '#21262d' } },
      y: { grid: { display: false }, ticks: { font: { size: 11 } } }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          afterLabel: ctx => \`\${antiPatterns.percentages[ctx.dataIndex]}% of prompts\`
        }
      }
    }
  }
});

// ─── 9. Prompt Type Pie ─────────────────────────────────────────────────────

const typeColors = ['#58a6ff', '#3fb950', '#d29922', '#f85149', '#bc8cff', '#484f58'];
new Chart(document.getElementById('promptTypeChart'), {
  type: 'pie',
  data: {
    labels: promptTypes.labels,
    datasets: [{
      data: promptTypes.counts,
      backgroundColor: typeColors.slice(0, promptTypes.labels.length),
      borderWidth: 0,
      hoverOffset: 8
    }]
  },
  options: {
    responsive: true,
    plugins: {
      legend: { position: 'right', labels: { padding: 10, usePointStyle: true, pointStyle: 'circle', font: { size: 11 } } },
      tooltip: {
        callbacks: {
          label: ctx => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct = ((ctx.parsed / total) * 100).toFixed(1);
            const avgScore = promptTypes.scores[ctx.dataIndex];
            return \` \${ctx.label}: \${ctx.parsed} (\${pct}%) — avg \${avgScore}\`;
          }
        }
      }
    }
  }
});

// ─── 10. Day of Week ────────────────────────────────────────────────────────

new Chart(document.getElementById('dayOfWeekChart'), {
  type: 'bar',
  data: {
    labels: dayOfWeek.labels,
    datasets: [{
      label: 'Avg Score',
      data: dayOfWeek.scores,
      backgroundColor: dayOfWeek.scores.map(s =>
        s === 0 ? 'transparent' :
        s >= 55 ? 'rgba(63, 185, 80, 0.5)' :
        s >= 45 ? 'rgba(88, 166, 255, 0.5)' :
        'rgba(210, 153, 34, 0.5)'
      ),
      borderColor: dayOfWeek.scores.map(s =>
        s === 0 ? 'transparent' :
        s >= 55 ? '#3fb950' :
        s >= 45 ? accent :
        '#d29922'
      ),
      borderWidth: 1,
      borderRadius: 4
    }]
  },
  options: {
    responsive: true,
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, grid: { color: '#21262d' } }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          afterLabel: ctx => \`Prompts: \${dayOfWeek.counts[ctx.dataIndex]}\`
        }
      }
    }
  }
});
<\/script>
</body>
</html>`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const inputPath = resolve(import.meta.dir, "..", "data", "results.json");
  console.log(`Reading ${inputPath}...`);

  const prompts: ScoredPrompt[] = JSON.parse(readFileSync(inputPath, "utf-8"));
  console.log(`Loaded ${prompts.length} scored prompts`);

  // Compute all aggregations
  const summary = computeSummary(prompts);
  const grades = computeGrades(prompts);
  const hist = computeHistogram(prompts);
  const dimensions = computeDimensions(prompts);
  const monthly = computeMonthly(prompts);
  const hourly = computeHourly(prompts);
  const projects = computeProjects(prompts);
  const antiPatterns = computeAntiPatterns(prompts);
  const promptTypes = computePromptTypes(prompts);
  const dayOfWeek = computeDayOfWeek(prompts);

  console.log(`\nAggregations computed:`);
  console.log(`  Grades: ${grades.labels.length} categories`);
  console.log(`  Monthly: ${monthly.labels.length} months`);
  console.log(`  Projects: ${projects.labels.length} (min 5 prompts)`);
  console.log(`  Anti-patterns: ${antiPatterns.labels.length} types`);
  console.log(`  Prompt types: ${promptTypes.labels.length} categories`);

  // Generate HTML
  const html = generateHTML(summary, grades, hist, dimensions, monthly, hourly, projects, antiPatterns, promptTypes, dayOfWeek);

  const outPath = resolve(import.meta.dir, "..", "dashboard.html");
  writeFileSync(outPath, html);

  console.log(`\nDashboard written to ${outPath}`);
  console.log(`  File size: ${(html.length / 1024).toFixed(1)} KB`);
  console.log(`  Open in browser: file://${outPath}`);
}

main();
