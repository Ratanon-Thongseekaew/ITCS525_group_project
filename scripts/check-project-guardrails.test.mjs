import assert from 'node:assert/strict'
import test from 'node:test'

import { collectViolations } from './check-project-guardrails.mjs'

const validSkill = `---
name: textile-track-development
description: Test fixture
---
`

function validFiles(overrides = {}) {
  return new Map(
    Object.entries({
      '.agents/skills/textile-track-development/SKILL.md': validSkill,
      'backend/app/main.py': '@app.get("/api/health")\nasync def health(): pass\n',
      'backend/app/schemas.py': 'class UserRead:\n    username: str\n',
      'backend/app/users.py':
        'router = APIRouter(prefix="/api/users")\n@router.get("")\ndef users(): pass\n',
      'frontend/src/api.ts': 'export const load = () => fetch("/api/health")\n',
      'frontend/src/page.tsx': 'export const Page = () => <main />\n',
      ...overrides,
    }),
  )
}

test('accepts the repository conventions', () => {
  assert.deepEqual(collectViolations(validFiles()), [])
})

test('rejects create_all in production application code', () => {
  const violations = collectViolations(
    validFiles({ 'backend/app/database.py': 'SQLModel.metadata.create_all(engine)\n' }),
  )
  assert.ok(violations.some((violation) => violation.includes('metadata.create_all()')))
})

test('rejects frontend HTTP calls outside the shared API client', () => {
  const violations = collectViolations(
    validFiles({
      'frontend/src/page.tsx': 'fetch("http://localhost:8000/api/users")\n',
    }),
  )
  assert.ok(violations.some((violation) => violation.includes('HTTP calls belong')))
  assert.ok(violations.some((violation) => violation.includes('hardcoded backend origin')))
})

test('rejects public FastAPI routes outside /api', () => {
  const violations = collectViolations(
    validFiles({ 'backend/app/main.py': '@app.get("/health")\nasync def health(): pass\n' }),
  )
  assert.ok(violations.some((violation) => violation.includes('must be under /api')))
})

test('rejects routers without an /api prefix', () => {
  const violations = collectViolations(
    validFiles({
      'backend/app/users.py':
        'router = APIRouter(prefix="/users")\n@router.get("")\ndef users(): pass\n',
    }),
  )
  assert.ok(violations.some((violation) => violation.includes('must declare an /api prefix')))
})

test('rejects password hashes in API schemas', () => {
  const violations = collectViolations(
    validFiles({ 'backend/app/schemas.py': 'class UserRead:\n    password_hash: str\n' }),
  )
  assert.ok(violations.some((violation) => violation.includes('must not expose password hashes')))
})
