# AI Agent Instructions

Read [`AI_README.md`](./AI_README.md) before editing this repository. It is the
source of truth for architecture, API contracts, commands, conventions, and the
completion checklist.

Repository-wide requirements:

- Preserve the React/Vite frontend and FastAPI backend monorepo structure.
- Run commands from the repository root and activate `.venv` before Python
  commands.
- Keep backend Pydantic schemas and frontend TypeScript API types synchronized.
- Use local shadcn/ui primitives and the established responsive Tailwind setup
  for new frontend forms and controls.
- Keep `/manager`, `/staff`, and `/admin` unprotected until real authentication
  is implemented or route protection is explicitly requested.
- Keep public API endpoints under `/api` and Swagger at `/docs`.
- Do not edit dependencies, build output, virtual environments, or cache files.
- Update tests and documentation when behavior or configuration changes.
- Before finishing, run relevant tests and linters; run the frontend production
  build when frontend code or shared API contracts change.
- Use an official Gitmoji at the start of commit subjects and do not bypass the
  Husky pre-commit or commit-message hooks.
