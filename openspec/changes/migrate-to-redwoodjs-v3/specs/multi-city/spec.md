## ADDED Requirements

### Requirement: Google Places Autocomplete for City/Neighborhood Search

The application SHALL use Google Places Autocomplete to provide real-time search suggestions for cities and neighborhoods. The CityPicker component MUST replace the static NeighborhoodPicker dropdown used in the previous implementation.

#### Scenario: User types city name and gets autocomplete suggestions

WHEN a user types "Barcelona" into the CityPicker search field
THEN the Google Places Autocomplete API SHALL return matching suggestions
AND the suggestions SHALL include "Barcelona, Spain" as a result
AND results SHALL appear within 300ms of the last keystroke (debounced)

### Requirement: Places API Returns Center Coordinates and Viewport BBox

When a place is selected from the autocomplete results, the Places API SHALL return:
- Center coordinates (latitude and longitude) for the selected location
- Viewport bounding box for determining the map view

These values SHALL be used to position the map and constrain route generation to the selected area.

#### Scenario: Selecting neighborhood returns center and bbox

WHEN a user selects "Eixample" from the Barcelona neighborhood suggestions
THEN the Places API SHALL return center coordinates for Eixample
AND the Places API SHALL return a viewport bounding box
AND the map SHALL reposition to show the selected neighborhood

### Requirement: LLM-Based Street Layout Classification

For neighborhoods not yet classified in the database, the system SHALL use an LLM to determine the street layout type (e.g., "grid", "organic", "radial", "mixed"). The classification result MUST be cached in the Neighborhood database record to avoid repeated LLM calls for the same neighborhood.

#### Scenario: LLM classifies street layout on first visit and caches it

WHEN a user selects a neighborhood that has no `streetLayout` value in the database
THEN the system SHALL invoke an LLM to classify the neighborhood's street layout
AND the classification SHALL be stored in the Neighborhood record's `streetLayout` field
WHEN the same neighborhood is selected again
THEN the cached `streetLayout` value SHALL be returned without invoking the LLM

### Requirement: Prague Neighborhoods Seeded as Initial Data

Prague neighborhoods SHALL be pre-seeded in the database as initial seed data. The seed data MUST include neighborhood names, street layout classifications, and `goodFor` tags so that Prague is fully functional without requiring any API calls on first use.

#### Scenario: Prague neighborhoods available without API call

WHEN a user selects Prague as their city
THEN the neighborhood list SHALL be populated from the seeded database records
AND no Google Places API call SHALL be required to list Prague neighborhoods
AND each neighborhood SHALL have a pre-populated `streetLayout` and `goodFor` tags

### Requirement: CityPicker Component Replaces Static Dropdown

The CityPicker component SHALL replace the previous static NeighborhoodPicker dropdown. The new component MUST support:
- Free-text search with Google Places Autocomplete
- Display of city and neighborhood results
- Selection that triggers map repositioning and neighborhood data loading

#### Scenario: CityPicker replaces NeighborhoodPicker

WHEN the route generation page is loaded
THEN the CityPicker component SHALL be rendered (not the static NeighborhoodPicker)
AND the CityPicker SHALL accept free-text input
AND selecting a result SHALL update the map view and available neighborhoods

### Requirement: Minimum 5 Cities Supported at Launch

The system SHALL support at least 5 cities at launch: Prague, Berlin, New York City, London, and Barcelona. Support means that a user can search for the city, select a neighborhood, and generate a route within that city.

#### Scenario: All launch cities are functional

WHEN a user searches for each of Prague, Berlin, New York City, London, and Barcelona
THEN each city SHALL appear in the autocomplete results
AND selecting each city SHALL allow neighborhood selection
AND route generation SHALL succeed within each city's boundaries
