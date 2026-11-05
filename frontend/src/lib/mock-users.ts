import type { TeamUser } from '@/types/user'

// Temporary mock data. Replace with a real API call once the backend has a users endpoint.
export const initialUsers: TeamUser[] = [
  {
    id: 'u1',
    name: 'Mina N.',
    email: 'mina@storeflow.co',
    role: 'Manager',
    store: 'Central World',
    status: 'Active',
    createdAt: '2026-10-23',
  },
  {
    id: 'u2',
    name: 'Kai P.',
    email: 'kai@storeflow.co',
    role: 'Store Staff',
    store: 'Central World',
    status: 'Active',
    createdAt: '2026-10-23',
  },
  {
    id: 'u3',
    name: 'Ploy S.',
    email: 'ploy@storeflow.co',
    role: 'Store Staff',
    store: 'Siam Square',
    status: 'Active',
    createdAt: '2026-10-21',
  },
  {
    id: 'u4',
    name: 'Than R.',
    email: 'than@storeflow.co',
    role: 'Manager',
    store: 'IconSiam',
    status: 'Invited',
    createdAt: '2026-10-25',
  },
]
