// Values shared by the database schema, the API and the web app. The enum
// lists here mirror the ENUM columns in migrations/.

export const USER_ROLES = ['administrator', 'director', 'accountant', 'clerk', 'investigator'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const PROJECT_TYPES = ['PROJECT', 'CONSULTANCY'] as const
export type ProjectType = (typeof PROJECT_TYPES)[number]

export const PROJECT_STATUSES = ['ONGOING', 'COMPLETED', 'CLOSED', 'SUSPENDED'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const ACTIVITY_STATUSES = ['PLANNED', 'ONGOING', 'COMPLETED'] as const
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number]

export const CLAIM_STATUSES = ['PENDING', 'PROCESSING', 'APPROVED', 'DECLINED'] as const
export type ClaimStatus = (typeof CLAIM_STATUSES)[number]

export const REQUEST_TYPES = ['INTENT', 'SUPPORT_LETTER', 'PROPOSAL_REVIEW', 'CLOSE_OUT', 'EQUIPMENT_TRANSFER'] as const
export type RequestType = (typeof REQUEST_TYPES)[number]

export const REQUEST_STATUSES = ['SUBMITTED', 'RECEIVED', 'UNDER_REVIEW', 'APPROVED', 'DECLINED'] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]

export const CURRENCIES = [
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
] as const
export type Currency = (typeof CURRENCIES)[number]
