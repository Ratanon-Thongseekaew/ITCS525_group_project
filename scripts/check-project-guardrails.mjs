import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const SKILL_PATH = '.agents/skills/textile-track-development/SKILL.md'
const SOURCE_EXTENSIONS = new Set(['.py', '.ts', '.tsx'])

function lineNumber(text, index) {
  return text.slice(0, index).split('\n').length
}

function addViolation(violations, file, text, index, message) {
  violations.push(`${file}:${lineNumber(text, index)} ${message}`)
}

function walk(directory, root, files) {
  if (!existsSync(directory)) return
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      walk(absolute, root, files)
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.set(
        path.relative(root, absolute).replaceAll(path.sep, '/'),
        readFileSync(absolute, 'utf8'),
      )
    }
  }
}

export function collectViolations(files) {
  const violations = []
  const skill = files.get(SKILL_PATH)

  if (!skill) {
    violations.push(`${SKILL_PATH}:1 shared project skill is missing`)
  } else if (!/^---\s*[\s\S]*?^name:\s*textile-track-development\s*$/m.test(skill)) {
    violations.push(`${SKILL_PATH}:1 skill frontmatter must name textile-track-development`)
  }

  for (const [file, text] of files) {
    if (file.startsWith('backend/app/') && file.endsWith('.py')) {
      const createAll = /\b(?:SQLModel\.)?metadata\.create_all\s*\(/g
      for (const match of text.matchAll(createAll)) {
        addViolation(
          violations,
          file,
          text,
          match.index,
          'production code must evolve schema through Alembic, not metadata.create_all()',
        )
      }

      const route =
        /@(app|router)\.(?:get|post|put|patch|delete|options|head)\(\s*(["'])([^"']+)\2/g
      for (const match of text.matchAll(route)) {
        if (match[1] === 'app' && !match[3].startsWith('/api')) {
          addViolation(
            violations,
            file,
            text,
            match.index,
            `public app route ${match[3]} must be under /api`,
          )
        }
      }

      if (/@router\.(?:get|post|put|patch|delete|options|head)\(/.test(text)) {
        const prefix = /APIRouter\([\s\S]*?prefix\s*=\s*(["'])([^"']+)\1/.exec(text)
        if (!prefix || !prefix[2].startsWith('/api')) {
          violations.push(
            `${file}:1 APIRouter files with public routes must declare an /api prefix`,
          )
        }
      }
    }

    if (file.startsWith('frontend/src/') && /\.(?:ts|tsx)$/.test(file)) {
      const hardcodedOrigin = /https?:\/\/(?:localhost|127\.0\.0\.1):8000/g
      for (const match of text.matchAll(hardcodedOrigin)) {
        addViolation(
          violations,
          file,
          text,
          match.index,
          'use frontend/src/api.ts and VITE_API_URL instead of a hardcoded backend origin',
        )
      }

      if (file !== 'frontend/src/api.ts') {
        const rawFetch = /\bfetch\s*\(/g
        for (const match of text.matchAll(rawFetch)) {
          addViolation(
            violations,
            file,
            text,
            match.index,
            'HTTP calls belong in frontend/src/api.ts',
          )
        }
      }
    }
  }

  const schemas = files.get('backend/app/schemas.py')
  if (schemas) {
    const passwordHash = /^\s*password_hash\s*:/gm
    for (const match of schemas.matchAll(passwordHash)) {
      addViolation(
        violations,
        'backend/app/schemas.py',
        schemas,
        match.index,
        'API schemas must not expose password hashes',
      )
    }
  }

  return violations
}

export function loadRepositoryFiles(root) {
  const files = new Map()
  walk(path.join(root, 'backend', 'app'), root, files)
  walk(path.join(root, 'frontend', 'src'), root, files)
  const skill = path.join(root, ...SKILL_PATH.split('/'))
  if (existsSync(skill)) files.set(SKILL_PATH, readFileSync(skill, 'utf8'))
  return files
}

export function runGuardrails(root = process.cwd()) {
  const violations = collectViolations(loadRepositoryFiles(root))
  if (violations.length > 0) {
    console.error('Project guardrails failed:')
    for (const violation of violations) console.error(`- ${violation}`)
    return 1
  }
  console.log('Project guardrails passed.')
  return 0
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  process.exit(runGuardrails())
}
