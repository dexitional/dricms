import type { RequestType } from '@dric/db'

// The official UCC-DRIC request forms (files/forms/*.pdf). Each definition
// drives three things: the public form on the landing site, the admin review
// screen, and the A4 printout, so wording here matches the paper forms.

export type FieldKind = 'text' | 'textarea' | 'date' | 'yesno' | 'money' | 'select'

export interface FieldDef {
  name: string
  label: string
  kind: FieldKind
  required?: boolean
  hint?: string
  options?: Array<string>
  /** Spans both columns of the form grid. */
  wide?: boolean
}

export interface FieldGroup {
  heading?: string
  note?: string
  fields: Array<FieldDef>
}

export interface RequestFormDef {
  type: RequestType
  slug: string
  /** Official title as printed on the form. */
  title: string
  /** Running header, top-left of every printed page. */
  runningHead: string
  shortTitle: string
  summary: string
  /** "[Researchers ... should allow at least ...]" */
  allowance: string
  /** Notices printed above the particulars (equipment transfer only). */
  notices?: Array<string>
  detailsHeading: string
  /** Documents the applicant should attach. */
  attachments: Array<string>
  showCallLink: boolean
  /** Close-out and equipment transfer refer to an existing project. */
  linksProject: boolean
  groups: Array<FieldGroup>
  /** Equipment table (equipment transfer). */
  hasItems: boolean
  /** "Condition of Equipment" in the official-use block. */
  officialCondition: boolean
  vcDecision: boolean
  icon: 'send' | 'mail' | 'clipboard' | 'archive' | 'truck'
  accent: string
}

const signee = (what: string): FieldGroup => ({
  heading: 'Signee',
  note: `The Director of DRIC will sign the ${what}. If a different person is required to sign, please indicate the signee:`,
  fields: [
    { name: 'signeeName', label: 'Name', kind: 'text' },
    { name: 'signeeTitle', label: 'Title', kind: 'text' },
  ],
})

const projectPeriod: FieldGroup = {
  fields: [
    { name: 'projectPeriod', label: 'Project Period (in months/years)', kind: 'text', required: true },
    { name: 'projectStartDate', label: 'Project Start Date', kind: 'date', required: true },
    { name: 'projectEndDate', label: 'Project End Date', kind: 'date', required: true },
  ],
}

