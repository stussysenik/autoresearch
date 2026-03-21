## ADDED Requirements

### Requirement: Google Routes API Replaces Mapbox Directions API

The street-snapping layer SHALL use the Google Routes API (`computeRoutes` endpoint) for all route computation. The Mapbox Directions API MUST NOT be used. All route requests SHALL be made to `https://routes.googleapis.com/directions/v2:computeRoutes`.

#### Scenario: Walking mode route returns coordinates

WHEN a route request is submitted with an origin and destination
THEN the Google Routes API SHALL return a response containing routed coordinates
AND the response SHALL include polyline geometry, distance, and duration

### Requirement: Walking Travel Mode

All route requests SHALL use the `WALK` travel mode. The system MUST NOT use `DRIVE`, `BICYCLE`, or `TRANSIT` modes for GhostRoute generation, as routes are designed for pedestrian navigation.

#### Scenario: Walking mode is enforced

WHEN a route request is constructed
THEN the `travelMode` field SHALL be set to `WALK`
AND the returned route SHALL follow pedestrian-accessible paths

### Requirement: 25 Intermediate Waypoints Per Request with Chunking

Each Google Routes API request supports a maximum of 25 intermediate waypoints. For routes with more than 25 waypoints, the system SHALL chunk the waypoints into multiple requests, each containing at most 25 intermediates plus origin and destination.

#### Scenario: Route with 60 waypoints chunks into 3 parallel requests

WHEN a route with 60 intermediate waypoints is requested
THEN the system SHALL split the waypoints into 3 chunks (25 + 25 + 10 intermediates)
AND each chunk SHALL have its origin set to the previous chunk's last waypoint
AND the final assembled route SHALL be a continuous path through all 60 waypoints

### Requirement: Parallel Chunk Execution

When a route requires multiple chunks, all chunk requests SHALL be executed in parallel using `asyncio.gather()`. The system MUST NOT execute chunk requests sequentially.

#### Scenario: Parallel routing completes efficiently

WHEN a chunked route request with 3 chunks is executed
THEN all 3 API calls SHALL be dispatched concurrently via `asyncio.gather()`
AND the total wall-clock time SHALL be approximately equal to the slowest single chunk, not the sum of all chunks

### Requirement: Field Masks Limit Response Size

All Routes API requests SHALL include a field mask header (`X-Goog-FieldMask`) to limit the response to only required fields: `routes.polyline`, `routes.distanceMeters`, and `routes.duration`. Unnecessary fields MUST NOT be requested.

#### Scenario: Field masks reduce payload

WHEN a route request is sent to the Google Routes API
THEN the `X-Goog-FieldMask` header SHALL be set to `routes.polyline,routes.distanceMeters,routes.duration`
AND the response SHALL NOT contain unrequested fields such as `routes.legs.steps`

### Requirement: GEO_JSON_LINESTRING Polyline Encoding

Route requests SHALL specify `GEO_JSON_LINESTRING` as the polyline encoding type. This provides direct coordinate extraction from the response without requiring encoded polyline decoding.

#### Scenario: GeoJSON coordinates are directly extractable

WHEN the route response is received with `GEO_JSON_LINESTRING` encoding
THEN the polyline field SHALL contain a GeoJSON LineString with an array of `[longitude, latitude]` coordinate pairs
AND no additional polyline decoding step SHALL be required
