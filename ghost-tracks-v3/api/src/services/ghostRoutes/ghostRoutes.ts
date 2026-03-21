import type { QueryResolvers, MutationResolvers } from 'types/graphql'
import { db } from 'src/lib/db'
import { describeShape as callDescribe, generateIdeas as callGenerate, checkFeasibility as callFeasibility } from 'src/lib/pythonService'

export const ghostRoute: QueryResolvers['ghostRoute'] = async ({ id }) => {
  const route = await db.ghostRoute.findUnique({ where: { id } })
  if (!route) throw new Error('Route not found')

  return {
    ...route,
    routedCoordinates: JSON.parse(route.routedCoordinates),
    controlPoints: route.controlPoints ? JSON.parse(route.controlPoints) : null,
    bbox: JSON.parse(route.bbox),
    waypoints: route.waypoints ? JSON.parse(route.waypoints) : null,
    shapeDifficulty: 'moderate',
    neighborhood: 'Prague',
    alternativeNeighborhoods: [],
  }
}

export const ghostRouteBySlug: QueryResolvers['ghostRouteBySlug'] = async ({ slug }) => {
  const route = await db.ghostRoute.findUnique({ where: { shareSlug: slug } })
  if (!route) throw new Error('Route not found')

  return {
    ...route,
    routedCoordinates: JSON.parse(route.routedCoordinates),
    controlPoints: route.controlPoints ? JSON.parse(route.controlPoints) : null,
    bbox: JSON.parse(route.bbox),
    waypoints: route.waypoints ? JSON.parse(route.waypoints) : null,
    shapeDifficulty: 'moderate',
    neighborhood: 'Prague',
    alternativeNeighborhoods: [],
  }
}

export const describeShape: MutationResolvers['describeShape'] = async ({
  description,
  neighborhood,
  maxDistanceKm,
}) => {
  // Call Python microservice
  const result = await callDescribe({
    description,
    neighborhood: neighborhood || undefined,
    max_distance_km: maxDistanceKm || undefined,
  })

  // Save to database (with cityId=1 as default Prague)
  // Ensure Prague city exists first
  let city = await db.city.findFirst({ where: { name: 'Prague' } })
  if (!city) {
    city = await db.city.create({
      data: {
        name: 'Prague',
        country: 'Czech Republic',
        countryCode: 'CZ',
        center: JSON.stringify({ lng: 14.4378, lat: 50.0755 }),
        bbox: JSON.stringify({ minLng: 14.2, minLat: 49.95, maxLng: 14.7, maxLat: 50.15 }),
      },
    })
  }

  const route = await db.ghostRoute.create({
    data: {
      shapeName: result.shape.name,
      shapeEmoji: result.shape.emoji,
      shapeDescription: result.shape.description,
      routedCoordinates: JSON.stringify(result.routed_coordinates),
      controlPoints: result.shape.control_points
        ? JSON.stringify(result.shape.control_points)
        : null,
      bbox: JSON.stringify(result.bbox),
      distanceKm: result.distance_km,
      durationMinutes: result.duration_minutes,
      similarityScore: result.similarity_score,
      waypoints: JSON.stringify(result.waypoints),
      cityId: city.id,
    },
  })

  return {
    ...route,
    routedCoordinates: result.routed_coordinates,
    controlPoints: result.shape.control_points || null,
    bbox: result.bbox,
    waypoints: result.waypoints,
    shapeDifficulty: result.shape.difficulty,
    neighborhood: result.neighborhood,
    alternativeNeighborhoods: result.alternative_neighborhoods || [],
  }
}

export const generateIdeas: MutationResolvers['generateIdeas'] = async ({
  neighborhood,
  count,
}) => {
  const result = await callGenerate({
    neighborhood,
    count: count || 3,
  })

  return {
    ideas: result.ideas.map((idea) => ({
      name: idea.name,
      description: idea.description,
      emoji: idea.emoji,
      estimatedDistanceKm: idea.estimated_distance_km,
      difficulty: idea.difficulty,
      controlPoints: idea.control_points,
      targetArea: idea.target_area,
    })),
    neighborhood: result.neighborhood,
    bbox: result.bbox,
  }
}

export const checkFeasibility: MutationResolvers['checkFeasibility'] = async ({
  description,
  centerLng,
  centerLat,
  radiusKm,
}) => {
  const result = await callFeasibility({
    description,
    center: { lng: centerLng, lat: centerLat },
    radius_km: radiusKm || undefined,
  })

  return {
    feasible: result.feasible,
    score: result.score,
    breakdown: {
      hausdorff: result.breakdown.hausdorff,
      orderedSampling: result.breakdown.ordered_sampling,
      rasterIou: result.breakdown.raster_iou,
    },
    nearestAlternatives: (result.nearest_alternatives || []).map((alt: any) => ({
      name: alt.name,
      score: alt.score,
      distanceKm: alt.distance_km,
      feasible: alt.feasible,
    })),
    otherCities: (result.other_cities || []).map((city: any) => ({
      city: city.city,
      neighborhood: city.neighborhood,
      score: city.score,
      feasible: city.feasible,
    })),
  }
}
