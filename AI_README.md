# AI Project Context

This document is the primary context file for AI coding assistants working in
this repository. Read it before making changes. Human setup instructions remain
in [`README.md`](./README.md).

## Project summary

This is a minimal full-stack monorepo:

- `frontend/` is a React 19 single-page application written in TypeScript and
  built with Vite 7. It uses React Router 8, Tailwind CSS 4, local shadcn/ui
  primitives, Radix UI, and Lucide icons.
- `backend/` is a Python 3.11+ HTTP API built with FastAPI and served by
  Uvicorn.
- `compose.yaml` provides the MySQL 8.4 LTS service used for local development.
- The root `package.json` coordinates both applications. The frontend is an npm
  workspace; the Python backend is managed through `backend/pyproject.toml`.
- The backend uses SQLModel as its ORM, PyMySQL as the MySQL driver, and Alembic
  for versioned schema migrations. Database settings are loaded from the root
  `.env`, with an optional `DATABASE_URL` override.
- The backend has JWT authentication and admin user management, but the
  frontend does not use real login yet. Deployment configuration remains
  unimplemented.

## Repository map

```text
.
├── frontend/
│   ├── src/
│   │   ├── App.tsx          Client-side route definitions
│   │   ├── components/      Shared layout and workspace components
│   │   │   ├── staff/       Staff workspace UI, including recycle bin handoff
│   │   │   └── ui/          Local shadcn/ui component primitives
│   │   ├── config/          Role-aware workspace navigation configuration
│   │   ├── pages/           Login, workspace feature, and 404 pages
│   │   ├── types/           Shared workspace role types and guards
│   │   ├── App.test.tsx     Frontend component test
│   │   ├── api.ts           Typed HTTP client functions
│   │   ├── lib/             Helpers: `utils.ts`, handoff formatting/records,
│   │   │                    `use-handoff-workspace.ts`, `use-api-resource.ts`
│   │   ├── test/            Shared test fixtures (dashboard, handoff)
│   │   ├── styles.css       Tailwind import and shared workspace styles
│   │   ├── main.tsx         React application entry point
│   │   └── vite-env.d.ts    Vite TypeScript declarations
│   ├── components.json      shadcn/ui CLI configuration
│   ├── eslint.config.js
│   ├── vite.config.ts       Dev server and `/api` proxy
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── auth.py          Login/me routes, current-user and admin dependencies
│   │   ├── create_admin.py  CLI to create the first administrator
│   │   ├── database.py      Settings, engine, and session dependency
│   │   ├── handoffs.py      Recycle bin handoff routes and scale-photo storage
│   │   ├── main.py          FastAPI app, middleware, routes, and lifespan
│   │   ├── models.py        SQLModel tables and database enums
│   │   ├── schemas.py       Pydantic response models
│   │   ├── security.py      Password hashing, JWT and temporary-password helpers
│   │   ├── sites.py         Admin-only store list for the user form
│   │   ├── sorting.py       Garment sorting and bin record routes (Feature 2)
│   │   ├── user_stores.py   User-to-store (`user_sites`) helpers and response builders
│   │   └── users.py         Admin-only user management routes
│   ├── alembic/             Migration environment and versioned revisions
│   ├── alembic.ini          Alembic configuration
│   ├── seed.py              Development seed: dashboard, handoff and sorting demo data
│   ├── uploads/             Uploaded scale photos (gitignored, `UPLOAD_DIR`)
│   ├── tests/
│   │   ├── test_auth.py     Login, token, role-guard and user-management tests
│   │   ├── test_create_admin.py Administrator CLI tests
│   │   ├── test_database.py SQLModel and migration tests
│   │   ├── test_handoffs.py Recycle bin handoff API tests
│   │   ├── test_main.py     Health and greeting tests
│   │   ├── test_sorting.py  Garment sorting and bin record tests
│   │   ├── test_user_stores.py Full name, stores, temporary passwords, password change
│   │   └── test_users.py    User API and database tests
│   ├── uv.lock              Locked Python dependency graph
│   └── pyproject.toml       Python package and tool configuration
├── .github/
│   └── workflows/
│       └── ci.yaml           Pull request and main-branch CI checks
├── compose.yaml             Local MySQL service
├── .env.example             Safe template for local environment values
├── package.json             Root development commands
└── README.md                Human setup and usage guide
```

