# React + FastAPI Monorepo

A full-stack monorepo with a React/Vite frontend, a FastAPI backend, a
responsive role-based login flow, and separate Manager, Staff, and Admin
workspaces.

For architecture details and implementation guidance intended for AI coding
assistants, see [AI_README.md](./AI_README.md).

## Structure

```text
.
├── frontend/          React, TypeScript, Vite, Tailwind CSS, shadcn/ui
├── backend/           FastAPI application and pytest tests
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
passwords in `.env` before starting the database. The `.env` file is ignored by
Git and must not be committed.

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

The FastAPI application is not connected to MySQL yet; ORM models, migrations,
and the Python database driver will be added separately.

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

| Route      | Purpose                          |
| ---------- | -------------------------------- |
| `/`        | Fullscreen responsive login page |
| `/login`   | Alternate URL for the login page |
| `/manager` | Manager workspace                |
| `/staff`   | Staff workspace                  |
| `/admin`   | Admin workspace                  |

The login page currently runs in demo mode because the project does not have a
user database or authentication API. Select a role, enter any non-empty
credentials, and submit to open the corresponding workspace.

The workspace routes are intentionally **not protected** yet, so they can also
be opened directly during development.

## Frontend UI

- Tailwind CSS provides responsive layout and utility styling.
- Reusable shadcn/ui-style components live in `frontend/src/components/ui/`.
- The login design uses `Card`, `Input`, `Label`, `Select`, and `Button`
  primitives with Lucide icons.
- The login screen fills the available viewport and adapts its header, card,
  typography, and spacing for mobile, tablet, and desktop displays.

## Checks

```bash
npm run build
npm run test
npm run lint
npm run format:check
```

You can run each side independently with `npm run dev:frontend` and `npm run dev:backend`.

## Continuous integration

GitHub Actions runs `.github/workflows/ci.yaml` for pull requests targeting
`main`, pushes to `main`, and manual workflow dispatches. The workflow runs
three independent checks:

- **Backend checks:** install `backend[dev]` on Python 3.12, run Ruff lint and
  formatting checks, then run Pytest.
- **Frontend checks:** install the locked npm dependencies on Node.js 24, check
  Prettier and ESLint, run Vitest, then create a production build.
- **Compose validation:** resolve `compose.yaml` with non-production CI values
  and validate its syntax without starting MySQL.

MySQL is intentionally not started in CI yet because the backend does not have
database integration. Add a MySQL service container, migrations, and database
integration tests when SQLModel is introduced.

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

The interactive command performs these steps in order:

1. Confirm that at least one file has been staged with `git add`.
2. Run lint-staged against the staged files.
3. Stop immediately if ESLint, Prettier, or Ruff fails.
4. After all checks pass, open the Commitizen prompts configured in
   `cz.config.cjs` to select the change type and scope, then enter the subject,
   optional body, breaking changes, and related issues. Available scopes are
   `api`, `admin`, `web`, `database`, `ci`, `cd`, `docker`, and `general`.
5. Create the commit and validate the final message through the `commit-msg`
   hook.

The pre-commit hook is not run twice by the interactive command. Direct commits
from Git or VS Code still run lint-staged normally.

Manual commits and commits created through VS Code are also supported:

```bash
git commit -m ":sparkles: feat(web): Add role-based login"
git commit -m ":bug: fix(api): Fix role redirect"
git commit -m ":memo: docs(general): Update project documentation"
```

See the complete Gitmoji list at https://gitmoji.dev.

The Python hook uses the project-local `.venv` automatically when available,
so commits created from VS Code do not require an activated terminal. The
environment must still be created and have `backend[dev]` installed as described
in the installation section.

# ITCS525_group_project
