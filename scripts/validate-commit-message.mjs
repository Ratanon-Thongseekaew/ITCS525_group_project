import { readFileSync } from 'node:fs'
import { gitmojis } from 'gitmojis'

const messageFlagIndex = process.argv.indexOf('--message')
const inlineMessage = messageFlagIndex >= 0 ? process.argv[messageFlagIndex + 1] : undefined
const commitMessagePath = inlineMessage ? undefined : process.argv[2]

if (!inlineMessage && !commitMessagePath) {
  console.error('Commit message validation requires a commit message file.')
  process.exit(1)
}

const rawMessage = inlineMessage ?? readFileSync(commitMessagePath, 'utf8')
const firstLine = rawMessage.split(/\r?\n/, 1)[0].trim()
const automaticMessage = /^(Merge|Revert|fixup!|squash!)/
const allowedTypes = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'chore',
  'revert',
  'wip',
  'build',
  'ci',
]
const allowedScopes = ['api', 'admin', 'web', 'database', 'ci', 'cd', 'docker', 'general']
const convention = new RegExp(
  `^(${allowedTypes.join('|')})(\\((${allowedScopes.join('|')})\\))?!?:\\s+\\S`,
)

function normalizeEmoji(value) {
  return value.replaceAll('\uFE0F', '')
}

function getMessageAfterGitmoji(message) {
  const normalizedMessage = normalizeEmoji(message)

  for (const { code, emoji } of gitmojis) {
    if (message.startsWith(code)) {
      return message.slice(code.length).trim()
    }

    const normalizedEmoji = normalizeEmoji(emoji)
    if (normalizedMessage.startsWith(normalizedEmoji)) {
      return normalizedMessage.slice(normalizedEmoji.length).trim()
    }
  }

  return undefined
}

const conventionalPart = getMessageAfterGitmoji(firstLine)
const isValid = conventionalPart !== undefined && convention.test(conventionalPart)

if (!automaticMessage.test(firstLine) && !isValid) {
  console.error(`
Invalid commit message: "${firstLine}"

Start the subject with an official Gitmoji or shortcode.
Format: <gitmoji> type(scope): <message>

Examples:
  :sparkles: feat(web): Add role-based login
  :bug: fix(api): Fix role redirect
  :memo: docs(general): Update setup documentation

Run "npm run commit" for the Commitizen prompt.
See https://gitmoji.dev for the complete list.
`)
  process.exit(1)
}
