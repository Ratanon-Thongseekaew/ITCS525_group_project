import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const localAlembic =
  process.platform === 'win32'
    ? path.resolve('.venv', 'Scripts', 'alembic.exe')
    : path.resolve('.venv', 'bin', 'alembic')

const candidates = [...(existsSync(localAlembic) ? [localAlembic] : []), 'alembic']
const args = ['-c', 'backend/alembic.ini', ...process.argv.slice(2)]

const uvResult = spawnSync(
  'uv',
  ['run', '--isolated', '--project', 'backend', 'alembic', ...args],
  { stdio: 'inherit' },
)

if (!uvResult.error) process.exit(uvResult.status ?? 1)
if (uvResult.error.code !== 'ENOENT') {
  console.error(uvResult.error.message)
  process.exit(1)
}

for (const executable of [...new Set(candidates)]) {
  const result = spawnSync(executable, args, { stdio: 'inherit' })

  if (!result.error) process.exit(result.status ?? 1)
  if (result.error.code !== 'ENOENT') {
    console.error(result.error.message)
    process.exit(1)
  }
}

console.error(
  'Alembic is unavailable. Create .venv and run: python -m pip install -e "./backend[dev]"',
)
process.exit(1)
