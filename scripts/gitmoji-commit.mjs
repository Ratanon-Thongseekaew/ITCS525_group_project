import { spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { gitmojis } from 'gitmojis'
import lintStaged from 'lint-staged'

const commonNames = [
  'sparkles',
  'bug',
  'lipstick',
  'memo',
  'recycle',
  'white-check-mark',
  'wrench',
  'hammer',
  'iphone',
  'passport-control',
  'rotating-light',
  'heavy-plus-sign',
]

const choices = commonNames
  .map((name) => gitmojis.find((gitmoji) => gitmoji.name === name))
  .filter(Boolean)

const stagedChanges = spawnSync('git', ['diff', '--cached', '--quiet'])

if (stagedChanges.status === 0) {
  console.error('\nNo staged files found. Run "git add" before creating a commit.\n')
  process.exit(1)
}

if (stagedChanges.status !== 1) {
  console.error('Unable to inspect staged files.')
  process.exit(stagedChanges.status ?? 1)
}

console.log('\nChecking staged files before creating the commit message...\n')

let checksPassed = false

try {
  checksPassed = await lintStaged()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

if (!checksPassed) {
  console.error('\nStaged-file checks failed. Fix the errors and try again.\n')
  process.exit(1)
}

console.log('\nAll staged-file checks passed. Now describe the commit.\n')

const prompt = createInterface({ input, output })

console.log('\nChoose a Gitmoji intention:\n')
choices.forEach((gitmoji, index) => {
  console.log(`${String(index + 1).padStart(2, ' ')}. ${gitmoji.emoji}  ${gitmoji.description}`)
})

const selection = Number(await prompt.question('\nNumber: '))
const gitmoji = choices[selection - 1]

if (!gitmoji) {
  console.error('Invalid Gitmoji selection.')
  prompt.close()
  process.exit(1)
}

const scope = (await prompt.question('Scope (optional): ')).trim()
const subject = (await prompt.question('Commit message: ')).trim()
prompt.close()

if (!subject) {
  console.error('Commit message cannot be empty.')
  process.exit(1)
}

const scopePart = scope ? ` (${scope}):` : ''
const message = `${gitmoji.emoji}${scopePart} ${subject}`

console.log(`\nCreating commit: ${message}\n`)

const result = spawnSync('git', ['commit', '-m', message], {
  stdio: 'inherit',
  env: {
    ...process.env,
    SKIP_LINT_STAGED: '1',
  },
})

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 1)
