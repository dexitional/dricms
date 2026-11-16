# DRIC Grants — University of Cape Coast

Grant and consultancy management for the Directorate of Research, Innovation and Consultancy (DRIC).

- **Public site** (`/`): DRIC's request forms filled in online, a request tracker, and printable completed forms.
- **Portal** (`/admin`): funders, projects (phases, activities, kick-off checklist, final report, balance sheet), investigators, personnel, claims (requests for disbursement) with supporting documents, tranche payments and their retirement with receipts, funder remittances, form requests, user accounts and an activity log.

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
| Director      | View everything, including every project's balance sheet; set claim/request status and record Director/VC decisions |
| Accountant    | Record tranche payments and funder remittances; review (accept/reject) retirement receipts; process claims (status, receipt date) but not create, edit or delete them; read-only funders, projects and phases; sees only their own activity log; no access to investigators, personnel or form requests |
| Clerk         | Maintain funders, projects, investigators, personnel; enter claims; record receipt of requests; enter retirement receipts on a PI's behalf |
| Investigator  | Only projects they lead (PI) or co-investigate: view them and their balance sheet, manage activities, submit claims with supporting documents, retire their tranches with receipts; see own payments/requests |

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
| (new) Tranche retirement statement                | Each payment: receipts by activity and what is left to retire                   | `/print/retirement/:id`      |
| (new) Project balance sheet                       | Project → Funds & balance: remittances in, tranches out, running balance        | `/print/ledger/:projectId`   |

Form wording, fields and notices are defined once in `apps/web/src/lib/forms.ts`. That file drives the public form, the admin review screen and the printout.

## Business rules worth knowing

- Project codes are `DRIC-<year>-<nnn>`, claim references `CLM-XXXXXX`, request references `RQ-XXXXXX`, and payment references five characters.
- A new phase's suggested **balance brought forward** is the previous phase's balance b/f + budget − spent.
- A claim's amount is the sum of its breakdown lines (quantity × days × unit cost), when lines are given.
- Payments are allowed only against **approved** claims. A tranche in another currency carries a conversion rate into the claim's currency, and the converted total can never exceed the claim. A claim that has payments can no longer be edited or declined.
- Claims carry supporting documents (invoices, quotations…) uploaded with the form; like the rest of the claim they are fixed once a tranche has been paid.
- **Funder remittances** (`RMT-XXXXXX`) record money a funder sends to a project, with an exchange rate into the project's currency. Each project keeps a **balance sheet** in its own currency: remittances in, tranches out, closing balance = received − paid out. It is computed live from the rows (`server/api/lib/ledger.ts`) and shown on the project's *Funds & balance* tab, the projects list, the funder page and the dashboards.
- A tranche is charged to the balance sheet at its **project rate** (tranche currency → project currency). It is 1 when the tranche is in the project's currency and the claim conversion rate when the claim is; otherwise the accountant enters it (as "1 USD = ? GHS"). Tranches recorded before this existed and in neither currency show as "no rate" until edited.
- Every tranche is **retired** line by line against the activities of its claim's phase, each line with at least one receipt. Lines can't exceed the tranche; the accountant or an administrator accepts or rejects them (a rejection needs a reason, and the investigator can correct and resubmit). Only accepted lines count as retired, and accepted lines are locked.
- Once a project has received or paid out money its currency can't change; a tranche with retirement lines can't be deleted, moved to another claim or re-currencied; an activity with retirement lines can't be deleted.
- Applicants track requests with their reference and email. Viewing or printing a submission without signing in requires its private access key, which is included in the confirmation and tracker links.
- Uploads (PDF, Word, Excel, JPG and PNG, up to 10 MB) are checked by content, not just extension, and are served only to signed-in users.
# dricms
