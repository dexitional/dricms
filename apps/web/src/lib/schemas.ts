// Validation shared by the admin/public forms (via zodResolver) and the API
// (via validate()), so a rule is written once and enforced on both sides.
import { z } from 'zod'
import {
  ACTIVITY_STATUSES,
  CLAIM_STATUSES,
  CURRENCIES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  REQUEST_STATUSES,
  REQUEST_TYPES,
  USER_ROLES,
} from '@dric/db/types'
import { REQUEST_FORM_BY_TYPE } from './forms'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const emptyToNull = (v: unknown) => (v === '' || v === undefined ? null : v)

const req = (max = 255, message = 'Required') => z.string().trim().min(1, message).max(max)
const opt = (max = 255) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable()).transform((v) => (v ? v : null))
const optEmail = z.preprocess(
  emptyToNull,
  z.string().trim().toLowerCase().email('Enter a valid email').max(150).nullable(),
)
const optUrl = z.preprocess(emptyToNull, z.string().trim().url('Enter a full URL (https://…)').max(500).nullable())
const date = z.string().regex(ISO_DATE, 'Pick a date')
const optDate = z.preprocess(emptyToNull, z.string().regex(ISO_DATE, 'Pick a date').nullable())
const amount = z.coerce.number({ error: 'Enter an amount' }).min(0, 'Cannot be negative').max(1e12)
const signedAmount = z.coerce.number({ error: 'Enter an amount' }).min(-1e12).max(1e12)
const id = (message = 'Choose one') => z.coerce.number({ error: message }).int().positive(message)
const optId = z.preprocess((v) => (v === '' || v == null ? null : Number(v)), z.number().int().positive().nullable())
const currency = z.enum(CURRENCIES, { error: 'Choose a currency' })
const ids = z.array(z.coerce.number().int().positive()).max(100).default([])

const datesInOrder = (startKey: string, endKey: string) => (v: Record<string, unknown>, ctx: z.RefinementCtx) => {
  const start = v[startKey]
  const end = v[endKey]
  if (typeof start === 'string' && typeof end === 'string' && end < start) {
    ctx.addIssue({ code: 'custom', path: [endKey], message: 'Must be on or after the start date' })
  }
}

// ---------------------------------------------------------------- Accounts

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Required'),
    newPassword: z.string().min(8, 'Use at least 8 characters').max(200),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })

export const userSchema = z
  .object({
    fullName: req(150),
    email: z.string().trim().toLowerCase().email('Enter a valid email').max(150),
    role: z.enum(USER_ROLES),
    investigatorId: optId,
    isActive: z.boolean().default(true),
    password: z.preprocess(emptyToNull, z.string().min(8, 'Use at least 8 characters').max(200).nullable()),
  })
  .superRefine((v, ctx) => {
    if (v.role === 'investigator' && !v.investigatorId) {
      ctx.addIssue({ code: 'custom', path: ['investigatorId'], message: 'Link the investigator record' })
    }
  })

export const investigatorAccountSchema = z.object({
  password: z.string().min(8, 'Use at least 8 characters').max(200),
})

// ---------------------------------------------------------------- Funders

export const funderSchema = z.object({
  name: req(200),
  description: opt(5000),
  location: opt(150),
  address: opt(255),
  phone: opt(40),
  email: optEmail,
  countryId: optId,
  websiteUrl: optUrl,
  logoUrl: optUrl,
  portalUrl: optUrl,
  portalUsername: opt(150),
  /** Write-only. Empty keeps the stored password; see clearPortalPassword. */
  portalPassword: z.string().max(200).optional().default(''),
  clearPortalPassword: z.boolean().optional().default(false),
})

// ---------------------------------------------------------------- People

const person = {
  title: opt(30),
  firstName: req(80),
  middleName: opt(120),
  lastName: req(80),
  location: opt(150),
  phone: opt(40),
  email: optEmail,
  staffNo: opt(40),
  department: opt(150),
  address: opt(255),
  ghanaCardNo: z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^GHA-\d{9}-\d$/, 'Format: GHA-000000000-0')
      .nullable(),
  ),
  accountName: opt(150),
  bankName: opt(150),
  accountNo: opt(60),
  bankBranch: opt(120),
  isActive: z.boolean().default(true),
}

export const personnelSchema = z.object(person)

export const investigatorSchema = z.object({
  ...person,
  college: opt(150),
  faculty: opt(150),
  designation: opt(120),
})

// ---------------------------------------------------------------- Projects

export const projectSchema = z
  .object({
    title: req(300),
    description: opt(10000),
    totalFunding: amount,
    currency,
    type: z.enum(PROJECT_TYPES),
    status: z.enum(PROJECT_STATUSES).default('ONGOING'),
    awardedAt: optDate,
    startDate: optDate,
    endDate: optDate,
    countryId: optId,
    funderId: optId,
    piId: optId,
    coInvestigatorIds: ids,
    finalReport: opt(500_000),
    contractUrl: opt(500),
    contractName: opt(255),
    budgetUrl: opt(500),
    budgetName: opt(255),
  })
  .superRefine(datesInOrder('startDate', 'endDate'))
  .superRefine((v, ctx) => {
    if (v.piId && v.coInvestigatorIds.includes(v.piId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['coInvestigatorIds'],
        message: 'The principal investigator is already on the project',
      })
    }
  })

export const phaseSchema = z
  .object({
    title: req(255),
    description: opt(5000),
    phaseNo: z.coerce.number().int().min(1, 'At least 1').max(999),
    balanceBf: signedAmount,
    budget: amount,
    spent: amount,
    startDate: optDate,
    endDate: optDate,
    report: opt(500_000),
  })
  .superRefine(datesInOrder('startDate', 'endDate'))