Generated directories such as `node_modules/`, `frontend/dist/`, `.venv/`,
`__pycache__/`, and tool caches are not source code and must not be edited.

## Runtime architecture

During local development:

1. Vite serves the frontend at `http://localhost:5173`.
2. Uvicorn serves FastAPI at `http://127.0.0.1:8000`.
3. Browser requests beginning with `/api` are proxied by Vite to port `8000`.
4. `frontend/src/api.ts` can instead use an explicit base URL from
   `VITE_API_URL`.
5. FastAPI permits requests from `http://localhost:5173` through CORS.
6. Docker Compose exposes MySQL only at `127.0.0.1:${MYSQL_PORT:-3307}`. Other
   containers in the Compose project use `mysql:3306`.
7. SQLModel connects through `backend/app/database.py`; Alembic is the only
   supported way to create or update persistent schema. Application startup
   does not call `SQLModel.metadata.create_all()`.

## Database schema

The schema preserves the merged `User(username, password_hash, role)` model and
adds the original project scope plus the four change requests:

- `sites`, `users`, and `user_sites` provide multi-site ownership and allow a
  manager to hold multiple site memberships.
- `bins` supports resale, recycle, and repair bins. `garment_records` supports
  resale, recycle, and repair/upcycle outcomes.
- `handoffs` stores both pickup weights, scale-photo reference, driver details,
  variance, dispute state, and manager approval.
- `contractor_reports` and `contractor_report_entries` preserve six disposition
  categories, including `Incinerated with energy recovery` separately from
  `Landfilled`.
- `epr_quarter_reports` and `epr_quarter_site_snapshots` preserve submitted
  quarterly values. `epr_adjustments` records append-only dated corrections.

The initial migration detects and adopts a compatible `users` table created by
the SQLModel `create_all()` behavior previously merged into `main`. It fails
with a clear error if that table is missing required user API columns.

Database constraints cover foreign keys, unique identifiers, nonnegative
weights, pickup evidence, and disputed-handoff approval. Future API write paths
must additionally enforce site permissions, exactly one site membership for
Staff, and source-record locking after EPR submission.

React Router owns client-side navigation. The current frontend routes are:

- `/` and `/login` render the role-based demo login page.
- `/manager` redirects to the manager compliance dashboard.
- `/manager/compliance-dashboard` and `/admin/compliance-dashboard` render the
  database-backed compliance dashboard.
- `/manager/epr-report/print` and `/admin/epr-report/print` render the standalone
  printable EPR report for the requested `year` and `quarter`.
- `/manager/import` renders the contractor monthly outcome report import page
  and is available from the manager workspace navigation.
- `/manager/resale-bins` renders the database-backed top-five store resale
  summary.
- `/staff/sorting` renders the garment sorting workspace. `/staff` has no route;
  the login page and sidebar logo send staff users to `/staff/sorting`.
- `/staff/direct-resale` loads closed resale bins for the selected staff
  account's site from `GET /api/resale-bins?site_id=`. Processing a bin records
  accepted/rejected counts, revenue, date, and notes with
  `POST /api/resale-bins/{bin_id}/process`.
- `/staff/direct-resale/potential-revenue-analysis` renders Revenue Summary,
  totalling persisted process revenue for the selected site.
- `/staff/direct-resale/processed-bins-record` renders persisted Processed Bin
  History for the selected site. The staff account picker is shared with the
  handoff workspace until frontend login is connected.
- `/staff/recycle-bin-handoff` renders New Bins for Handoff from
  `/api/handoffs/bins`. Selecting a bin opens `NewHandoffRecordDialog`, which
  records the handoff and its pickup evidence through `POST /api/handoffs/pickups`.
  Its Awaiting Approval card counts disputed handoffs at the staff member's site.
  There is no separate scheduling page; handoffs are recorded at pickup.
