# React + FastAPI Monorepo

A full-stack monorepo with a React/Vite frontend, a FastAPI backend, a
responsive role-based login flow, and separate Manager, Staff, and Admin
workspaces.

For architecture details and implementation guidance intended for AI coding
assistants, see [AI_README.md](./AI_README.md).

## Structure

```text
.
├── frontend/          React app, Nginx config, and production Dockerfile
├── backend/           FastAPI app, tests, and production Dockerfile
├── compose.yaml       Frontend, backend, and MySQL services
├── AI_README.md       Architecture and conventions for AI assistants
├── AGENTS.md          Instructions automatically discovered by AI tools
├── package.json       Shared npm development commands
└── README.md
```

## Requirements

- Node.js 20+ and npm 10+
- Python 3.11+
- Docker Desktop or Docker Engine with Compose

## Install

Install JavaScript dependencies from the repository root:

```bash
npm install
```

Create and activate a Python virtual environment:

```bash
python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install -e "./backend[dev]"
```

macOS/Linux:

```bash
source .venv/bin/activate
python -m pip install -e './backend[dev]'
```

Create the local environment file used by Docker Compose:

```bash
cp .env.example .env
```

On Windows Command Prompt, use `copy .env.example .env`. Change both MySQL
passwords and `JWT_SECRET` in `.env` before starting the application. The
`.env` file is ignored by Git and must not be committed.

## Run with Docker Compose

Build and start the frontend, backend, and MySQL together:

```bash
npm run app:up
```

Compose waits for MySQL, applies Alembic migrations from the backend container,
then starts FastAPI. Nginx serves the built React application and forwards
same-origin `/api` requests to the backend.

- Application: http://localhost:5173
- Backend API and Swagger: http://localhost:8000/docs

The ports can be changed with `FRONTEND_PORT` and `BACKEND_PORT` in `.env`.
Both bind to `127.0.0.1` by default. Check health or follow application logs
with:

```bash
npm run app:status
npm run app:logs
```

Stop the stack without deleting MySQL data or uploaded scale photos:

```bash
npm run app:down
```

MySQL data is stored in `textile-track_mysql_data`; uploaded evidence is stored
in `textile-track_backend_uploads`. Do not pass `-v` to Compose unless both
persistent volumes are intentionally being deleted.

## Database

Local development uses MySQL 8.4 LTS through `compose.yaml`. The database binds
only to `127.0.0.1`, uses `utf8mb4` with `utf8mb4_0900_ai_ci`, and stores data
in the named Docker volume `textile-track_mysql_data`.

Start MySQL:

```bash
npm run db:up
```

Check its status or follow its logs:

```bash
npm run db:status
npm run db:logs
```

Stop MySQL without deleting its data:

```bash
npm run db:down
```

To connect from the host machine, use `127.0.0.1`, the `MYSQL_PORT` from
`.env` (the template uses `3307` to avoid common conflicts with a locally
installed MySQL server), and the database/user/password values from that file.
Containers added to the same Compose project should connect to host `mysql` on
port `3306`.

The backend uses SQLModel with PyMySQL and Alembic. Connection settings are read
from the root `.env`; `DATABASE_URL` can override the individual `MYSQL_*`
values.

Apply the committed schema after MySQL is healthy:

```bash
npm run db:migrate
```

To load demo data for presenting the app, run:

```bash
uv run --project backend --locked python backend/seed.py   # asks before deleting
uv run --project backend --locked python backend/seed.py --yes
```

**The seed deletes all application data first** (the schema and Docker volume
are kept), then loads a fresh demo dataset with dates relative to today. It
refuses databases that aren't local unless you pass `--allow-remote`. The data:

- Five stores: Bangkok `BKK`, Chiang Mai `CNX`, Phuket `HKT`, Khon Kaen `KKC`,
  and Hat Yai `HDY`. There are three contractors: GreenLoop Recycling, Circular
  Fibre Co., and ReWeave Textiles.
- Twelve months of history up to last month: sorted garments, closed resale,
  repair, and recycle bins, handoffs, contractor reports, and submitted EPR
  quarters with one adjustment.
- Last month's GreenLoop reports (Bangkok and Khon Kaen) are left for the import
  demo, and that month's EPR quarter stays open.
- The current month in progress: partly filled bins to sort into, sealed bins
  waiting for pickup, picked-up, disputed, and approved handoffs, and resale bins
  waiting for Direct Resale.
