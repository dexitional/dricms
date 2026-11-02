# DRIC Grants — University of Cape Coast

Grant and consultancy management for the Directorate of Research, Innovation and Consultancy (DRIC).

- **Public site** (`/`): DRIC's request forms filled in online, a request tracker, and printable completed forms.
- **Portal** (`/admin`): funders, projects (phases, activities, kick-off checklist, final report), investigators, personnel, claims (requests for disbursement), tranche payments, form requests, user accounts and an activity log.

## Stack

TanStack Start (React 19, file routes, SSR) with a Hono API mounted at `/api`, MySQL via `mysql2`, Tailwind CSS v4 with shadcn-style components (Radix), TipTap for rich text and Recharts for charts. It is an npm-workspaces and Turborepo monorepo:

```
apps/web            TanStack Start app (UI + /api)
  src/routes          pages: public site, /admin portal, /print/* printouts, /api/$
  src/server/api      Hono app: modules/ (one per area) and lib/ (db, auth, storage…)
  src/lib             shared by client and server: zod schemas, form definitions, permissions
packages/db         MySQL pool, SQL migrations, seed scripts
packages/ui         brand tokens (tokens.css) and cn()
packages/tsconfig   shared TypeScript configs
```

## Setup

```bash
npm install
cp packages/db/.env.example packages/db/.env   # set DATABASE_URL (database: dricms)
cp apps/web/.env.example apps/web/.env         # set DATABASE_URL, SESSION_SECRET, CREDENTIALS_KEY
npm run db:setup        # create database, run migrations, seed countries and the first administrator
npm run db:seed-demo    # optional: demo data (only runs on a database with no projects)
npm run dev             # http://localhost:3010
```

Generate the secrets with `openssl rand -hex 32`. `CREDENTIALS_KEY` encrypts funder portal passwords; if you change it, passwords already stored can no longer be read.

The first administrator comes from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `packages/db/.env`. Re-running `npm run db:seed` resets that password. The demo seed adds the accounts `director@`, `accountant@` and `clerk@dric.ucc.edu.gh`, plus the investigator `ama.mensah@ucc.edu.gh`, all with the password `Demo1234!`.

Production: `npm run build`, then `npm start` (serves `apps/web/.output`, on the port in `PORT`). Set `STORAGE_DIR` to a persistent absolute path for uploaded documents.

## Roles

| Role          | Can                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| Administrator | Everything, including user accounts                                                                       |
| Director      | View everything; set claim/request status and record Director/VC decisions                              |
| Accountant    | Process claims and record tranche payments                                                               |
| Clerk         | Maintain funders, projects, investigators, personnel; enter claims; record receipt of requests            |
| Investigator  | Only projects they lead (PI) or co-investigate: view them, manage activities, submit claims; see own payments/requests |

The matrix lives in `apps/web/src/lib/permissions.ts`, and the API enforces it on every route.

## The DRIC forms

| Paper form (`files/forms`)                        | In the system                                                                  | Printout                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------- |
| Request for Disbursement of Project Funds         | **Claims**: breakdown table, amount in words, Director/VC decisions            | `/print/claim/:id`           |
| Intent to Submit a Proposal                       | Public form → Form requests                                                     | `/print/request/:ref`        |
| Request for Institutional Letter of Support       | Public form → Form requests (Director + VC decision)                            | `/print/request/:ref`        |
| Request for Proposal Review, Approval & Submission | Public form → Form requests                                                    | `/print/request/:ref`        |
| Request for Project Close-Out                     | Public form; approving it closes the linked project                            | `/print/request/:ref`        |
| Project Equipment Transfer                        | Public form with equipment table and DRIC inspection of condition              | `/print/request/:ref`        |
| Kick-Off Meeting Checklist                        | Per project (Project → ⋯ → Kick-off checklist)                                  | `/print/kickoff/:projectId`  |
| (new) Tranche payment voucher                     | Each payment                                                                    | `/print/payment/:id`         |

Form wording, fields and notices are defined once in `apps/web/src/lib/forms.ts`. That file drives the public form, the admin review screen and the printout.

## Business rules worth knowing

- Project codes are `DRIC-<year>-<nnn>`, claim references `CLM-XXXXXX`, request references `RQ-XXXXXX`, and payment references five characters.
- A new phase's suggested **balance brought forward** is the previous phase's balance b/f + budget − spent.
- A claim's amount is the sum of its breakdown lines (quantity × days × unit cost), when lines are given.
- Payments are allowed only against **approved** claims. A tranche in another currency carries a conversion rate into the claim's currency, and the converted total can never exceed the claim. A claim that has payments can no longer be edited or declined.
- Applicants track requests with their reference and email. Viewing or printing a submission without signing in requires its private access key, which is included in the confirmation and tracker links.
- Uploads (PDF, Word, Excel, JPG and PNG, up to 10 MB) are checked by content, not just extension, and are served only to signed-in users.
# dricms