export const REQUEST_FORMS: Array<RequestFormDef> = [
  {
    type: 'INTENT',
    slug: 'intent-to-submit',
    title: 'Intent to Submit a Proposal Form',
    runningHead: 'UCC-DRIC Intent to Submit a Proposal Form',
    shortTitle: 'Intent to submit a proposal',
    summary: 'Notify DRIC early that you plan to respond to a call for applications or proposals.',
    allowance: 'at least one (1) month',
    detailsHeading: 'Details of Request/Call for Applications',
    attachments: [
      'A copy of the request/call for applications or provide a link to the request/call or announcement',
      'Details of Team Composition or Consortium (Include collaborative organisations, if applicable; and indicate if UCC is Leading or Partnering on the Application)',
    ],
    showCallLink: true,
    linksProject: false,
    groups: [
      {
        fields: [
          {
            name: 'teamComposition',
            label: 'Team Composition or Consortium',
            kind: 'textarea',
            wide: true,
            hint: 'Collaborating organisations, and whether UCC is leading or partnering.',
          },
          {
            name: 'letterOfIntent',
            label: 'Letter of Intent to Funding Agency (If applicable)',
            kind: 'textarea',
            wide: true,
          },
          {
            name: 'loiDueDate',
            label: 'Due Date for Letter of Intent to Funding Agency (If applicable)',
            kind: 'date',
          },
          { name: 'applicationDueDate', label: 'Application Due Date', kind: 'date', required: true },
          { name: 'plannedSubmissionDate', label: 'Date You Plan to Submit Application', kind: 'date', required: true },
        ],
      },
      {
        fields: [
          {
            name: 'limitedSubmission',
            label: 'Is this a Limited Submission Opportunity [i.e. UCC can submit only one application]?',
            kind: 'yesno',
            required: true,
            wide: true,
          },
          {
            name: 'collaborative',
            label: 'Is this proposal a collaborative proposal with other institution(s)?',
            kind: 'yesno',
            required: true,
            wide: true,
          },
          {
            name: 'leadInstitution',
            label: 'Which institution/organisation is the lead on this proposal?',
            kind: 'text',
            required: true,
          },
          {
            name: 'awardType',
            label: 'Anticipated Award Type',
            kind: 'select',
            required: true,
            options: ['Grant', 'Contract', 'Consultancy', 'Sub-award/Sub-contract', 'Fellowship', 'Other'],
          },
        ],
      },
    ],
    hasItems: false,
    officialCondition: false,
    vcDecision: false,
    icon: 'send',
    accent: '#3b5bdb',
  },
  {
    type: 'SUPPORT_LETTER',
    slug: 'letter-of-support',
    title: 'Request for Institutional Letter of Support',
    runningHead: 'UCC-DRIC Request for Letter of Support',
    shortTitle: 'Letter of support',
    summary: 'Request an institutional letter of support for a grant or consultancy application.',
    allowance: 'at least five (5) working or business days',
    detailsHeading: 'Details of Request/Call for Applications',
    attachments: [
      'A copy of the request/call for applications or provide a link to the request/call or announcement',
      'Abstract or Project Summary (Include the aim/goal/objectives of the project)',
      'Details of Team Composition or Consortium (Include collaborative organisations if applicable; and indicate if UCC is Leading or Partnering on the Application)',
      'Abridged CV of Principal Investigator/Lead Consultant from UCC (Maximum of 2 pages)',
    ],
    showCallLink: true,
    linksProject: false,
    groups: [
      signee('letter of support'),
      {
        fields: [
          { name: 'dueDate', label: 'Due Date for Letter of Support', kind: 'date', required: true },
          { name: 'otherInfo', label: 'Any Other Relevant Information', kind: 'textarea', wide: true },
        ],
      },
    ],
    hasItems: false,
    officialCondition: false,
    vcDecision: true,
    icon: 'mail',
    accent: '#e11d48',
  },
  {
    type: 'PROPOSAL_REVIEW',
    slug: 'proposal-review',
    title: 'Request for Proposal Review, Approval and Submission',
    runningHead: 'UCC-DRIC Request for Proposal Review, Approval and Submission',
    shortTitle: 'Proposal review & submission',
    summary: 'Have DRIC review, approve and sign off your technical and financial proposal before submission.',
    allowance: 'at least ten (10) working or business days',
    detailsHeading: 'Details of Request/Call for Applications',
    attachments: [
      'A copy of the request/call for applications or provide a link to the request/call or announcement',
      'Technical proposal',
      'Financial proposal (Budget)',
    ],
    showCallLink: true,
    linksProject: false,
    groups: [
      signee('application'),
      {
        fields: [
          { name: 'submissionDueDate', label: 'Proposal Submission Due Date', kind: 'date', required: true },
          { name: 'otherInfo', label: 'Any Other Relevant Information', kind: 'textarea', wide: true },
        ],
      },
    ],
    hasItems: false,
    officialCondition: false,
    vcDecision: false,
    icon: 'clipboard',
    accent: '#0d9488',
  },
  {
    type: 'CLOSE_OUT',
    slug: 'project-close-out',
    title: 'Request for Closing Out of Project',
    runningHead: 'UCC-DRIC Request for Project Close-Out',
    shortTitle: 'Project close-out',
    summary: 'Formally close out a completed project with your end-of-project report and financial statement.',
    allowance: 'at least ten (10) working or business days',
    detailsHeading: 'Details of Project',
    attachments: [
      'A copy of the End of Project Report',
      'Project pictures in pdf or jpeg format',
      'Abstract of publications',
      'A detailed project financial statement',
    ],
    showCallLink: false,
    linksProject: true,
    groups: [
      projectPeriod,
      {
        fields: [
          {
            name: 'outputs',
            label: 'Project Outputs',
            kind: 'textarea',
            required: true,
            wide: true,
            hint: 'Include main achievements, conferences/workshops/seminars attended, presentations at conferences, equipment purchased, etc.',
          },
          { name: 'contractSum', label: 'Total Project Contract Sum (In Figures)', kind: 'money', required: true },
          {
            name: 'finalReportDueDate',
            label: 'Final Project Report Submission Due Date',
            kind: 'date',
            required: true,
          },
          { name: 'otherInfo', label: 'Any Other Relevant Information', kind: 'textarea', wide: true },
        ],
      },
    ],
    hasItems: false,
    officialCondition: false,
    vcDecision: false,
    icon: 'archive',
    accent: '#f59e0b',
  },
  {
    type: 'EQUIPMENT_TRANSFER',
    slug: 'equipment-transfer',
    title: 'Research/Consultancy Project Equipment Transfer Form',
    runningHead: 'UCC-DRIC Request for Equipment Transfer',
    shortTitle: 'Equipment transfer',
    summary: 'Request approval to transfer capital equipment purchased with project funds.',
    allowance: 'at least ten (10) working or business days',
    notices: [
      'Ownership of capital equipment purchased with grant funds shall remain the property of UCC. No such equipment shall be transferred, sold or disposed of without approval from DRIC. Researchers are, therefore, informed that ownership of equipment purchased from research grants and consultancy funds are permanently vested in the University.',
      'In case of a transfer of a principal investigator/consultant to another institution, research-related equipment which may have been purchased from an externally-funded research grant or contract will remain with UCC. However, in exceptional circumstances, such equipment may be transferred to another institution, subject to approval by the Vice Chancellor on the recommendation of the Director of DRIC.',
    ],
    detailsHeading: 'Details of Project',
    attachments: ['Pictures of the equipment'],
    showCallLink: false,
    linksProject: true,
    groups: [
      projectPeriod,
      {
        heading: 'Details of Equipment',
        fields: [
          {
            name: 'equipmentCondition',
            label: 'Condition of Equipment',
            kind: 'textarea',
            required: true,
            wide: true,
            hint: 'Attach pictures of the equipment below.',
          },
          { name: 'equipmentLocation', label: 'Location of equipment', kind: 'text', required: true, wide: true },
        ],
      },
      { fields: [{ name: 'otherInfo', label: 'Any Other Relevant Information', kind: 'textarea', wide: true }] },
    ],
    hasItems: true,
    officialCondition: true,
    vcDecision: false,
    icon: 'truck',
    accent: '#7c3aed',
  },
]