- Contractor report files for the import demo, written to
  `backend/demo_reports/` (ignored by Git). The GreenLoop file has verified,
  flagged, and rejected rows; the Circular Fibre file re-imports reported bins.

Every demo account uses one shared password, `TextileDemo2026!`, or
`DEMO_PASSWORD` if set. The password is public, so these accounts are for local
demos only. Each account is ready to use without a password change:

| Account                       | Role    | Store      |
| ----------------------------- | ------- | ---------- |
| `admin@example.com`           | Admin   | All stores |
| `manager.<store>@example.com` | Manager | That store |
| `staff.<store>@example.com`   | Staff   | That store |

`<store>` is `bkk`, `cnx`, `hkt`, `kkc`, or `hdy`.

Create a migration after changing `backend/app/models.py`, verify that the
metadata matches the migrated database, or roll back one revision during local
development:

```bash
npm run db:revision -- -m "describe the schema change"
npm run db:check
npm run db:rollback
```

Review autogenerated revisions before applying them. `db:rollback` can remove
tables, constraints, or data, so do not use it as a database reset or run it on
shared data without reviewing the downgrade.

| Models                                              | Purpose                                                               |
| --------------------------------------------------- | --------------------------------------------------------------------- |
| `sites`, `users`, `user_sites`                      | Existing user API plus multi-site memberships                         |
| `contractors`                                       | External sorting and recycling partners                               |
| `bins`, `garment_records`                           | Resale, recycling, and repair/upcycle intake routing                  |
| `handoffs`                                          | Pickup evidence, weight comparison, and dispute approval              |
| `contractor_reports`, `contractor_report_entries`   | Monthly reports, six dispositions, and evidence status                |
| `epr_quarter_reports`, `epr_quarter_site_snapshots` | Immutable per-site values captured when a quarter is submitted        |
| `epr_adjustments`                                   | Append-only, dated corrections to previously submitted quarter values |

The initial Alembic migration can adopt the `users` table created by the SQLModel
setup previously merged into `main`; it validates the expected columns and does
not recreate or erase existing users. New tables include foreign keys,
nonnegative-weight checks, required pickup evidence, and approval before a
disputed handoff can close. Site-scoped authorization and submitted-quarter
write blocking must also be enforced by future service/API code.

## Authentication

Set `JWT_SECRET` in the root `.env` (see `.env.example`; at least 32 random
characters). After the database is migrated, create the first administrator
with the virtual environment active:

```bash
python -m app.create_admin admin@example.com
```

The command prompts for the password. Add `--reset-password` to change the
password of an existing account. The API then offers `POST /api/auth/login`,
`GET /api/auth/me`, `POST /api/auth/change-password`, and administrator-only user
management under `/api/users` (see Swagger at `http://127.0.0.1:8000/docs`; use
**Authorize** with the token returned by login).

Each user has an optional `full_name` and a store (their `user_sites` link):
staff need exactly one store, managers may have one, and administrators have none.
`GET /api/sites` (administrator only) lists the active stores for the store
dropdown. The demo seed (`uv run --project backend --locked python backend/seed.py`)
creates five stores and their accounts.

The Add and Edit user forms require a store for staff and managers (the API
still lets a manager have none).

Administrators manage recycling contractors on `/admin/contractors`, backed by
`/api/contractors` (administrator only). Deactivate a contractor to stop it being
chosen for new pickups and report imports while keeping its history. Delete only
works for a contractor with no handoffs or reports.

Administrators add people without choosing a password: `POST /api/users` with no
`password` makes the server generate a temporary one and return it **once** in
`temporary_password`. Give it to the person securely; it cannot be shown again.
`POST /api/users/{id}/reset-password` issues a new temporary password the same way.
Accounts with a temporary password have `must_change_password: true` and can only
call `GET /api/auth/me` and `POST /api/auth/change-password` until they choose
their own password. Run `npm run db:migrate` after pulling: the `full_name` and
`must_change_password` columns come from migration `20261124_0002`.

### Who can use each API

Every endpoint except `GET /api/health`, `GET /api/greeting`, and
`POST /api/auth/login` needs `Authorization: Bearer <token>`. The API reads who
is acting from the token, so requests don't name a user. Without a valid token
it answers `401`; with the wrong role or store, `403`. An account that still has
a temporary password can only change it (`403` "Password change required").