- `/staff/recycle-bin-handoff/handoff-records` renders Handoff Records from
  `GET /api/handoffs`, read-only. Both handoff pages are staff-only: they share
  `useHandoffWorkspace` and `HandoffActorBar`, a staff-account picker kept in
  `localStorage` until login is connected, and load nothing until a staff
  account is chosen. There is no manager handoff route; managers approve and
  close through the API until a manager screen exists.
- `/admin/users` renders user management, using mock data. It is the admin
  landing page after login; `/admin` has no route.
- Unknown frontend paths render the local not-found page.

The backend provides real authentication (`POST /api/auth/login` issues a JWT and
all `/api/users` routes require an administrator), but the frontend is not yet
connected to it: the demo login is not connected to password verification
or sessions. It requires the suggested username for the selected role and any
non-empty password. Successful submission shows a success toast
and the shared loading screen for two seconds before redirecting to the selected
workspace. A username mismatch keeps the form visible with an inline alert and
an error toast. All workspace URLs remain directly accessible and render without
that login transition. Do not add route guards until a real authentication
source is available or the user explicitly requests mocked protection.

The login view is a fullscreen responsive page based on the provided Textile
Track design. It defaults to the Admin role and exposes a role selector for the
demo flow. Changing the role updates the suggested username and destination.
Each role's landing page comes from `getWorkspaceHomeUrl` in
`frontend/src/config/workspace-navigation.ts`, which the login redirect and the
sidebar logo both use: `/manager`, `/staff/sorting`, and `/admin/users`.

Authenticated workspace screens share `WorkspaceSidebar`, composed from the
local shadcn sidebar primitives. `frontend/src/config/workspace-navigation.ts`
owns labels, icons, route segments, and the `roles` arrays used to filter menu
visibility. Managers see Compliance Dashboard, Resale Bin Records, and Import
Data. Staff see Sorting, Direct Resale, and Recycle Bin Handoff. Admins
see Compliance Dashboard and User Management. `AppLayout` derives the demo role
from the URL only for presentation; this is not authentication.

The backend root path `/` intentionally has no route and returns `404`. Swagger
UI is available at `/docs`. On application startup, the FastAPI lifespan handler
prints the Swagger URL as a separate Uvicorn log line.

## Current API contract

### `GET /api/health`

Used to check backend availability.

```json
{
  "status": "ok"
}
```

### `GET /api/greeting`

Used by the starter React page to demonstrate frontend/backend communication.

```json
{
  "message": "Hello from FastAPI!"
}
```

### Garment sorting and bin records (Feature 2)

