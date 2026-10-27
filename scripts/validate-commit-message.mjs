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

function normalizeEmoji(value) {
  return value.replaceAll('\uFE0F', '')
}

function hasValidGitmoji(message) {
  const normalizedMessage = normalizeEmoji(message)

  return gitmojis.some(({ code, emoji }) => {
    if (message.startsWith(code)) {
      return message.slice(code.length).trim().length > 0
    }

    const normalizedEmoji = normalizeEmoji(emoji)
    return (
      normalizedMessage.startsWith(normalizedEmoji) &&
      normalizedMessage.slice(normalizedEmoji.length).trim().length > 0
    )
  })
}

if (!automaticMessage.test(firstLine) && !hasValidGitmoji(firstLine)) {
  console.error(`
Invalid commit message: "${firstLine}"

Start the subject with an official Gitmoji or shortcode.
Format: <gitmoji> [scope]: <message>

Examples:
  ✨ Add role-based login
  🐛 (auth): Fix role redirect
  :memo: Update setup documentation

Run "npm run commit" for an interactive Gitmoji commit.
See https://gitmoji.dev for the complete list.
`)
  process.exit(1)
}