| Area                                                                                   | Who                                                                          |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Users, sites, contractors (`/api/users`, `/api/sites`, `/api/contractors`)             | Administrators                                                               |
| Dashboard, EPR, contractor report import, resale summary                               | Managers and administrators                                                  |
| Sorting, bins, resale bins, and handoff records (reads)                                | Staff: their store. Managers: their stores, or all without one. Admins: all. |
| Sorting garments, creating and sealing bins, recording pickups, processing resale bins | Staff, at their own store                                                    |
| Approving and closing handoffs                                                         | Managers and administrators of the handoff's store                           |

`backend/tests/test_route_auth.py` checks that every route outside that public
list refuses requests without a login, so a new endpoint can't skip it.

## Develop

With the virtual environment active, start both applications:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Interactive API docs: http://localhost:8000/docs

Vite proxies `/api` requests to FastAPI during development. To point the frontend at a different API, copy `frontend/.env.example` to `frontend/.env` and set `VITE_API_URL`.

## Frontend routes

| Route                                                          | Purpose                                             |
| -------------------------------------------------------------- | --------------------------------------------------- |
| `/`                                                            | Fullscreen responsive login page                    |
| `/login`                                                       | Alternate URL for the login page                    |
| `/change-password`                                             | Replace a temporary password                        |
| `/manager`                                                     | Redirects to the compliance dashboard               |
| `/manager/compliance-dashboard`, `/admin/compliance-dashboard` | Database-backed compliance dashboard                |
| `/manager/import`                                              | Contractor monthly outcome report import            |
| `/manager/sorting`                                             | Read-only sorting overview, one site or all sites   |
| `/manager/resale-bins`                                         | Top-five store resale value summary                 |
| `/manager/recycle-bins`                                        | Review, approve, and close recycle bin handoffs     |
| `/staff/sorting`                                               | Garment sorting (Resale, Recycle, Repair / Upcycle) |
| `/staff/direct-resale`                                         | Closed resale bins and processing form              |
| `/staff/direct-resale/potential-revenue-analysis`              | Revenue summary for processed resale bins           |
| `/staff/direct-resale/processed-bins-record`                   | Processed bin history                               |
| `/staff/recycle-bin-handoff`                                   | Record a handoff when the driver arrives            |
| `/staff/recycle-bin-handoff/handoff-records`                   | Handoff records and their status                    |
| `/admin/users`                                                 | User management, the admin landing page             |
| `/admin/contractors`                                           | Contractor management                               |
| `/design-system`                                               | Design system reference (unlisted)                  |

Sign in with the email and password of an account in your local database (see
"Authentication" for creating the first administrator). Each laptop has its own
database, so accounts are not shared through git. Managers land on `/manager`,
staff on `/staff/sorting`, and admins on `/admin/users`.

Workspace pages require sign-in. Staff and managers only open their own
workspace (`/staff/*`, `/manager/*`); opening another one returns them to their
home page. Admins can open any workspace. An account
with a temporary password must set a new one first. The session lasts until the
tab closes or the token expires (`ACCESS_TOKEN_MINUTES`, default 60). Every
page sends the token with its API requests, and an expired token returns to the
login page.

## Quarterly EPR report

On the Compliance Dashboard, select **Export EPR Report**, choose a year and
quarter, then select **Download CSV** or **Open printable report**. Use
**Print report** on the printable page to print or save as PDF.

The report covers all sites. The dashboard's site and contractor filters
apply to the dashboard only. Open quarters use database records, and
submitted quarters use their saved snapshots. The live report uses recorded
garment intake weights, resale weights for bins with a recorded sale value,
garments classified as repair/upcycle, and imported contractor report
dispositions. Garment weights use the intake quarter and contractor outcomes
use the report month. Missing garment weights and weight discrepancies are
shown when present.

Use **Manage EPR Report** to review the all-site draft and confirm **Submit &
Lock**. For a submitted quarter, use **Add Adjustment** to enter a site, date,
reason, and one or more signed weight changes. Management shows the original
and adjusted totals, and CSV and print use the original submitted snapshot.
The signed-in manager or administrator is recorded as the submitter or as the
adjustment's author.

## Dashboard API

`GET /api/dashboard` returns summary metrics, six contractor disposition
categories, monthly trends, pending/disputed handoffs, and filter options from
MySQL. It accepts `frequency`, `year`, `month`, `quarter`, `site_id`, and
`contractor_id` query parameters. It is for managers and administrators, and
every manager can filter by any site.

## Resale summary API

`GET /api/resale-bins/summary` returns the five sites with the highest summed
actual value from resale bins. The manager resale page shows each site's value
and their combined total.

