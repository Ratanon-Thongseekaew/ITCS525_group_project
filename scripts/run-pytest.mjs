import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const pytestArgs = ['backend', ...process.argv.slice(2)]
const uvResult = spawnSync(
  'uv',
  ['run', '--isolated', '--project', 'backend', '--extra', 'dev', 'pytest', ...pytestArgs],
  { stdio: 'inherit' },
)

if (!uvResult.error) {
  process.exit(uvResult.status ?? 1)
}

if (uvResult.error.code !== 'ENOENT') {
  console.error(uvResult.error.message)
  process.exit(1)
}

const localPython =
  process.platform === 'win32'
    ? path.resolve('.venv', 'Scripts', 'python.exe')
    : path.resolve('.venv', 'bin', 'python')

const candidates = [
  ...(existsSync(localPython) ? [localPython] : []),
  process.platform === 'win32' ? 'python' : 'python3',
  'python',
]

for (const executable of [...new Set(candidates)]) {
  const result = spawnSync(executable, ['-m', 'pytest', ...pytestArgs], {
    stdio: 'inherit',
  })

  if (!result.error) {
    process.exit(result.status ?? 1)
  }

  if (result.error.code !== 'ENOENT') {
    console.error(result.error.message)
    process.exit(1)
  }
}

console.error(
  'Pytest is unavailable. Install uv, or create .venv and run: ' +
    'python -m pip install -e "./backend[dev]"',
)
process.exit(1)
