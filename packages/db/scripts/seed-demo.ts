// Fills an EMPTY database with realistic demo data (funders, investigators,
// personnel, projects with phases/activities, claims, tranche payments, form
// requests and portal accounts) so dashboards have something to show.
// Refuses to run if any project already exists.
//
//   npm run db:seed-demo
//
// Demo sign-ins (password "Demo1234!"): director@, accountant@, clerk@dric.ucc.edu.gh
// and the investigator ama.mensah@ucc.edu.gh.
import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import mysql from 'mysql2/promise'

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const code = (n: number) =>
  Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function monthsFromNow(months: number, day = 1) {
  const now = new Date()
  return iso(new Date(now.getFullYear(), now.getMonth() + months, day))
}

const FUNDERS = [
  ['Wellcome Trust', 'GB', 'London', 'https://wellcome.org', 'Global charitable foundation funding health research.'],
  [
    'Bill & Melinda Gates Foundation',
    'US',
    'Seattle',
    'https://www.gatesfoundation.org',
    'Funds global health, development and education programmes.',
  ],
  [
    'European & Developing Countries Clinical Trials Partnership',
    'NL',
    'The Hague',
    'https://www.edctp.org',
    'Supports clinical research on infectious diseases in sub-Saharan Africa.',
  ],
  [
    'International Development Research Centre',
    'CA',
    'Ottawa',
    'https://idrc-crdi.ca',
    'Canadian Crown corporation funding research in developing regions.',
  ],
  [
    'UNICEF Ghana',
    'GH',
    'Accra',
    'https://www.unicef.org/ghana',
    'Commissions evaluations and consultancies on child welfare.',
  ],
  [
    'Ghana Education Service',
    'GH',
    'Accra',
    'https://ges.gov.gh',
    'Commissions education sector studies and evaluations.',
  ],
] as const

const INVESTIGATORS = [
  [
    'Dr.',
    'Ama',
    'Mensah',
    'Dept. of Biomedical Sciences',
    'College of Health and Allied Sciences',
    'School of Allied Health Sciences',
    'Senior Lecturer',
  ],
  [
    'Prof.',
    'Kwame',
    'Asante',
    'Dept. of Fisheries and Aquatic Sciences',
    'College of Agriculture and Natural Sciences',
    'School of Biological Sciences',
    'Associate Professor',
  ],
  [
    'Dr.',
    'Efua',
    'Owusu-Ansah',
    'Dept. of Basic Education',
    'College of Education Studies',
    'Faculty of Educational Foundations',
    'Lecturer',
  ],
  [
    'Prof.',
    'Kofi',
    'Boateng',
    'Dept. of Economics',
    'College of Humanities and Legal Studies',
    'School of Economics',
    'Professor',
  ],
  [
    'Dr.',
    'Abena',
    'Darko',
    'Dept. of Microbiology and Immunology',
    'College of Health and Allied Sciences',
    'School of Medical Sciences',
    'Senior Lecturer',
  ],
  [
    'Dr.',
    'Yaw',
    'Amoako',
    'Dept. of Geography and Regional Planning',
    'College of Humanities and Legal Studies',
    'Faculty of Social Sciences',
    'Lecturer',
  ],
  [
    'Mrs.',
    'Akosua',
    'Frimpong',
    'Centre for Coastal Management',
    'College of Agriculture and Natural Sciences',
    'School of Biological Sciences',
    'Research Fellow',
  ],
  [
    'Dr.',
    'Nana',
    'Agyeman',
    'Dept. of Population and Health',
    'College of Humanities and Legal Studies',
    'Faculty of Social Sciences',
    'Senior Lecturer',
  ],
] as const

const PERSONNEL = [
  ['Mr.', 'Isaac', 'Quaye', 'Field Coordinator'],
  ['Ms.', 'Mercy', 'Aidoo', 'Data Manager'],
  ['Mr.', 'Daniel', 'Tetteh', 'Laboratory Technician'],
  ['Ms.', 'Gifty', 'Arthur', 'Research Assistant'],
  ['Mr.', 'Samuel', 'Ofori', 'Logistics Officer'],
  ['Ms.', 'Linda', 'Nyarko', 'Community Liaison'],
] as const