## Garment sorting API

Staff sort each garment as **Good / Reusable** (resale bin), **Worn / Recyclable** (recycle
bin) or **Repair / Upcycle** (repair bin) from `/staff/sorting`, with one tap or the keys
R/1, C/2 and U/3. Garments and bins are stored in MySQL and belong to the staff member's site.
Sorting uses the signed-in staff account and its store (a staff account needs a store assigned).
Staff only see and change their own site. Managers and administrators use `/manager/sorting`, a
read-only overview where they switch between their sites or view all of them combined.

Garments go to the oldest open bin of their type that still has room; a new bin is created
when none has room. Sealing a recycling bin makes it **ready**, so it appears under
`/staff/recycle-bin-handoff`. Resale and repair bins become closed. The endpoints are
`GET /api/bins`, `GET /api/bins/active`, `POST /api/bins`, `POST /api/bins/{id}/close`,
`POST /api/garments/sort`, `GET /api/garments/recent` and `GET /api/sorting/stats`; see
[AI_README.md](./AI_README.md) for their parameters.

## Recycle bin handoff API

Every recycling handoff records the staff and driver pickup weights, a photo of
the scale reading, and the driver's name and vehicle plate number. If the two
weights differ by more than 3%, the handoff becomes **Disputed**, appears on the
compliance dashboard, and needs manager approval before it can be closed.

| Endpoint                             | Purpose                                                      |
| ------------------------------------ | ------------------------------------------------------------ |
| `GET /api/handoffs/options`          | Sites and active contractors                                 |
| `GET /api/handoffs/bins`             | Ready recycling bins without a handoff (optional `site_id`)  |
| `GET /api/handoffs`                  | Handoff records (optional `site_id` and `status`)            |
| `POST /api/handoffs/pickups`         | Record a handoff and its pickup evidence in one step         |
| `GET /api/handoffs/{id}/scale-photo` | Download the uploaded scale photo                            |
| `POST /api/handoffs/{id}/approve`    | Manager or admin approval of a disputed handoff              |
| `POST /api/handoffs/{id}/close`      | Manager or admin closes a handoff once outcomes are reported |

On **New Bins for Handoff**, staff select a bin when the driver arrives and record
the contractor, pickup time, both weights, the scale photo, and the driver
details in one step. The pickup date and time default to now and can't be in
the future. The form warns before saving when the weights differ by more than
3%, and the page's **Awaiting Approval** card counts disputed handoffs.
**Handoff Records** lists the site's handoffs with their evidence, status, and
outcomes. These pages are a staff workplace: they use the signed-in staff account
and its store, and show that account. Managers review handoffs on **Recycle Bin
Records** (`/manager/recycle-bins`): they approve disputed handoffs and close
handoffs after reviewing the reported outcomes. A handoff (and its bin) can only
be closed after the contractor's outcome report for it has been saved.

The signed-in user is recorded with each handoff. Only staff can record
handoffs, and only for their own site; only managers and admins of the
handoff's store can approve or close them. Lists and scale photos follow the
sorting site rules. **View scale photo** downloads the photo with the token and
opens it in a new tab. Timestamps must include
a UTC offset. Scale photos must be JPEG, PNG, or WebP up to 5 MB and are stored
in `backend/uploads/` (ignored by Git); set `UPLOAD_DIR` in `.env` to change it.

Demo bins and handoffs for these pages come from the demo seed
(`python backend/seed.py`; see Database above).

## Contractor report import

Managers import each contractor's monthly outcome report (CSV or XLSX) on the
import page. `POST /api/contractor-reports/parse-and-validate` checks every row
before anything is saved, and `POST /api/contractor-reports/import` saves the
valid rows. `Landfilled` and `Incinerated with energy recovery` remain separate
categories, categorized weight cannot exceed received weight, and any remaining
weight is shown as uncategorized. Each row's bin must have been picked up in the
report month by the selected contractor. See `AI_README.md` for the full rules.

## Frontend UI

- Tailwind CSS provides responsive layout and utility styling.
- Reusable shadcn/ui components live in `frontend/src/components/ui/`, themed
  by the tokens in `frontend/src/styles.css`. The theme is shadcn's neutral one
  with a teal-700 primary color. Open `/design-system` to see every component
  in light and dark mode. People choose Light, Dark, or System with the theme
  button in the workspace header and on the login page; see "Design system" in
  `AI_README.md`.
