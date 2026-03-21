// Mock the Python service
jest.mock('src/lib/pythonService', () => ({
  describeShape: jest.fn(),
  generateIdeas: jest.fn(),
  healthCheck: jest.fn(),
}))

// Mock Prisma
jest.mock('src/lib/db', () => ({
  db: {
    ghostRoute: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    city: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}))

import { ghostRoute, ghostRouteBySlug, describeShape, generateIdeas } from './ghostRoutes'
import { db } from 'src/lib/db'
import {
  describeShape as callDescribe,
  generateIdeas as callGenerate,
} from 'src/lib/pythonService'

const mockedDb = db as jest.Mocked<typeof db>
const mockedCallDescribe = callDescribe as jest.MockedFunction<typeof callDescribe>
const mockedCallGenerate = callGenerate as jest.MockedFunction<typeof callGenerate>

describe('ghostRoutes service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('ghostRoute query', () => {
    it('returns a route by ID with parsed JSON fields', async () => {
      const mockRoute = {
        id: 'test-123',
        shapeName: 'Heart',
        shapeEmoji: '❤️',
        shapeDescription: 'A heart shape',
        routedCoordinates: '[[14.43, 50.07], [14.44, 50.08]]',
        controlPoints: '[[14.43, 50.07]]',
        bbox: '{"minLng": 14.4, "minLat": 50.0, "maxLng": 14.5, "maxLat": 50.1}',
        distanceKm: 3.5,
        durationMinutes: 42,
        similarityScore: 87.5,
        waypoints:
          '[{"index": 1, "lng": 14.43, "lat": 50.07, "instruction": "Start here"}]',
        userId: null,
        cityId: 1,
        neighborhoodId: null,
        shareSlug: null,
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockedDb.ghostRoute.findUnique as jest.Mock).mockResolvedValue(mockRoute)

      const result = await ghostRoute({ id: 'test-123' })

      expect(mockedDb.ghostRoute.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-123' },
      })
      expect(result.shapeName).toBe('Heart')
      expect(result.routedCoordinates).toEqual([
        [14.43, 50.07],
        [14.44, 50.08],
      ])
    })

    it('throws when route is not found', async () => {
      ;(mockedDb.ghostRoute.findUnique as jest.Mock).mockResolvedValue(null)

      await expect(ghostRoute({ id: 'nonexistent' })).rejects.toThrow(
        'Route not found'
      )
    })
  })

  describe('ghostRouteBySlug query', () => {
    it('queries by shareSlug', async () => {
      const mockRoute = {
        id: 'test-456',
        shapeName: 'Star',
        shapeEmoji: '⭐',
        shapeDescription: null,
        routedCoordinates: '[[14.43, 50.07]]',
        controlPoints: null,
        bbox: '{"minLng": 14.4, "minLat": 50.0, "maxLng": 14.5, "maxLat": 50.1}',
        distanceKm: 2.0,
        durationMinutes: 24,
        similarityScore: 85.0,
        waypoints: null,
        userId: null,
        cityId: 1,
        neighborhoodId: null,
        shareSlug: 'abc123',
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockedDb.ghostRoute.findUnique as jest.Mock).mockResolvedValue(mockRoute)

      const result = await ghostRouteBySlug({ slug: 'abc123' })

      expect(mockedDb.ghostRoute.findUnique).toHaveBeenCalledWith({
        where: { shareSlug: 'abc123' },
      })
      expect(result.shapeName).toBe('Star')
    })
  })

  describe('describeShape mutation', () => {
    it('calls Python service and saves route to database', async () => {
      const mockPythonResponse = {
        shape: {
          name: 'Heart',
          description: 'A classic heart shape',
          emoji: '❤️',
          estimated_distance_km: 3.5,
          difficulty: 'moderate',
          control_points: [{ lng: 14.43, lat: 50.07 }],
          target_area: 'Vinohrady',
        },
        neighborhood: 'Vinohrady',
        bbox: { min_lng: 14.4, min_lat: 50.0, max_lng: 14.5, max_lat: 50.1 },
        similarity_score: 87.5,
        routed_coordinates: [
          [14.43, 50.07],
          [14.44, 50.08],
        ] as [number, number][],
        distance_km: 3.5,
        duration_minutes: 42,
        waypoints: [
          { index: 1, lng: 14.43, lat: 50.07, instruction: 'Start here' },
        ],
        alternative_neighborhoods: ['Karlín', 'Letná'],
      }

      mockedCallDescribe.mockResolvedValue(mockPythonResponse);
      (mockedDb.city.findFirst as jest.Mock).mockResolvedValue({ id: 1 });
      (mockedDb.ghostRoute.create as jest.Mock).mockResolvedValue({
        id: 'new-route-1',
        shapeName: 'Heart',
        shapeEmoji: '❤️',
        shapeDescription: 'A classic heart shape',
        routedCoordinates: JSON.stringify(
          mockPythonResponse.routed_coordinates
        ),
        controlPoints: JSON.stringify(
          mockPythonResponse.shape.control_points
        ),
        bbox: JSON.stringify(mockPythonResponse.bbox),
        distanceKm: 3.5,
        durationMinutes: 42,
        similarityScore: 87.5,
        waypoints: JSON.stringify(mockPythonResponse.waypoints),
        cityId: 1,
        userId: null,
        neighborhoodId: null,
        shareSlug: null,
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await describeShape({
        description: 'a heart shape',
        neighborhood: 'Vinohrady',
      })

      expect(mockedCallDescribe).toHaveBeenCalledWith({
        description: 'a heart shape',
        neighborhood: 'Vinohrady',
        max_distance_km: undefined,
      })

      expect(mockedDb.ghostRoute.create).toHaveBeenCalled()
      expect(result.shapeName).toBe('Heart')
      expect(result.neighborhood).toBe('Vinohrady')
      expect(result.alternativeNeighborhoods).toEqual(['Karlín', 'Letná'])
    })

    it('creates Prague city if it does not exist', async () => {
      const mockPythonResponse = {
        shape: {
          name: 'Star',
          description: '',
          emoji: '⭐',
          estimated_distance_km: 2,
          difficulty: 'easy',
          control_points: [],
          target_area: '',
        },
        neighborhood: 'Letná',
        bbox: { min_lng: 14.4, min_lat: 50.0, max_lng: 14.5, max_lat: 50.1 },
        similarity_score: 85,
        routed_coordinates: [[14.43, 50.07]] as [number, number][],
        distance_km: 2,
        duration_minutes: 24,
        waypoints: [],
      }

      mockedCallDescribe.mockResolvedValue(mockPythonResponse);
      (mockedDb.city.findFirst as jest.Mock).mockResolvedValue(null);
      (mockedDb.city.create as jest.Mock).mockResolvedValue({ id: 1 });
      (mockedDb.ghostRoute.create as jest.Mock).mockResolvedValue({
        id: 'new-route-2',
        shapeName: 'Star',
        shapeEmoji: '⭐',
        shapeDescription: '',
        routedCoordinates: '[[14.43, 50.07]]',
        controlPoints: null,
        bbox: '{"min_lng":14.4}',
        distanceKm: 2,
        durationMinutes: 24,
        similarityScore: 85,
        waypoints: '[]',
        cityId: 1,
        userId: null,
        neighborhoodId: null,
        shareSlug: null,
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await describeShape({ description: 'a star' })

      expect(mockedDb.city.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Prague',
          country: 'Czech Republic',
          countryCode: 'CZ',
        }),
      })
    })
  })

  describe('generateIdeas mutation', () => {
    it('calls Python service and returns formatted ideas', async () => {
      const mockResponse = {
        ideas: [
          {
            name: 'Heart Run',
            description: 'A classic heart shape through the streets',
            emoji: '❤️',
            estimated_distance_km: 3.5,
            difficulty: 'moderate',
            control_points: [{ lng: 14.43, lat: 50.07 }],
            target_area: 'Vinohrady',
          },
        ],
        neighborhood: 'Vinohrady',
        bbox: { min_lng: 14.4, min_lat: 50.0, max_lng: 14.5, max_lat: 50.1 },
      }

      mockedCallGenerate.mockResolvedValue(mockResponse)

      const result = await generateIdeas({
        neighborhood: 'Vinohrady',
        count: 3,
      })

      expect(mockedCallGenerate).toHaveBeenCalledWith({
        neighborhood: 'Vinohrady',
        count: 3,
      })
      expect(result.ideas).toHaveLength(1)
      expect(result.ideas[0].name).toBe('Heart Run')
      expect(result.ideas[0].estimatedDistanceKm).toBe(3.5)
      expect(result.neighborhood).toBe('Vinohrady')
    })
  })
})