`backend/app/sorting.py` stores sorting in MySQL (`bins` and `garment_records`). Reads take a
required `site_id` query parameter. Writes name the acting staff member with `actor_id`
until login is connected; the actor must be a staff user and always works at their own site
(`422` unknown user, `403` not staff, no site, or another site's bin).

- `POST /api/garments/sort` takes `{actor_id, condition, category?, weight_kg?, notes?, bin_id?}`.
  `condition` is `good_reusable` (resale bin), `worn_recyclable` (recycle bin) or
  `repair_upcycle` (repair bin, change request #13). The garment goes to the oldest open bin
  of that type with room at the actor's site. A full bin is skipped; a new bin
  (`BIN-RS|RC|RP-###`) is created when none has room. A `bin_id` of the wrong type, status or
  capacity is ignored; another site's bin returns `403`. `weight_kg` must be 0-50.
- `GET /api/bins/active?site_id=` returns `resale_bin`, `recycle_bin` and `repair_bin`.
- `GET /api/bins?site_id=` lists bins, with optional `bin_type` (`resale` / `recycle` /
  `repair`) and `status` (`active` / `ready` / `handed_off` / `closed`) filters.
- `POST /api/bins` takes `{actor_id, bin_type, bin_code?, max_capacity?, notes?}`. A duplicate
  code at the site returns `409`; capacity is 1-500.
- `POST /api/bins/{id}/close` takes `{actor_id, notes?}`. Sealing a **recycle** bin sets it
  `ready` with `ready_at`, which is what `GET /api/handoffs/bins` lists. Resale and repair bins
  become `closed` with `closed_at`. Empty or already sealed bins return `409`.
- `GET /api/sorting/stats?site_id=` returns today's counts (in the site's timezone), the resale
  capture percentage, and the active bin code and item count per type.
- `GET /api/garments/recent?site_id=&limit=` returns the latest garments for the site.

The staff screen reuses `useHandoffWorkspace` and `HandoffActorBar` to choose the staff member
and loads nothing until one is chosen. Sealed Repair bins have no next step yet. Handoff only
covers recycle bins.

### Authentication and user management

Passwords are stored as salted scrypt hashes (`scrypt$n$r$p$salt$digest`) and are
never returned. Tokens are HS256 JWTs signed with `JWT_SECRET` (at least 32
characters, from the root `.env`) and expire after `ACCESS_TOKEN_MINUTES`
(default 60). Clients send `Authorization: Bearer <token>`. The user's role is
read from the database on every request, so role changes and deletions take
effect immediately. Create the first administrator with
`python -m app.create_admin <email>` after `npm run db:migrate`.

- `POST /api/auth/login` takes `{username, password}` and returns
  `{access_token, token_type, user}`. Unknown users and wrong passwords both return
  `401 Invalid username or password`. `user` is a `UserRead`:
  `{id, username, role, full_name, must_change_password, store}` where `store` is
  `{id, code, name}` or `null`.
- `GET /api/auth/me` returns the current `UserRead`; `401` without a valid token.
- `POST /api/auth/change-password` takes `{current_password, new_password}` (8–128
  characters, different from the current one), clears `must_change_password` and
  returns the `UserRead`. A wrong current password returns `400` (not `401`, so a
  client does not treat it as an expired session).
- `GET /api/users`, `POST /api/users`, `GET /api/users/{id}`,
  `PATCH /api/users/{id}` (any of `username`, `password`, `role`, `full_name`,
  `site_id`), `POST /api/users/{id}/reset-password` and `DELETE /api/users/{id}`
  require the `admin` role (`401` unauthenticated, `403` otherwise, and `403` with the
  message "Password change required" for an administrator who still has a temporary
  password).
  Usernames are lowercase emails; duplicates return `409`. An admin cannot delete
  their own account, the last administrator cannot be demoted, and a user referenced
  by bins, garment records, handoffs, or reports cannot be deleted (`409`) because
  those foreign keys use `ON DELETE RESTRICT`.
- `POST /api/users` takes `{username, role, full_name?, site_id?, password?}`. With no
  `password` the server generates a 14-character temporary password, sets
  `must_change_password`, and returns it once as `temporary_password` (response is
  `Cache-Control: no-store`; it is never stored in plain text or returned again). An
  explicit `password` is accepted for scripts and is not flagged. `reset-password`
  does the same for an existing user (not allowed on your own account). An admin
  setting another user's password through `PATCH` also sets `must_change_password`.
- Stores use the existing `users` ↔ `user_sites` link; no new table. Staff require
  exactly one `site_id`, managers may have one or none, administrators none (`422`
  otherwise, also for an unknown or inactive store). Setting `site_id` on `PATCH`
  makes it the user's only store; `site_id: null` removes it (not allowed for staff).
  `store` is the default membership, otherwise the lowest site id. Changing role to
  administrator removes the store; to staff requires exactly one store. Sending
  `full_name: null` clears the name.
- `GET /api/sites` (admin only) returns active stores `[{id, code, name}]` by name.

### `GET /api/dashboard` (Feature 6 and change requests)

Returns the database-backed compliance dashboard in one response: summary
metrics, all six contractor disposition categories, annual monthly trends,
pending/disputed handoffs, and the available site/contractor/year filter
options. Query parameters support `frequency` (`monthly`, `quarterly`, or
`annual`), `year`, `month`, `quarter`, `site_id`, and `contractor_id`.

Authentication is now implemented (see above), but the site selector is still a
demo filter rather than an authorization boundary. Enforce manager memberships in
the backend before relying on it for access control.

### `GET /api/resale-bins/summary` (Feature 3)

Returns the five sites with the highest summed `actual_value` across resale
bins. The manager resale page displays each site and calculates the combined
actual value of the returned sites.

### Direct Resale processing

- `GET /api/resale-bins?site_id=` lists closed resale bins at a site and joins
  any saved processing record.
- `POST /api/resale-bins/{bin_id}/process` records the staff actor, accepted and
  rejected item counts (which must total the bin count), sale revenue, process
  date, and optional notes. A bin can be processed once. The revenue is also
  saved to `bins.actual_value` for EPR and manager resale reporting.
- `resale_bin_processes` stores process details. Apply its schema with
  `npm run db:migrate` before using the Direct Resale write flow.

### `GET /api/epr/quarterly-report` (EPR change request)

Requires `year` and `quarter` (1–4). Returns one all-site aggregate for both CSV
download and the printable view. Open quarters group garment weights by
`received_at` and imported contractor dispositions by `report_month`. A
recorded resale-bin sale value is the available evidence for resale, and the
stored repair/upcycle classification is used for repaired weight. Submitted
quarters use saved site snapshots.

Recovery is the combined weight of resale, repair and the five non-landfill
dispositions, divided by total weight received. Uncategorized weight and any
excess categorized weight are shown separately.

Use `GET /api/epr/quarterly-report/management` for draft or submitted totals,
the adjustment history, and the available demo recording accounts.
`POST /api/epr/quarterly-report/submit` saves all site snapshots and locks the
quarter in one transaction. `POST /api/epr/quarterly-report/adjustments` appends
the selected site's dated changes in one transaction. Both write endpoints take
the same period query parameters and a demo `actor_id`. The adjustment request
includes the latest adjustment ID seen by the caller, or null for empty history.
The export endpoint continues to return the original snapshot after submission.

Future writes to persisted report inputs, including contractor import, must
call `lock_open_epr_quarter(session, report_date)` before reading or changing
quarter data, in the same transaction. The helper coordinates with submission
and returns HTTP 409 for locked periods. The current import validates only.

### Recycle bin handoff endpoints (Feature 4)

`backend/app/handoffs.py` serves `/api/handoffs`. `GET /options` lists sites,
active contractors, and demo actors with their site memberships. `GET /bins`
lists `ready` recycle bins that have no handoff. `GET /api/handoffs` lists
records with bin, contractor, weights, variance, approval fields, and six
`outcomes` weights summed from contractor report entries (null when none).

`POST /api/handoffs/pickups` is the only way to create a handoff. It is
`multipart/form-data` with `bin_id`, `contractor_id`, `actor_id`,
`picked_up_at` (with a UTC offset, at most 5 minutes in the future), both
weights, `driver_name`, `vehicle_plate_number`, and the `scale_photo` file, and
creates the handoff with its evidence in one transaction. It calls `Handoff.record_pickup_weights()`, which sets
`picked_up`, or `disputed` with manager approval required when the variance is
above 3%, and the bin becomes `handed_off`. `POST /{id}/approve` (disputed only)
and `POST /{id}/close` (picked-up or approved only) require a manager or admin
`actor_id`. Closing also requires at least one `contractor_report_entries` row
for the handoff (the same "reported" rule the dashboard uses), so a handoff and
its bin stay open while the outcome report is pending; closing also closes the
bin. Recording requires a Staff actor who
belongs to the bin's site. Wrong states return 409, unknown actors 422, and a
non-Staff actor or Staff from another site 403.

Photos are validated by content type and file signature (JPEG, PNG, WebP, up to
5 MB), saved under `UPLOAD_DIR` (default `backend/uploads/`), and referenced by
a relative path in `handoffs.scale_photo_url`. Responses expose that as
`/api/handoffs/{id}/scale-photo`. Timestamps in requests must include a UTC
offset. The `scheduled` status remains in the database enum, but no endpoint
creates it. `backend/seed.py` runs `seed_dashboard_data` (`DASH-` records), then
`seed_handoff_data` (`HAND-` ready bins and picked-up handoffs), then `seed_sorting_data`
(`SORT-` empty open bins of each type per site, no garment records so EPR totals are unchanged),
and `seed_direct_resale_data` (four closed, unprocessed Bangkok resale bins). The resale demo
seed is idempotent and adds no garment records; `seed_development_data` runs all four and is
what `main()` and the tests use.

### `POST /api/contractor-reports/validate` (EPR change request)

Validates monthly contractor rows before import. Each row carries six separate
disposition weights, including distinct `landfilled_kg` and
`incinerated_energy_recovery_kg` fields. The endpoint rejects rows whose
categorized total exceeds received weight and returns the remaining
`uncategorized_weight_kg` explicitly.

Keep response models in `backend/app/schemas.py`. When an API response changes,
update all of the following together:

- The FastAPI route and Pydantic model.
- The corresponding TypeScript type and request function in
  `frontend/src/api.ts`.
- Backend and frontend tests.

## Commands

Run commands from the repository root unless a command explicitly says
otherwise. Activate the Python virtual environment before using root commands
that invoke Python.

```bash
npm run dev             # Start frontend and backend together
npm run dev:frontend    # Start only Vite
npm run dev:backend     # Start only FastAPI with reload enabled
npm run db:up           # Start the local MySQL service
npm run db:down         # Stop Compose services without deleting data
npm run db:status       # Show MySQL container and health status
npm run db:logs         # Follow MySQL container logs
npm run db:migrate      # Apply all committed Alembic migrations
npm run db:rollback     # Roll back one Alembic revision
npm run db:revision -- -m "message"  # Autogenerate a new revision
npm run db:check        # Compare SQLModel metadata with upgraded MySQL
python backend/seed.py  # Load dashboard and handoff demo data (idempotent)
npm run guardrails      # Enforce repository architecture policies
npm run test:guardrails # Test the executable policy checker
npm run build           # Type-check and build the frontend
npm run test            # Run frontend tests, then backend tests
npm run lint            # Run ESLint, then Ruff
npm run format          # Format frontend/docs and Python files
npm run format:check    # Check formatting without modifying files
npm run commit          # Guardrails, lint, backend tests, then Commitizen
```

## Continuous integration

`.github/workflows/ci.yaml` runs on pull requests targeting `main`, pushes to
`main`, and manual dispatches. It provides these independent status checks:

- `Backend checks`: Python 3.12, disposable MySQL 8.4, editable `backend[dev]`
  installation, Alembic migration and metadata check, Ruff lint, Ruff format
  check, and Pytest.
- `Frontend checks`: Node.js 24, `npm ci`, Prettier, ESLint, Vitest, and the
  production Vite build. It also runs and tests the executable project
  guardrails.
- `Compose validation`: validates the resolved Compose configuration with
  disposable CI environment values and does not start containers.

CI dependency caches are keyed from `backend/pyproject.toml` and the root
`package-lock.json`. Superseded runs for the same pull request are cancelled.
Backend CI starts a disposable MySQL 8.4 service with non-production
credentials and applies Alembic migrations before running the checks.

Targeted checks:

```bash
npm run test --workspace frontend
npm run lint --workspace frontend
python -m pytest backend
python -m ruff check backend
```

## Implementation conventions

### Git and commits

- Husky runs `lint-staged` before commits and validates the commit subject in
  the `commit-msg` hook.
- Commit subjects must follow `<gitmoji> type(scope): <message>`. Both Unicode
  emoji and GitHub-style shortcodes are accepted by the validator.
- Use `npm run commit` to run lint-staged and then open the Commitizen prompt
  backed by `cz-customizable` and `cz.config.cjs`. A valid message may also be
  entered through the Commitizen prompt.
- Direct `git commit` and editor Source Control commits are blocked by the
  Husky pre-commit hook. All normal commits must use `npm run commit`, which
  runs lint-staged and the full backend Pytest suite before opening Commitizen.
- The Pytest wrapper prefers an isolated `uv` environment locked by
  `backend/uv.lock` and falls back to the project-local `.venv` when `uv` is not
  installed.
- The Commitizen npm script sets `SKIP_LINT_STAGED=1` after its initial checks,
  preventing its approved internal `git commit` from running lint-staged twice.
- Commitizen scopes are selected from `api`, `admin`, `web`,
  `database`, `ci`, `cd`, `docker`, or `general`. A no-scope option is also
  available; update the `scopes` array in `cz.config.cjs` when the
  repository structure requires another scope.
- Do not bypass hooks with `--no-verify` except for a documented emergency.

### Frontend

- Use TypeScript and React function components.
- Use the local shadcn/ui components in `frontend/src/components/ui/` as the
  primary primitives for forms, controls, cards, dialogs, and similar UI.
- Follow the existing Tailwind CSS responsive approach. Full-page entry screens
  should use the small-viewport unit (`min-h-svh`) with an appropriate fallback
  and must remain usable at widths down to 320px.
- Keep reusable shadcn/ui primitives generic. Place application-specific login
  and workspace composition in `pages/` or non-`ui` components.
- Keep workspace menu definitions in `config/workspace-navigation.ts` and use
  each item's optional `roles` list instead of duplicating sidebars per role.
- Preserve the current unprotected workspace routes until database-backed
  authentication is implemented or explicitly requested.
- Keep backend calls and their response types in `frontend/src/api.ts` rather
  than placing raw `fetch` calls throughout components.
- Read public environment variables through `import.meta.env`; Vite variables
  must begin with `VITE_`.
- Keep the application usable at narrow viewport widths.
- Add or update Vitest and Testing Library tests for user-visible behavior.
- Do not hardcode `http://localhost:8000` in components. Use the API helper and
  the existing Vite proxy/environment-variable pattern.

### Backend

- Use async route handlers unless a dependency requires synchronous code.
- Describe request and response bodies with Pydantic models.
- Keep public API routes under `/api`.
- Keep the Swagger UI at FastAPI's default `/docs` path.
- Add backend tests for every new route and for important error cases.
- Preserve the lifespan startup message that shows the Swagger URL unless the
  server host, port, or documentation path becomes configurable. If they become
  configurable, update the message to use the same configuration source.
- Follow Ruff's configured 100-character line length and Python 3.11 target.
- Use the existing `mysql` Compose service for local database work. Do not
  hardcode credentials; read them from `.env` or future application settings.
- Store uploaded files under `UPLOAD_DIR` (default `backend/uploads/`, ignored
  by Git) and keep only a relative path in the database. File uploads use
  `python-multipart`, a backend dependency.
- Add development data to `backend/seed.py` as its own idempotent function
  and call it from `seed_development_data`; keep `seed_dashboard_data`
  unchanged so its counts and tests stay stable.
- Define persistent models in `backend/app/models.py` and evolve the database
  only through reviewed Alembic revisions. Do not restore `create_all()` in the
  application lifespan.
- Run `alembic check` against an upgraded MySQL database before considering a
  model change complete.
- Scope future Staff queries to the user's site; Managers may query one
  permitted site or all sites in their memberships.
- Treat submitted EPR snapshots as immutable and record corrections as new
  dated `epr_adjustments` rows.
- Preserve the named volume unless the user explicitly requests a database
  reset. `docker compose down -v` deletes local database data and is destructive.

## Change checklist

Before considering a code change complete:

1. Confirm the change belongs to the frontend, backend, or both.
2. Keep TypeScript and Pydantic contracts synchronized.
3. Add or update focused tests.
4. Run the relevant test and lint commands.
5. Run `npm run build` after frontend or shared-contract changes.
6. Update `README.md` and this file when commands, architecture, ports, routes,
   or environment variables change.

## Known environment notes

- Python must be available through the active virtual environment before root
  npm scripts can launch the backend.
- In Git Bash on Windows, activate it with:

  ```bash
  source .venv/Scripts/activate
  ```

- In PowerShell, activate it with:

  ```powershell
  .\.venv\Scripts\Activate.ps1
  ```

- FastAPI's `TestClient` may need to run outside a restricted Windows sandbox
  because it starts a local asynchronous worker thread. This is an execution
  environment limitation, not an application failure.
