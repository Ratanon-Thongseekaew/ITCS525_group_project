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

| Route | Purpose |
| --- | --- |
| `/` | Fullscreen responsive login page |
| `/login` | Alternate URL for the login page |
| `/manager` | Manager workspace |
| `/staff` | Staff workspace |
| `/admin` | Admin workspace |

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

# ITCS525_group_project
