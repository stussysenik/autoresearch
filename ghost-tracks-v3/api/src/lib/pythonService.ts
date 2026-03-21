const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000'

interface DescribeRequest {
  description: string
  max_distance_km?: number
  neighborhood?: string
}

interface DescribeResponse {
  shape: {
    name: string
    description: string
    emoji: string
    estimated_distance_km: number
    difficulty: string
    control_points: Array<{ lng: number; lat: number }>
    target_area: string
  }
  neighborhood: string
  bbox: { min_lng: number; min_lat: number; max_lng: number; max_lat: number }
  similarity_score: number
  routed_coordinates: [number, number][]
  distance_km: number
  duration_minutes: number
  waypoints: Array<{ index: number; lng: number; lat: number; instruction: string }>
  alternative_neighborhoods?: string[]
}

interface GenerateRequest {
  neighborhood: string
  count?: number
}

interface GenerateResponse {
  ideas: Array<{
    name: string
    description: string
    emoji: string
    estimated_distance_km: number
    difficulty: string
    control_points: Array<{ lng: number; lat: number }>
    target_area: string
  }>
  neighborhood: string
  bbox: { min_lng: number; min_lat: number; max_lng: number; max_lat: number }
}

export async function describeShape(params: DescribeRequest): Promise<DescribeResponse> {
  const response = await fetch(`${PYTHON_SERVICE_URL}/describe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(90_000),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Python service error (${response.status}): ${body}`)
  }

  return response.json()
}

export async function generateIdeas(params: GenerateRequest): Promise<GenerateResponse> {
  const response = await fetch(`${PYTHON_SERVICE_URL}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Python service error (${response.status}): ${body}`)
  }

  return response.json()
}

export async function checkFeasibility(params: {
  description: string
  center: { lng: number; lat: number }
  radius_km?: number
}): Promise<any> {
  const response = await fetch(`${PYTHON_SERVICE_URL}/feasibility/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Feasibility check failed (${response.status}): ${body}`)
  }
  return response.json()
}

export async function healthCheck(): Promise<{ status: string; version: string }> {
  const response = await fetch(`${PYTHON_SERVICE_URL}/health`)
  return response.json()
}
