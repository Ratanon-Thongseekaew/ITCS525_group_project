export type DirectResaleBin = {
  id: string
  count: number
  weight: number
  packed: string
  status: 'Awaiting Process' | 'Processed'
  /** Potential revenue in baht, recorded when the bin is processed. */
  revenue?: number
}

// Temporary mock data. Replace with a real API call once the backend has a direct resale endpoint.
export const directResaleBins: DirectResaleBin[] = [
  {
    id: 'bin-id-001',
    count: 100,
    weight: 40,
    packed: '3:31 PM, 1 OCT 2026',
    status: 'Awaiting Process',
  },
  {
    id: 'bin-id-002',
    count: 80,
    weight: 32,
    packed: '10:15 AM, 28 SEP 2026',
    status: 'Processed',
    revenue: 12000,
  },
  {
    id: 'bin-id-003',
    count: 120,
    weight: 45,
    packed: '2:05 PM, 25 SEP 2026',
    status: 'Processed',
    revenue: 18500,
  },
]