export const REQUEST_FORM_BY_TYPE = Object.fromEntries(REQUEST_FORMS.map((f) => [f.type, f])) as Record<
  RequestType,
  RequestFormDef
>
export const REQUEST_FORM_BY_SLUG = Object.fromEntries(REQUEST_FORMS.map((f) => [f.slug, f])) as Record<
  string,
  RequestFormDef | undefined
>

export const DISBURSEMENT_FORM = {
  title: 'Request for Disbursement of Research/Consultancy Project Funds',
  runningHead: 'UCC-DRIC Request for Disbursement of Research/Consultancy Project Funds',
  allowance: 'at least ten (10) working or business days',
}

// UCC-DRIC Project Kick-Off Meeting Checklist.
export const KICKOFF_ITEMS: Array<{ no: number; title: string; hint?: string }> = [
  { no: 1, title: 'Welcome, Introductions and Project Summary' },
  {
    no: 2,
    title: 'Terms and Conditions of the Grant/Consultancy Award in UCC',
    hint: 'Explain grant/consultancy award regulations and policies to Principal Investigator and Team Members and ask them to peruse them in detail',
  },
  {
    no: 3,
    title: 'Project Scope of Work',
    hint: 'Specific objectives, tasks, activities, issues/problems to be solved',
  },
  { no: 4, title: 'Possible Project Risks and How to Manage Them' },
  { no: 5, title: 'Project Timelines and Deliverables' },
  { no: 6, title: 'Reporting Requirements', hint: 'Communication Plan' },
  {
    no: 7,
    title: 'Roles and Responsibilities',
    hint: 'Principal Investigator/Lead Consultant, Other Team Members, Head of Department, Dean, Provost, DRIC, Institutional Review Board, etc.',
  },
  {
    no: 8,
    title: 'Budget Review',
    hint: 'Salaries/Fringe Benefits, Materials and Supplies including Travel, Cost Share (If Applicable)',
  },
  { no: 9, title: 'Overhead Cost' },
  { no: 10, title: 'Documents or resources that the team can benefit from' },
  { no: 11, title: 'Project Start and End Dates' },
  { no: 12, title: 'Questions or Issues for Clarification' },
]

export const DRIC_EMAIL = 'dric@ucc.edu.gh'
