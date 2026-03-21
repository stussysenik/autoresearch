## ADDED Requirements

### Requirement: PostgreSQL Database via Prisma ORM

The application SHALL use PostgreSQL as its primary database, accessed exclusively through Prisma ORM. The Prisma schema MUST be defined in `api/db/schema.prisma` and the database connection SHALL be configured via the `DATABASE_URL` environment variable.

#### Scenario: Database connection established

WHEN the application starts with a valid `DATABASE_URL`
THEN Prisma SHALL connect to the PostgreSQL database
AND `yarn rw prisma migrate dev` SHALL apply all migrations successfully

### Requirement: User Model

The User model SHALL contain the following fields:
- `id` (primary key)
- `email` (unique, required)
- `hashedPassword` (required)
- `salt` (required)
- Strava OAuth tokens: `stravaAccessToken`, `stravaRefreshToken`, `stravaTokenExpiry`
- Timestamps: `createdAt`, `updatedAt`

#### Scenario: Create user with email and password

WHEN a new User is created with email `ghost@example.com` and a hashed password
THEN the User record SHALL be persisted in the database
AND querying by email `ghost@example.com` SHALL return the created user
AND the `hashedPassword` and `salt` fields SHALL be populated

### Requirement: City Model

The City model SHALL contain the following fields:
- `id` (primary key)
- `name` (required)
- `country` (required)
- `center` (JSON, storing `{ lat, lng }` coordinates)
- `bbox` (JSON, storing bounding box coordinates)
- Timestamps: `createdAt`, `updatedAt`

The City model SHALL have a one-to-many relationship with Neighborhood.

#### Scenario: City stores center and bounding box

WHEN a City "Prague" is created with center `{ "lat": 50.0755, "lng": 14.4378 }` and a bbox
THEN the City record SHALL be persisted with the JSON fields intact
AND querying the City SHALL return the center and bbox as JSON objects

### Requirement: Neighborhood Model

The Neighborhood model SHALL contain the following fields:
- `id` (primary key)
- `name` (required)
- `streetLayout` (string, e.g., "grid", "organic", "radial")
- `goodFor` (JSON array of tags, e.g., `["hearts", "stars"]`)
- `cityId` (foreign key linking to City)
- Timestamps: `createdAt`, `updatedAt`

#### Scenario: Neighborhood linked to city

WHEN a Neighborhood "Vinohrady" is created with `cityId` pointing to Prague
THEN the Neighborhood record SHALL reference the Prague City record
AND querying Prague's neighborhoods SHALL include Vinohrady
AND the `streetLayout` field SHALL store the classification string

### Requirement: GhostRoute Model

The GhostRoute model SHALL contain the following fields:
- `id` (primary key)
- `name` (required)
- `shapeType` (string, e.g., "heart", "star", "circle")
- `routedCoordinates` (JSON, array of `[lng, lat]` pairs)
- `controlPoints` (JSON, array of control point coordinates)
- `bbox` (JSON, bounding box of the route)
- `metrics` (JSON, containing distance, duration, fidelity scores)
- `shareSlug` (unique, optional, for shareable URLs)
- `userId` (foreign key linking to User, optional for guest-generated routes)
- `cityId` (foreign key linking to City)
- `neighborhoodId` (foreign key linking to Neighborhood, optional)
- Timestamps: `createdAt`, `updatedAt`

#### Scenario: Create GhostRoute linked to city

WHEN a GhostRoute "Heart in Vinohrady" is created with routed coordinates and linked to a User and City
THEN the GhostRoute record SHALL be persisted with all JSON fields intact
AND the `userId` and `cityId` foreign keys SHALL reference valid records

#### Scenario: Share route via slug

WHEN a GhostRoute is assigned a `shareSlug` of `heart-vinohrady-abc123`
THEN querying by `shareSlug` SHALL return the corresponding GhostRoute
AND the `shareSlug` SHALL be unique across all GhostRoute records

### Requirement: Favorite Model as Join Table

The Favorite model SHALL serve as a join table between User and GhostRoute with the following fields:
- `id` (primary key)
- `userId` (foreign key linking to User)
- `ghostRouteId` (foreign key linking to GhostRoute)
- `createdAt` timestamp

A unique constraint MUST exist on the combination of `userId` and `ghostRouteId` to prevent duplicate favorites.

#### Scenario: Add and remove favorite

WHEN a User favorites a GhostRoute
THEN a Favorite record SHALL be created linking the User and GhostRoute
AND attempting to favorite the same GhostRoute again SHALL be rejected by the unique constraint
WHEN the User unfavorites the GhostRoute
THEN the Favorite record SHALL be deleted

#### Scenario: Query routes by user

WHEN a query requests all GhostRoutes for a specific User
THEN the result SHALL include all GhostRoutes where `userId` matches the queried User
AND the query SHALL be efficient due to the index on `userId`

### Requirement: Database Indexes

The following indexes SHALL be defined for query performance:
- Index on `GhostRoute.userId` for querying routes by user
- Index on `GhostRoute.shareSlug` for slug-based lookups
- Index on `GhostRoute.cityId` for querying routes by city
- Unique index on `Favorite(userId, ghostRouteId)` for the composite constraint

#### Scenario: Indexes exist on key fields

WHEN the Prisma schema is inspected
THEN `GhostRoute` SHALL have indexes on `userId`, `shareSlug`, and `cityId`
AND `Favorite` SHALL have a unique composite index on `userId` and `ghostRouteId`
