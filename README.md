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
```

You can run each side independently with `npm run dev:frontend` and `npm run dev:backend`.

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
