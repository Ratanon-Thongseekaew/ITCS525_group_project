import { spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { gitmojis } from 'gitmojis'

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
})

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 1)