interface ProjectSpec {
  title: string
  description: string
  type: 'PROJECT' | 'CONSULTANCY'
  funder: number
  pi: number
  co: Array<number>
  funding: number
  currency: string
  startMonths: number
  durationMonths: number
  status: 'ONGOING' | 'COMPLETED' | 'CLOSED'
  phases: Array<[string, number]>
}

const PROJECTS: Array<ProjectSpec> = [
  {
    title: 'Malaria vector surveillance and insecticide resistance along coastal Ghana',
    description:
      'Longitudinal entomological surveillance across six coastal districts to map Anopheles species composition and resistance profiles, informing the National Malaria Elimination Programme.',
    type: 'PROJECT',
    funder: 0,
    pi: 0,
    co: [4, 7],
    funding: 480000,
    currency: 'USD',
    startMonths: -14,
    durationMonths: 30,
    status: 'ONGOING',
    phases: [
      ['Site mapping and baseline collection', 120000],
      ['Seasonal sampling and bioassays', 160000],
      ['Molecular analysis and reporting', 110000],
    ],
  },
  {
    title: 'Fisheries livelihoods and climate resilience in the Central Region',
    description:
      'Mixed-methods study of how artisanal fishing communities adapt to declining catches and changing sea temperatures.',
    type: 'PROJECT',
    funder: 3,
    pi: 1,
    co: [6],
    funding: 320000,
    currency: 'USD',
    startMonths: -9,
    durationMonths: 24,
    status: 'ONGOING',
    phases: [
      ['Community engagement and survey design', 70000],
      ['Household panel survey', 140000],
    ],
  },
  {
    title: 'Evaluation of the Free SHS policy on learning outcomes',
    description:
      'Commissioned evaluation of learning outcomes and equity effects of the Free Senior High School policy.',
    type: 'CONSULTANCY',
    funder: 5,
    pi: 2,
    co: [3],
    funding: 1450000,
    currency: 'GHS',
    startMonths: -6,
    durationMonths: 10,
    status: 'ONGOING',
    phases: [
      ['Inception and tool development', 350000],
      ['Fieldwork in 10 regions', 700000],
    ],
  },
  {
    title: 'Antimicrobial resistance in poultry value chains (One Health)',
    description: 'Characterising AMR genes in poultry, farm workers and the environment in peri-urban Cape Coast.',
    type: 'PROJECT',
    funder: 2,
    pi: 4,
    co: [0],
    funding: 610000,
    currency: 'EUR',
    startMonths: -18,
    durationMonths: 36,
    status: 'ONGOING',
    phases: [
      ['Ethics, recruitment and sampling', 150000],
      ['Genomic sequencing', 230000],
      ['Risk communication', 90000],
    ],
  },
  {
    title: 'Child protection systems mapping in Northern Ghana',
    description: 'Consultancy to map formal and informal child protection services for UNICEF Ghana.',
    type: 'CONSULTANCY',
    funder: 4,
    pi: 7,
    co: [5],
    funding: 520000,
    currency: 'GHS',
    startMonths: -16,
    durationMonths: 8,
    status: 'COMPLETED',
    phases: [
      ['Desk review and stakeholder mapping', 180000],
      ['District validation workshops', 260000],
    ],
  },
  {
    title: 'Maternal health service uptake and digital reminders',
    description:
      'Cluster-randomised trial of SMS reminders for antenatal care attendance in the Cape Coast Metropolis.',
    type: 'PROJECT',
    funder: 1,
    pi: 7,
    co: [0, 4],
    funding: 750000,
    currency: 'USD',
    startMonths: -3,
    durationMonths: 36,
    status: 'ONGOING',
    phases: [['Trial set-up and randomisation', 160000]],
  },
  {
    title: 'Coastal erosion and land-use change atlas',
    description: 'GIS-based mapping of shoreline change between 1990 and 2025 for coastal planning.',
    type: 'PROJECT',
    funder: 3,
    pi: 5,
    co: [6],
    funding: 185000,
    currency: 'USD',
    startMonths: -26,
    durationMonths: 24,
    status: 'CLOSED',
    phases: [
      ['Imagery acquisition', 60000],
      ['Analysis and atlas production', 90000],
    ],
  },
  {
    title: 'Teacher professional development needs assessment',
    description: 'Rapid assessment of in-service training needs of basic school teachers.',
    type: 'CONSULTANCY',
    funder: 5,
    pi: 2,
    co: [],
    funding: 280000,
    currency: 'GHS',
    startMonths: -2,
    durationMonths: 5,
    status: 'ONGOING',
    phases: [['Survey of 400 teachers', 160000]],
  },
]

