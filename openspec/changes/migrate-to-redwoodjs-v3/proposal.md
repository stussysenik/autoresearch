## Why

Ghost Tracks is a Strava art route planner built on SvelteKit + Python FastAPI + Mapbox. The current architecture lacks stability: no database, no auth, no ORM, Prague-only, and a split-runtime that's hard to deploy. Shape similarity scores (~87%) need improvement — hearts and complex curves aren't precise enough. Migrating to RedwoodJS provides a unified full-stack framework with Prisma, GraphQL, and built-in auth, while switching to Google Maps Platform opens worldwide expansion and improved route quality.

## What Changes

- **BREAKING** Replace SvelteKit frontend with RedwoodJS (React + GraphQL + Prisma)
- **BREAKING** Replace Mapbox GL JS with Google Maps JavaScript API for map rendering
- **BREAKING** Replace Mapbox Directions API with Google Routes API for street-snapping
- Add PostgreSQL database via Prisma ORM for persistent storage
- Add user accounts with dbAuth (email/password)
- Add saved routes, favorites, and route sharing via slug URLs
- Add multi-city support via Google Places API (worldwide, not just Prague)
- Add Strava OAuth integration for direct GPX export to Strava
- Improve shape fidelity: 128-point heart curves, curvature-adaptive densification, parallel chunk routing, post-routing correction
- Keep Python FastAPI microservice for shape generation pipeline (DSPy + LLM + validation)
- Deploy both services on Railway with internal networking

## Capabilities

### New Capabilities
- `redwoodjs-scaffold`: RedwoodJS full-stack app with React frontend, GraphQL API, Prisma ORM, Tailwind CSS, and project structure conventions
- `google-maps-rendering`: Google Maps JavaScript API integration using `@vis.gl/react-google-maps` for map rendering, polylines, markers, and map controls
- `google-routes-api`: Google Routes API (WALK mode) replacing Mapbox Directions for street-snapping with parallel chunk routing
- `shape-fidelity`: Improved parametric templates (128-point hearts), curvature-adaptive densification, post-routing shape correction, and validation calibration (heart ≥ 90%)
- `prisma-data-model`: PostgreSQL schema with User, City, Neighborhood, GhostRoute, and Favorite models via Prisma
- `auth-and-users`: dbAuth authentication, user accounts, saved routes, favorites, route sharing via slug URLs
- `multi-city`: Worldwide city/neighborhood support via Google Places Autocomplete with LLM-based street layout classification
- `strava-integration`: Strava OAuth "link account" flow, GPX export to Strava, token management with auto-refresh

### Modified Capabilities
<!-- No existing specs to modify — this is a greenfield OpenSpec project -->

## Impact

- **Frontend**: Complete rewrite from Svelte 5 to React (6 components + 5 pages)
- **API layer**: SvelteKit API routes replaced by RedwoodJS GraphQL services
- **Python backend**: Minimal changes — swap Mapbox API calls for Google Routes API in `shape_generator.py` and `street_mapper.py`
- **Database**: New PostgreSQL instance (Railway managed) — no existing data to migrate
- **Dependencies**: Remove `mapbox-gl`, `@types/mapbox-gl`, SvelteKit packages. Add `@vis.gl/react-google-maps`, `@redwoodjs/*`, `@prisma/client`
- **Environment**: New env vars: `DATABASE_URL`, `GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_MAP_ID`, `STRAVA_CLIENT_ID/SECRET`, `SESSION_SECRET`. Remove `VITE_MAPBOX_ACCESS_TOKEN`, `MAPBOX_ACCESS_TOKEN`
- **Deployment**: Move from Vercel (frontend) + Docker (backend) to Railway (3 services: RedwoodJS + Python + PostgreSQL)
