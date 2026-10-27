export interface Greeting {
  message: string
}

const API_URL = import.meta.env.VITE_API_URL ?? ''

export async function getGreeting(): Promise<Greeting> {
  const response = await fetch(`${API_URL}/api/greeting`)

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`)
  }

  return response.json() as Promise<Greeting>
}

