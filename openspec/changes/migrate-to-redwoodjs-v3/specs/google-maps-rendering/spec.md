## ADDED Requirements

### Requirement: Google Maps JavaScript API via @vis.gl/react-google-maps

The map rendering layer SHALL use the Google Maps JavaScript API through the `@vis.gl/react-google-maps` React library. The application MUST NOT use Mapbox GL JS or any other mapping library for primary map display.

#### Scenario: Map loads in under 2 seconds

WHEN the map component mounts on a page with a valid Google Maps API key
THEN the Google Map SHALL render within 2 seconds of component mount
AND the map SHALL display a fully interactive tile-based map

### Requirement: WebGL GPU-Accelerated Tile Rendering

The map MUST render with WebGL, providing O(1) GPU-accelerated tile rendering. The Google Maps JavaScript API's default WebGL renderer SHALL be used for performant map display.

#### Scenario: Map renders with WebGL

WHEN the map is loaded in a WebGL-capable browser
THEN the map tiles SHALL be GPU-accelerated via the WebGL rendering pipeline
AND map panning and zooming SHALL maintain smooth frame rates

### Requirement: Route Polyline Display

Routes SHALL be displayed as `google.maps.Polyline` objects with the following visual properties:
- `strokeColor`: `#3B82F6` (Tailwind blue-500)
- `strokeWeight`: `5`

#### Scenario: Polyline renders route coordinates

WHEN a GhostRoute with routed coordinates is displayed on the map
THEN a `google.maps.Polyline` SHALL render along the route path
AND the polyline strokeColor SHALL be `#3B82F6`
AND the polyline strokeWeight SHALL be `5`

### Requirement: Waypoint Markers via AdvancedMarkerElement

Waypoints SHALL be displayed as `AdvancedMarkerElement` instances with numbered circle markers. Each marker MUST show its sequential position number within the route.

#### Scenario: Markers show waypoint numbers

WHEN a route with 5 waypoints is displayed
THEN 5 `AdvancedMarkerElement` markers SHALL appear on the map
AND each marker SHALL display its sequential number (1 through 5) inside a circle

### Requirement: Auto-Zoom to Route Bounds

The map SHALL automatically zoom to fit the entire route within the viewport using `fitBounds()`. When a route is loaded or updated, the map MUST adjust its center and zoom level to encompass all route coordinates.

#### Scenario: fitBounds zooms to route

WHEN a GhostRoute is rendered on the map
THEN the map SHALL call `fitBounds()` with the bounding box of the route coordinates
AND the entire route SHALL be visible within the map viewport with appropriate padding

### Requirement: Map ID for AdvancedMarkerElement Support

A Google Maps Map ID MUST be configured to enable `AdvancedMarkerElement` support. The Map ID SHALL be provided via the `GOOGLE_MAPS_MAP_ID` environment variable and passed to the Map component.

#### Scenario: Map ID enables advanced markers

WHEN the map component is initialized with a valid Map ID
THEN `AdvancedMarkerElement` instances SHALL render correctly on the map
AND the Map ID SHALL be sourced from the `GOOGLE_MAPS_MAP_ID` environment variable
