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
- MySQL infrastructure exists, but the backend does not yet have an ORM,
  migrations, a database driver, or application-level database integration.
  SQLModel is the planned ORM, but it has not been installed or configured.
  Authentication and deployment configuration also remain unimplemented.

## Repository map

```text
.
├── frontend/
│   ├── src/
│   │   ├── App.tsx          Client-side route definitions
│   │   ├── components/      Shared layout and dashboard components
│   │   │   └── ui/          Local shadcn/ui component primitives
│   │   ├── config/          Role-aware workspace navigation configuration
│   │   ├── pages/           Login, manager, staff, admin, and 404 pages
│   │   ├── types/           Shared workspace role types and guards
│   │   ├── App.test.tsx     Frontend component test
│   │   ├── api.ts           Typed HTTP client functions
│   │   ├── lib/utils.ts     Shared `cn` class-name utility
│   │   ├── styles.css       Tailwind import and shared dashboard styles
│   │   ├── main.tsx         React application entry point
│   │   └── vite-env.d.ts    Vite TypeScript declarations
│   ├── components.json      shadcn/ui CLI configuration
│   ├── eslint.config.js
│   ├── vite.config.ts       Dev server and `/api` proxy
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── main.py          FastAPI app, middleware, routes, and lifespan
│   │   └── schemas.py       Pydantic response models
│   ├── tests/
│   │   └── test_main.py     API tests using FastAPI TestClient
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

React Router owns client-side navigation. The current frontend routes are:

- `/` and `/login` render the role-based demo login page.
- `/manager` renders the manager workspace.
- `/staff` renders the staff workspace.
- `/admin` renders the administrator workspace.
- `/:role/resale-bins` renders the shared resale-bin placeholder for each
  explicit manager, staff, and admin route.
- `/:role/recycle-bins` renders the shared recycling-bin placeholder for each
  explicit manager, staff, and admin route.
- Unknown frontend paths render the local not-found page.

Authentication is intentionally not enforced yet because the project has no
user database. The login form accepts any non-empty credentials and redirects
to the workspace selected in the role field. All workspace URLs remain directly
accessible. Do not add route guards until a real authentication source is
available or the user explicitly requests mocked protection.

The login view is a fullscreen responsive page based on the provided Textile
Track design. It defaults to the Admin role and exposes a role selector for the
demo flow. Changing the role updates the suggested username and destination.
The role-to-route mapping is maintained in `frontend/src/pages/LoginPage.tsx`.

Authenticated workspace screens share `WorkspaceSidebar`, composed from the
local shadcn sidebar primitives. `frontend/src/config/workspace-navigation.ts`
owns labels, icons, route segments, and the optional `roles` arrays used to
filter menu visibility. Items currently omit `roles`, so all three roles see
the same navigation until permissions are defined. `AppLayout` derives the demo
role from the URL only for presentation; this is not authentication.

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
npm run build           # Type-check and build the frontend
npm run test            # Run frontend tests, then backend tests
npm run lint            # Run ESLint, then Ruff
npm run format          # Format frontend/docs and Python files
npm run format:check    # Check formatting without modifying files
npm run commit          # Create a Commitizen/Gitmoji commit
```

## Continuous integration

`.github/workflows/ci.yaml` runs on pull requests targeting `main`, pushes to
`main`, and manual dispatches. It provides these independent status checks:

- `Backend checks`: Python 3.12, editable `backend[dev]` installation, Ruff
  lint, Ruff format check, and Pytest.
- `Frontend checks`: Node.js 24, `npm ci`, Prettier, ESLint, Vitest, and the
  production Vite build.
- `Compose validation`: validates the resolved Compose configuration with
  disposable CI environment values and does not start containers.

CI dependency caches are keyed from `backend/pyproject.toml` and the root
`package-lock.json`. Superseded runs for the same pull request are cancelled.
MySQL is intentionally absent from CI until SQLModel, migrations, and database
integration tests exist. When those are added, use a MySQL service container
and non-production credentials rather than the repository's local `.env`.

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
  entered manually in VS Code's Source Control commit field.
- The Commitizen npm script sets `SKIP_LINT_STAGED=1` after its initial checks,
  preventing the resulting `git commit` from running lint-staged twice. Direct
  Git and VS Code commits still use the normal pre-commit hook.
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