const CLAIM_PURPOSES = [
  [
    'Field data collection advance',
    [
      ['Per diem for enumerators', 6, 'persons', 10, 250],
      ['Vehicle hire', 2, 'vehicles', 10, 800],
      ['Fuel', 400, 'litres', 1, 14.5],
    ],
  ],
  [
    'Laboratory consumables and reagents',
    [
      ['PCR reagents', 3, 'kits', 1, 4200],
      ['Sample tubes and pipette tips', 20, 'boxes', 1, 180],
    ],
  ],
  [
    'Stakeholder validation workshop',
    [
      ['Venue and refreshments', 60, 'participants', 2, 120],
      ['Transport reimbursement', 60, 'participants', 1, 150],
    ],
  ],
  ['Research assistant stipends', [['Stipend', 3, 'assistants', 3, 1800]]],
] as const

async function main() {
  const uri = process.env.DATABASE_URL
  if (!uri) throw new Error('DATABASE_URL is not set.')
  const db = await mysql.createConnection({ uri })
  const [[existing]] = await db.query<Array<mysql.RowDataPacket>>('SELECT COUNT(*) AS n FROM projects')
  if (existing!.n > 0) {
    console.log('Projects already exist — refusing to add demo data. Use an empty database.')
    await db.end()
    return
  }
  const [countryRows] = await db.query<Array<mysql.RowDataPacket>>('SELECT id, code FROM countries')
  const country = (c: string) => countryRows.find((r) => r.code === c)?.id ?? null
  const [[admin]] = await db.query<Array<mysql.RowDataPacket>>(
    "SELECT id FROM users WHERE role = 'administrator' ORDER BY id LIMIT 1",
  )
  const adminId = admin?.id ?? null
  const ins = async (sql: string, params: Array<unknown>) =>
    (await db.query<mysql.ResultSetHeader>(sql, params))[0].insertId

  const funderIds: Array<number> = []
  for (const [name, cc, location, web, desc] of FUNDERS) {
    funderIds.push(
      await ins(
        'INSERT INTO funders (name, description, location, country_id, website_url, email) VALUES (?, ?, ?, ?, ?, ?)',
        [name, desc, location, country(cc), web, `grants@${new URL(web).hostname.replace(/^www\./, '')}`],
      ),
    )
  }
  const invIds: Array<number> = []
  for (const [i, [title, first, last, dept, college, faculty, designation]] of INVESTIGATORS.entries()) {
    const email = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '') + '@ucc.edu.gh'
    invIds.push(
      await ins(
        `INSERT INTO investigators (title, first_name, last_name, email, phone, staff_no, department, college, faculty, designation, location,
           account_name, bank_name, account_no, bank_branch) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Cape Coast', ?, ?, ?, ?)`,
        [
          title,
          first,
          last,
          email,
          `024${String(4000000 + i * 1371).padStart(7, '0')}`,
          `UCC${1200 + i}`,
          dept,
          college,
          faculty,
          designation,
          `${first} ${last}`,
          i % 2 ? 'GCB Bank' : 'Ecobank Ghana',
          `10${String(23456789 + i * 7919)}`,
          'UCC Campus',
        ],
      ),
    )
  }
  const perIds: Array<number> = []
  for (const [i, [title, first, last]] of PERSONNEL.entries()) {
    perIds.push(
      await ins('INSERT INTO personnel (title, first_name, last_name, phone, department) VALUES (?, ?, ?, ?, ?)', [
        title,
        first,
        last,
        `020${String(5550000 + i * 311).padStart(7, '0')}`,
        'DRIC field team',
      ]),
    )
  }

  const passwordHash = await bcrypt.hash('Demo1234!', 12)
  for (const [role, name] of [
    ['director', 'Prof. DRIC Director'],
    ['accountant', 'DRIC Accountant'],
    ['clerk', 'DRIC Clerk'],
  ] as const) {
    await db.query('INSERT IGNORE INTO users (full_name, email, role, password_hash) VALUES (?, ?, ?, ?)', [
      name,
      `${role}@dric.ucc.edu.gh`,
      role,
      passwordHash,
    ])
  }
  await db.query(
    "INSERT IGNORE INTO users (full_name, email, role, password_hash, investigator_id) VALUES ('Dr. Ama Mensah', 'ama.mensah@ucc.edu.gh', 'investigator', ?, ?)",
    [passwordHash, invIds[0]],
  )

  let seq = 0
  for (const spec of PROJECTS) {
    const start = monthsFromNow(spec.startMonths)
    const end = monthsFromNow(spec.startMonths + spec.durationMonths, 0)
    const year = Number(start.slice(0, 4))
    const projectId = await ins(
      `INSERT INTO projects (code, title, description, total_funding, currency, type, status, awarded_at, start_date, end_date, country_id, funder_id, pi_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `DRIC-${year}-${String(++seq).padStart(3, '0')}`,
        spec.title,
        spec.description,
        spec.funding,
        spec.currency,
        spec.type,
        spec.status,
        monthsFromNow(spec.startMonths - 1, 15),
        start,
        end,
        country('GH'),
        funderIds[spec.funder],
        invIds[spec.pi],
        adminId,
      ],
    )
    for (const co of spec.co)
      await db.query('INSERT INTO project_co_investigators (project_id, investigator_id) VALUES (?, ?)', [
        projectId,
        invIds[co],
      ])

    let carry = 0
    const phaseLength = Math.max(2, Math.floor(spec.durationMonths / Math.max(spec.phases.length, 2)))
    for (const [pi, [title, budget]] of spec.phases.entries()) {
      const pStart = spec.startMonths + pi * phaseLength
      const isPast = pStart + phaseLength <= 0
      const spent = isPast
        ? Math.round(budget * (0.82 + Math.random() * 0.15))
        : pStart <= 0
          ? Math.round(budget * (0.25 + Math.random() * 0.35))
          : 0
      const phaseId = await ins(
        `INSERT INTO phases (project_id, title, description, phase_no, balance_bf, budget, spent, start_date, end_date, report)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          title,
          `Phase ${pi + 1} of the project: ${title.toLowerCase()}.`,
          pi + 1,
          carry,
          budget,
          spent,
          monthsFromNow(pStart),
          monthsFromNow(pStart + phaseLength, 0),
          isPast
            ? `<h2>Summary</h2><p>${title} was completed within budget. Key outputs were delivered and shared with partners.</p><ul><li>All planned activities completed</li><li>Data quality checks passed</li></ul>`
            : null,
        ],
      )
      carry = Math.round((carry + budget - spent) * 100) / 100
      for (let a = 0; a < 3; a++) {
        const actId = await ins(
          `INSERT INTO activities (phase_id, title, description, subjects, amount, currency, location, status, start_date, end_date, report)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            phaseId,
            ['Training of field staff', 'Data collection', 'Data cleaning and analysis'][a],
            'Planned activity under this phase.',
            ['Field staff', 'Households and community members', 'Collected datasets'][a],
            Math.round(budget * [0.1, 0.5, 0.2][a]!),
            spec.currency,
            ['UCC Campus', 'Central Region', 'DRIC Data Lab'][a],
            isPast ? 'COMPLETED' : pStart <= 0 ? (a === 0 ? 'COMPLETED' : a === 1 ? 'ONGOING' : 'PLANNED') : 'PLANNED',
            monthsFromNow(pStart, 3 + a * 8),
            monthsFromNow(pStart, 10 + a * 8),
            isPast && a === 0 ? 'Training completed with all staff certified.' : null,
          ],
        )
        await db.query('INSERT INTO activity_personnel (activity_id, personnel_id) VALUES (?, ?), (?, ?)', [
          actId,
          perIds[(seq + a) % perIds.length],
          actId,
          perIds[(seq + a + 1) % perIds.length],
        ])
      }
      if (pStart > 0) continue
      // One or two claims per started phase, mostly approved and paid in tranches.
      for (let c = 0; c < (pi === 0 ? 2 : 1); c++) {
        const [purpose, lines] = CLAIM_PURPOSES[(seq + pi + c) % CLAIM_PURPOSES.length]!
        const items = lines.map(([d, q, u, days, cost]) => ({ d, q, u, days, cost, total: q * days * cost }))
        const amount = items.reduce((s, i) => s + i.total, 0)
        const claimDate = monthsFromNow(Math.min(0, pStart + c), 5)
        const status = isPast
          ? 'APPROVED'
          : (['APPROVED', 'PENDING', 'PROCESSING', 'APPROVED'] as const)[(seq + c) % 4]!
        const claimId = await ins(
          `INSERT INTO claims (reference, phase_id, investigator_id, purpose, description, reasons, amount, currency, status, signed_name, signed_at,
             received_at, director_decision, director_name, director_decided_at, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'GHS', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `CLM-${code(6)}`,
            phaseId,
            invIds[spec.pi],
            purpose,
            `${purpose} for ${title.toLowerCase()}.`,
            'Funds are needed to carry out the scheduled activities of this phase on time.',
            amount,
            status,
            INVESTIGATORS[spec.pi]!.slice(0, 3).join(' '),
            claimDate,
            status === 'PENDING' ? null : claimDate,
            status === 'APPROVED' ? 'Approved. Pay in tranches as activities progress.' : null,
            status === 'APPROVED' ? 'Prof. DRIC Director' : null,
            status === 'APPROVED' ? claimDate : null,
            adminId,
            `${claimDate} 10:00:00`,
          ],
        )
        for (const [k, i] of items.entries()) {
          await db.query(
            'INSERT INTO claim_items (claim_id, sort, description, quantity, unit, days, unit_cost, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [claimId, k, i.d, i.q, i.u, i.days, i.cost, i.total],
          )
        }
        if (status !== 'APPROVED') continue
        const tranches = isPast ? [0.6, 0.4] : [0.5]
        let monthOffset = Math.min(0, pStart + c)
        for (const [t, share] of tranches.entries()) {
          monthOffset = Math.min(0, monthOffset + t)
          await db.query(
            `INSERT INTO payments (reference, claim_id, description, amount, currency, conversion_rate, paid_at, created_by) VALUES (?, ?, ?, ?, 'GHS', 1, ?, ?)`,
            [
              code(5),
              claimId,
              `Tranche ${t + 1}`,
              Math.round(amount * share * 100) / 100,
              monthsFromNow(monthOffset, 18),
              adminId,
            ],
          )
        }
      }
    }
    if (spec.status !== 'ONGOING' || seq <= 2) {
      const items = Array.from({ length: 12 }, (_, i) => ({
        no: i + 1,
        tick: i !== 8,
        note: i === 8 ? 'Overhead rate to be confirmed with Finance.' : null,
      }))
      await db.query(
        'INSERT INTO kickoff_checklists (project_id, meeting_date, venue, attendees, items, notes, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          projectId,
          start,
          'DRIC Conference Room',
          'Principal Investigator\nCo-investigators\nDRIC Grants Officer\nFinance Officer',
          JSON.stringify(items),
          'Team to submit the first progress report within three months.',
          adminId,
        ],
      )
    }
  }

  // Form requests from the public site.
  const REQUESTS: Array<[string, number, string, string, Record<string, unknown>, Array<unknown> | null]> = [
    [
      'INTENT',
      2,
      'Foundational literacy through mother-tongue instruction',
      'SUBMITTED',
      {
        teamComposition: 'UCC (lead) with University of Ghana',
        applicationDueDate: monthsFromNow(2, 15),
        plannedSubmissionDate: monthsFromNow(2, 1),
        limitedSubmission: 'no',
        collaborative: 'yes',
        leadInstitution: 'University of Cape Coast',
        awardType: 'Grant',
      },
      null,
    ],
    [
      'SUPPORT_LETTER',
      4,
      'Genomic epidemiology of drug-resistant tuberculosis',
      'UNDER_REVIEW',
      { dueDate: monthsFromNow(0, 28), otherInfo: 'Letter should mention UCC laboratory facilities.' },
      null,
    ],
    [
      'PROPOSAL_REVIEW',
      1,
      'Blue economy skills for coastal youth',
      'RECEIVED',
      { submissionDueDate: monthsFromNow(1, 10) },
      null,
    ],
    [
      'SUPPORT_LETTER',
      7,
      'Adolescent sexual and reproductive health in fishing communities',
      'APPROVED',
      { dueDate: monthsFromNow(-1, 20) },
      null,
    ],
    [
      'EQUIPMENT_TRANSFER',
      5,
      'Coastal erosion and land-use change atlas',
      'SUBMITTED',
      {
        projectPeriod: '24 months',
        projectStartDate: monthsFromNow(-26),
        projectEndDate: monthsFromNow(-2, 0),
        equipmentCondition: 'Both units in good working condition; minor wear on the drone casing.',
        equipmentLocation: 'Dept. of Geography GIS Lab',
        currency: 'USD',
      },
      [
        {
          description: 'DJI Phantom 4 RTK drone',
          quantity: 1,
          make: 'DJI',
          model: 'P4 RTK',
          serialNo: '0AXDE5',
          assetNo: 'UCC/GEO/2201',
          year: 2024,
          cost: 7800,
        },
        {
          description: 'Handheld GNSS receiver',
          quantity: 2,
          make: 'Trimble',
          model: 'R2',
          serialNo: 'TR55821',
          assetNo: 'UCC/GEO/2202',
          year: 2024,
          cost: 4100,
        },
      ],
    ],
  ]
  for (const [type, inv, title, status, data, items] of REQUESTS) {
    const [t, first, last, dept, college, faculty, designation] = INVESTIGATORS[inv]!
    await db.query(
      `INSERT INTO requests (reference, access_key, type, status, surname, first_name, college, faculty, department, designation, email, phone, project_title,
         funding_agencies, data, items, attachments, investigator_id, signed_name, signed_at, received_at, director_decision, director_name, director_decided_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, CURDATE(), ?, ?, ?, ?)`,
      [
        `RQ-${code(6)}`,
        randomBytes(16).toString('hex'),
        type,
        status,
        last,
        first,
        college,
        faculty,
        dept,
        designation,
        `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '') + '@ucc.edu.gh',
        '0244000000',
        title,
        type === 'EQUIPMENT_TRANSFER' ? 'International Development Research Centre' : 'Wellcome Trust',
        JSON.stringify(data),
        items ? JSON.stringify(items) : null,
        invIds[inv],
        `${t} ${first} ${last}`,
        status === 'SUBMITTED' ? null : monthsFromNow(0, 1),
        status === 'APPROVED' ? 'Approved. Letter issued.' : null,
        status === 'APPROVED' ? 'Prof. DRIC Director' : null,
        status === 'APPROVED' ? monthsFromNow(0, 2) : null,
      ],
    )
  }
  await db.query(
    "INSERT INTO audit_logs (user_id, action, entity, summary) VALUES (?, 'create', 'project', 'Demo data loaded')",
    [adminId],
  )
  console.log(
    `Demo data loaded: ${FUNDERS.length} funders, ${INVESTIGATORS.length} investigators, ${PROJECTS.length} projects, ${REQUESTS.length} form requests.`,
  )
  console.log(
    'Demo sign-ins (password Demo1234!): director@ / accountant@ / clerk@dric.ucc.edu.gh, ama.mensah@ucc.edu.gh',
  )
  await db.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
