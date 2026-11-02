import type { ActivityStatus, ClaimStatus, ProjectStatus, ProjectType, RequestStatus, UserRole } from '@dric/db'

export const ROLE_LABELS: Record<UserRole, string> = {
  administrator: 'Administrator',
  director: 'Director',
  accountant: 'Accountant',
  clerk: 'Clerk',
  investigator: 'Investigator',
}

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  PROJECT: 'Research project',
  CONSULTANCY: 'Consultancy',
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed',
  CLOSED: 'Closed out',
  SUSPENDED: 'Suspended',
}

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  PLANNED: 'Planned',
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed',
}

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
}

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  SUBMITTED: 'Submitted',
  RECEIVED: 'Received at DRIC',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
}

export type Tone = 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'brand'

export const STATUS_TONES: Record<string, Tone> = {
  ONGOING: 'info',
  COMPLETED: 'success',
  CLOSED: 'neutral',
  SUSPENDED: 'danger',
  PLANNED: 'neutral',
  PENDING: 'warning',
  PROCESSING: 'info',
  APPROVED: 'success',
  DECLINED: 'danger',
  SUBMITTED: 'warning',
  RECEIVED: 'info',
  UNDER_REVIEW: 'brand',
}

export const TITLES = ['Prof.', 'Assoc. Prof.', 'Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Rev.', 'Hon.']
