## 1. Project Setup

- [ ] 1.1 Clone ghost-tracks repo (`gh repo clone stussysenik/ghost-tracks`)
- [ ] 1.2 Create RedwoodJS app (`yarn create redwood-app ghost-tracks-v3 --ts`)
- [ ] 1.3 Setup Tailwind CSS (`yarn rw setup ui tailwind`)
- [ ] 1.4 Configure Google Maps API key in `.env` and `redwood.toml`
- [ ] 1.5 Install `@vis.gl/react-google-maps` in web workspace
- [ ] 1.6 Create Map ID in Google Cloud Console for AdvancedMarkerElement

## 2. Google Maps Rendering (spec: google-maps-rendering)

- [ ] 2.1 Create `AppLayout` with `<APIProvider>` wrapping the app
- [ ] 2.2 Create `RouteMap` component with `<Map>` and map controls
- [ ] 2.3 Create `RoutePolyline` component (strokeColor #3B82F6, strokeWeight 5)
- [ ] 2.4 Create `WaypointMarkers` component with numbered `<AdvancedMarker>` elements
- [ ] 2.5 Implement `fitBounds()` auto-zoom via `useMap()` hook
- [ ] 2.6 Verify map loads in < 2s, polyline renders correctly

## 3. React Component Port (spec: redwoodjs-scaffold)

- [ ] 3.1 Port `ModeSwitcher` (Svelte → React) for generate/describe toggle
- [ ] 3.2 Port `DescribePanel` with text input, progress indicator, API call
- [ ] 3.3 Port `GeneratePanel` with neighborhood selection, idea cards
- [ ] 3.4 Port `RouteInstructions` with turn-by-turn display
- [ ] 3.5 Port `Toast` notification system
- [ ] 3.6 Create `HomePage` page assembling all components
- [ ] 3.7 Port GPX export utility (`gpx-builder` integration)

## 4. GraphQL API + Python Proxy (spec: redwoodjs-scaffold)

- [ ] 4.1 Create `pythonService.ts` HTTP client in `api/src/lib/`
- [ ] 4.2 Create `ghostRoutes.sdl.ts` GraphQL schema (GhostRoute type, mutations)
- [ ] 4.3 Create `ghostRoutes` service with `describeShape` mutation (proxies to Python)
- [ ] 4.4 Create `ghostRoutes` service with `generateIdeas` mutation (proxies to Python)
- [ ] 4.5 Wire React components to GraphQL mutations
- [ ] 4.6 Verify end-to-end: describe "heart" → Python → route → map rendering

## 5. Google Routes API Migration (spec: google-routes-api)

- [ ] 5.1 Add `google-maps-routing` Python package to backend requirements
- [ ] 5.2 Create `GoogleRoutesClient` class in Python backend wrapping Routes API
- [ ] 5.3 Implement 25-waypoint chunking with parallel `asyncio.gather()` execution
- [ ] 5.4 Replace Mapbox Directions calls in `shape_generator.py` (lines 254-329)
- [ ] 5.5 Replace Mapbox calls in `street_mapper.py`
- [ ] 5.6 Configure `GOOGLE_ROUTES_API_KEY` env var in Python service
- [ ] 5.7 Remove Mapbox token references from Python backend
- [ ] 5.8 Run 5 canonical shapes (heart/star/circle/triangle/square) and compare scores

## 6. Shape Fidelity Improvements (spec: shape-fidelity)

- [ ] 6.1 Increase heart parametric points from 64 → 128 in `shape_templates.py`
- [ ] 6.2 Implement curvature-adaptive densification in `street_mapper.py` (40m/80m/120m)
- [ ] 6.3 Implement post-routing shape correction (targeted segment re-routing)
- [ ] 6.4 Calibrate densify/dedup thresholds for Google Routes API road graph
- [ ] 6.5 Verify heart ≥ 90%, star ≥ 85%, circle ≥ 88% similarity scores
- [ ] 6.6 Verify parallel routing completes in < 5s for a heart shape

## 7. Prisma Data Model (spec: prisma-data-model)

- [ ] 7.1 Write `schema.prisma` with User, City, Neighborhood, GhostRoute, Favorite
- [ ] 7.2 Run initial Prisma migration (`yarn rw prisma migrate dev`)
- [ ] 7.3 Create seed script for Prague neighborhoods (from `prague_neighborhoods.json`)
- [ ] 7.4 Seed 4 additional cities (Berlin, NYC, London, Barcelona)
- [ ] 7.5 Update `ghostRoutes` service to save GhostRoute to database after generation

## 8. Authentication (spec: auth-and-users)

- [ ] 8.1 Setup dbAuth (`yarn rw setup auth dbAuth`)
- [ ] 8.2 Scaffold Login, Signup, ForgotPassword pages
- [ ] 8.3 Add `@requireAuth` directive to save/favorite/share/delete mutations
- [ ] 8.4 Implement guest route generation (no auth required)
- [ ] 8.5 Create `ProfilePage` showing user's saved routes
- [ ] 8.6 Implement favorite toggle mutation and UI
- [ ] 8.7 Implement route sharing via shareSlug URLs
- [ ] 8.8 Create `SharedRoutePage` for public route viewing

## 9. Multi-City Expansion (spec: multi-city)

- [ ] 9.1 Create `CityPicker` component with Google Places Autocomplete
- [ ] 9.2 Create `cities.sdl.ts` and `neighborhoods.sdl.ts` GraphQL schemas
- [ ] 9.3 Implement Places API viewport → bbox conversion in city service
- [ ] 9.4 Implement LLM-based street layout classification with DB caching
- [ ] 9.5 Update Python backend to accept arbitrary bboxes (remove Prague assumptions)
- [ ] 9.6 Verify shape generation works in 5+ cities

## 10. Strava Integration (spec: strava-integration)

- [ ] 10.1 Register Ghost Tracks as Strava API application
- [ ] 10.2 Implement OAuth redirect in `stravaCallback.ts` serverless function
- [ ] 10.3 Implement token exchange and storage on User model
- [ ] 10.4 Implement token auto-refresh (6h expiry check)
- [ ] 10.5 Create "Connect Strava" button on ProfilePage
- [ ] 10.6 Implement GPX upload to Strava (`POST /api/v3/uploads`)
- [ ] 10.7 Store Strava activity ID on GhostRoute after export
- [ ] 10.8 Verify full flow: connect → generate → export → Strava activity created

## 11. Deployment (Railway)

- [ ] 11.1 Create Railway project with 3 services (RedwoodJS, Python, PostgreSQL)
- [ ] 11.2 Configure RedwoodJS service (build: `yarn rw build`, start: `yarn rw serve`)
- [ ] 11.3 Configure Python service (uvicorn from `backend/` directory)
- [ ] 11.4 Set environment variables on all services
- [ ] 11.5 Configure internal networking (`python-service.railway.internal:8000`)
- [ ] 11.6 Deploy and verify end-to-end on Railway

## 12. Polish + Launch Readiness

- [ ] 12.1 Add PWA manifest and service worker
- [ ] 12.2 Add Open Graph meta tags for shared route URLs
- [ ] 12.3 Add rate limiting on generation endpoints
- [ ] 12.4 Add error monitoring (Sentry)
- [ ] 12.5 Run full E2E test suite (Playwright)
- [ ] 12.6 Custom domain + SSL configuration