export const activitySchema = z
  .object({
    title: req(255),
    description: opt(5000),
    subjects: opt(500),
    amount,
    currency,
    location: opt(200),
    status: z.enum(ACTIVITY_STATUSES).default('PLANNED'),
    startDate: optDate,
    endDate: optDate,
    report: opt(20000),
    personnelIds: ids,
  })
  .superRefine(datesInOrder('startDate', 'endDate'))

export const kickoffSchema = z.object({
  meetingDate: optDate,
  venue: opt(200),
  attendees: opt(2000),
  notes: opt(5000),
  items: z
    .array(
      z.object({
        no: z.number().int().min(1).max(12),
        tick: z.boolean().nullable(),
        note: opt(500),
      }),
    )
    .length(12),
})

// ---------------------------------------------------------------- Claims & payments

export const claimItemSchema = z.object({
  description: req(300),
  quantity: z.coerce.number().min(0).max(1e9),
  unit: opt(40),
  days: z.coerce.number().min(0).max(10000).default(1),
  unitCost: amount,
})

export const claimSchema = z.object({
  phaseId: id('Choose the project phase'),
  investigatorId: optId,
  purpose: req(300),
  description: opt(5000),
  reasons: opt(5000),
  amount,
  currency,
  items: z.array(claimItemSchema).max(60).default([]),
  signedName: opt(150),
  signedAt: optDate,
})

export const claimOfficialSchema = z.object({
  status: z.enum(CLAIM_STATUSES).optional(),
  receivedAt: optDate.optional(),
  directorDecision: opt(5000).optional(),
  directorName: opt(150).optional(),
  directorDecidedAt: optDate.optional(),
  vcDecision: opt(5000).optional(),
  vcName: opt(150).optional(),
  vcDecidedAt: optDate.optional(),
})

export const paymentSchema = z.object({
  claimId: id('Choose the tranche request'),
  description: opt(500),
  amount: z.coerce.number({ error: 'Enter an amount' }).positive('Must be more than zero').max(1e12),
  currency,
  conversionRate: z.coerce.number({ error: 'Enter a rate' }).positive('Must be more than zero').max(1e6),
  paidAt: date,
})

// ---------------------------------------------------------------- Request forms

export const attachmentSchema = z.object({
  url: z.string().startsWith('/api/files/').max(500),
  name: z.string().max(255),
  size: z.number().int().nonnegative(),
  type: z.string().max(120),
})

export const equipmentItemSchema = z.object({
  description: req(300),
  quantity: z.coerce.number().min(0).max(1e6),
  make: opt(100),
  model: opt(100),
  serialNo: opt(100),
  assetNo: opt(100),
  year: z.preprocess(emptyToNull, z.coerce.number().int().min(1950).max(2100).nullable()),
  cost: amount,
})

const dataValue = z.union([z.string().max(20000), z.number(), z.boolean(), z.null()])

export const requestSchema = z
  .object({
    type: z.enum(REQUEST_TYPES),
    surname: req(80),
    firstName: req(80),
    middleName: opt(120),
    college: opt(150),
    faculty: opt(150),
    department: req(150),
    designation: req(120),
    email: z.string().trim().toLowerCase().email('Enter a valid email').max(150),
    phone: req(40),
    callLink: optUrl,
    projectTitle: req(300),
    fundingAgencies: req(500),
    funderEmails: opt(500),
    projectCode: opt(20),
    data: z.record(z.string(), dataValue).default({}),
    currency: currency.default('GHS'),
    items: z.array(equipmentItemSchema).max(50).default([]),
    attachments: z.array(attachmentSchema).max(10).default([]),
    signedName: req(150, 'Type your full name to sign'),
    declaration: z.literal(true, { error: 'Please confirm the declaration' }),
  })
  .superRefine((v, ctx) => {
    const def = REQUEST_FORM_BY_TYPE[v.type]
    for (const group of def.groups) {
      for (const field of group.fields) {
        const value = v.data[field.name]
        if (field.required && (value === undefined || value === null || value === '')) {
          ctx.addIssue({ code: 'custom', path: ['data', field.name], message: 'Required' })
        }
        if (field.kind === 'date' && typeof value === 'string' && value && !ISO_DATE.test(value)) {
          ctx.addIssue({ code: 'custom', path: ['data', field.name], message: 'Pick a date' })
        }
      }
    }
    if (def.hasItems && v.items.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'List at least one piece of equipment' })
    }
  })

export const requestOfficialSchema = z.object({
  status: z.enum(REQUEST_STATUSES).optional(),
  projectId: optId.optional(),
  receivedAt: optDate.optional(),
  officialCondition: opt(5000).optional(),
  directorDecision: opt(5000).optional(),
  directorName: opt(150).optional(),
  directorDecidedAt: optDate.optional(),
  vcDecision: opt(5000).optional(),
  vcName: opt(150).optional(),
  vcDecidedAt: optDate.optional(),
})

export const trackSchema = z.object({
  reference: z.string().trim().toUpperCase().min(4, 'Enter your reference').max(20),
  email: z.string().trim().toLowerCase().email('Enter the email you used'),
})

export type FunderInput = z.input<typeof funderSchema>
export type ProjectInput = z.input<typeof projectSchema>
export type ClaimInput = z.input<typeof claimSchema>
export type RequestInput = z.input<typeof requestSchema>
