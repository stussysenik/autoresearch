/**
 * Test Server
 *
 * Serves built HTML files via Bun.serve() for Playwright to test against.
 * Zero external dependencies — uses Bun's built-in HTTP server.
 *
 * Each variant gets its own server instance that serves the built HTML at `/`.
 * The server is started before tests run and stopped immediately after.
 *
 * Why Bun.serve? It's already available (we run on Bun), starts instantly,
 * and needs zero configuration. No express, no http-server, no deps.
 */

/**
 * Start an HTTP server that serves a single HTML file at every route.
 *
 * @param htmlPath - Path to the HTML file to serve
 * @param port - Port to listen on (default: 3000, matching playwright.config.ts baseURL)
 * @returns Server handle with .stop() for cleanup
 *
 * @example
 *   const server = startTestServer('data/results/login-card-all_16.html')
 *   // ... run Playwright tests against http://localhost:3000 ...
 *   server.stop()
 */
export function startTestServer(htmlPath: string, port = 3000) {
  const file = Bun.file(htmlPath)

  const server = Bun.serve({
    port,
    async fetch() {
      const html = await file.text()
      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    },
  })

  console.log(`  Test server started at http://localhost:${port} (serving ${htmlPath})`)
  return server
}
