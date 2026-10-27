import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

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
  const result = spawnSync(executable, ['-m', 'ruff', ...process.argv.slice(2)], {
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
  'Ruff is unavailable. Create .venv and run: python -m pip install -e "./backend[dev]"',
)
process.exit(1)
