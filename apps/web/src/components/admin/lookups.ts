import { useQuery } from '@tanstack/react-query'
import { api } from '#/lib/api-client'
import type { Option } from '#/lib/api-client'

export type LookupName = 'countries' | 'funders' | 'investigators' | 'personnel' | 'projects' | 'phases' | 'claims'

export function useLookup<T extends Option = Option>(name: LookupName) {
  return useQuery({
    queryKey: ['lookup', name],
    queryFn: () => api.get<Array<T>>(`/lookups/${name}`),
    staleTime: name === 'countries' ? Infinity : 30_000,
  })
}

export const CURRENCY_OPTIONS = [
  'USD',
  'GHS',
  'EUR',
  'GBP',
  'CAD',
  'CHF',
  'SEK',
  'NOK',
  'DKK',
  'AUD',
  'JPY',
  'CNY',
  'ZAR',
  'NGN',
  'KES',
]
