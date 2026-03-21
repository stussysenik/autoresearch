export const schema = gql`
  type ShapeInfo {
    name: String!
    emoji: String!
    description: String
    difficulty: String!
    estimatedDistanceKm: Float
    targetArea: String
  }

  type WaypointInfo {
    index: Int!
    lng: Float!
    lat: Float!
    instruction: String!
  }

  type BboxInfo {
    minLng: Float!
    minLat: Float!
    maxLng: Float!
    maxLat: Float!
  }

  type GhostRoute {
    id: String!
    shapeName: String!
    shapeEmoji: String!
    shapeDescription: String
    shapeDifficulty: String!
    routedCoordinates: JSON!
    controlPoints: JSON
    bbox: JSON!
    distanceKm: Float!
    durationMinutes: Int!
    similarityScore: Float
    waypoints: JSON
    neighborhood: String!
    alternativeNeighborhoods: [String!]
    shareSlug: String
    isPublic: Boolean!
    createdAt: DateTime!
  }

  type ShapeIdeaType {
    name: String!
    description: String!
    emoji: String!
    estimatedDistanceKm: Float!
    difficulty: String!
    controlPoints: JSON!
    targetArea: String!
  }

  type GenerateIdeasResponse {
    ideas: [ShapeIdeaType!]!
    neighborhood: String!
    bbox: JSON!
  }

  type Query {
    ghostRoute(id: String!): GhostRoute @skipAuth
    ghostRouteBySlug(slug: String!): GhostRoute @skipAuth
  }

  type ScoreBreakdown {
    hausdorff: Float!
    orderedSampling: Float!
    rasterIou: Float!
  }

  type AlternativeLocation {
    name: String!
    score: Float!
    distanceKm: Float!
    feasible: Boolean!
  }

  type CityResult {
    city: String!
    neighborhood: String!
    score: Float!
    feasible: Boolean!
  }

  type FeasibilityResult {
    feasible: Boolean!
    score: Float!
    breakdown: ScoreBreakdown!
    nearestAlternatives: [AlternativeLocation!]!
    otherCities: [CityResult!]!
  }

  type Mutation {
    describeShape(
      description: String!
      neighborhood: String
      maxDistanceKm: Float
    ): GhostRoute! @skipAuth

    generateIdeas(
      neighborhood: String!
      count: Int
    ): GenerateIdeasResponse! @skipAuth

    checkFeasibility(
      description: String!
      centerLng: Float!
      centerLat: Float!
      radiusKm: Float
    ): FeasibilityResult! @skipAuth
  }
`