- `WorkspaceSidebar` provides the responsive shared navigation for manager,
  staff, and admin workspaces. Menu definitions live in
  `frontend/src/config/workspace-navigation.ts`; add a `roles` list to a menu
  item when role-specific visibility is required.
- The login design uses `Card`, `Input`, `Label`, and `Button` primitives with
  Lucide icons.
- The login screen fills the available viewport and adapts its header, card,
  typography, and spacing for mobile, tablet, and desktop displays.

## Checks

```bash
npm run build
npm run test
npm run lint
npm run format:check
npm run guardrails
npm run test:guardrails
```

You can run each side independently with `npm run dev:frontend` and `npm run dev:backend`.

## Continuous integration

GitHub Actions runs `.github/workflows/ci.yaml` for pull requests targeting
`main`, pushes to `main`, and manual workflow dispatches. The workflow runs
three independent checks:

- **Backend checks:** start MySQL 8.4, install `backend[dev]` on Python 3.12,
  apply every Alembic migration, verify SQLModel metadata with `alembic check`,
  run Ruff lint and formatting checks, then run Pytest.
- **Frontend checks:** install the locked npm dependencies on Node.js 24, check
  and test the executable project guardrails, check Prettier and ESLint, run
  Vitest, then create a production build.
- **Compose validation:** resolve the full frontend/backend/MySQL stack with
  non-production CI values and validate its syntax without starting services.

The backend CI job uses a disposable MySQL service with non-production
credentials and applies all migrations before running checks. Database tests
also exercise a clean migration and adoption of the previously merged `users`
table against SQLite.

After the workflow has run at least once, configure the `main` branch ruleset
to require `Backend checks`, `Frontend checks`, and `Compose validation` before
a pull request can be merged.

## Commit standards

This repository uses Husky, lint-staged, Prettier, Ruff, Commitizen,
cz-customizable, and Gitmoji to keep commits consistent.

After cloning, `npm install` runs the `prepare` script and installs the Git
hooks. Before each commit:

- Staged frontend source files run through ESLint and Prettier.
- Staged Python files run through Ruff check and Ruff format.
- Staged Markdown, JSON, and YAML files run through Prettier.
- The commit subject must begin with an official Gitmoji or shortcode.

Recommended interactive commit command:

```bash
git add .
npm run commit
```

Direct `git commit` and commits from editor Source Control are intentionally
blocked by the Husky pre-commit hook. Use `npm run commit` so staged-file checks
and the backend test suite pass before Commitizen creates the commit.

The interactive command performs these steps in order:

1. Run and test the executable project guardrails.
2. Confirm that at least one file has been staged with `git add` and run
   lint-staged against the staged files.
3. Run the complete backend Pytest suite.
4. Stop immediately if lint, formatting, or tests fail.
5. After all checks pass, open the Commitizen prompts configured in
   `cz.config.cjs` to select the change type and scope, then enter the subject,
   optional body, breaking changes, and related issues. Available scopes are
   `api`, `admin`, `web`, `database`, `ci`, `cd`, `docker`, and `general`.
6. Create the commit and validate the final message through the `commit-msg`
   hook.

The interactive command marks only its internal Commitizen commit as approved,
so the pre-commit hook does not repeat checks that already passed.

See the complete Gitmoji list at https://gitmoji.dev.

The Pytest wrapper uses `uv` with `backend/uv.lock` when available, then falls
back to the project-local `.venv`. `npm run commit` therefore does not require
an activated terminal. Without `uv`, the virtual environment must contain
`backend[dev]` as described in the installation section.

# ITCS525_group_project

## AI Usage Declaration

The following AI tools were used as coding assistants during development:

- **Claude Opus 5.5 (Anthropic):** Used with the Figma MCP server to work with
  Figma designs and build complex interfaces. It also assisted with reviewing
  teammates' code for integration, debugging errors, and generating Markdown
  documents and commit messages. Plan mode was used to review, understand, and
  approve each plan before changes were made. All AI-generated output was
  reviewed and edited to align with the developer's directions.
- **Gemini 3.8 (Google):** Assisted with development in the app directory,
  including structuring files, resolving integration bugs, and writing clear
  code comments.
- **Codex with GPT 6.1 sol (OpenAI):** Used as a coding assistant during
  development and to draft and update project documentation.

AI was used strictly as a coding assistant. All generated code was personally
reviewed, manually tested, and adjusted by the developer to meet the project
requirements and run stably.
