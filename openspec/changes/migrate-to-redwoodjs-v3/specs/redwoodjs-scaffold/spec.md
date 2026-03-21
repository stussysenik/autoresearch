## ADDED Requirements

### Requirement: RedwoodJS TypeScript Application

The application SHALL be scaffolded as a RedwoodJS TypeScript project with a React frontend and a GraphQL API layer. The frontend MUST use React components and the API MUST expose a GraphQL endpoint backed by RedwoodJS services.

#### Scenario: App scaffolded and runs

WHEN the developer runs `yarn rw dev`
THEN the RedwoodJS development server SHALL start successfully
AND the React frontend SHALL be accessible at `http://localhost:8910`
AND the GraphQL API SHALL be accessible at `http://localhost:8911/graphql`

### Requirement: Tailwind CSS Styling

The application SHALL use Tailwind CSS as its primary styling framework. Tailwind MUST be configured and operational in the RedwoodJS web side.

#### Scenario: Tailwind works

WHEN a component uses Tailwind utility classes (e.g., `className="bg-blue-500 text-white p-4"`)
THEN the styles SHALL be correctly applied and visible in the rendered output
AND the Tailwind configuration file SHALL exist at `web/config/tailwind.config.js`

### Requirement: RedwoodJS Project Structure Conventions

The project structure MUST follow RedwoodJS conventions with the following top-level directories:
- `web/` for the React frontend (pages, components, layouts)
- `api/` for the GraphQL API (services, SDL definitions)
- `api/db/` for Prisma schema and migrations

#### Scenario: Project structure follows conventions

WHEN the project is inspected
THEN `web/src/pages/` SHALL contain page components
AND `api/src/graphql/` SHALL contain SDL schema definitions
AND `api/src/services/` SHALL contain service implementations
AND `api/db/schema.prisma` SHALL contain the Prisma data model

### Requirement: GhostRoute Naming Convention

The GraphQL schema MUST use the "GhostRoute" naming convention throughout, not "Route". All SDL types, queries, mutations, and service files SHALL reference "GhostRoute" to avoid confusion with navigation routing concepts.

#### Scenario: GraphQL endpoint responds with GhostRoute types

WHEN a client sends a GraphQL query `{ ghostRoutes { id } }`
THEN the API SHALL respond with a valid JSON payload containing GhostRoute records
AND the SDL type SHALL be named `GhostRoute`, not `Route`
AND the service file SHALL be named `ghostRoutes.ts`
