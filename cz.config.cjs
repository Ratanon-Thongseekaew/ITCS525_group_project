module.exports = {
  types: [
    { value: ':sparkles: feat', name: '✨ feat:\tAdd a new feature' },
    { value: ':bug: fix', name: '🐛 fix:\tFix a bug' },
    { value: ':memo: docs', name: '📝 docs:\tAdd or update documentation' },
    {
      value: ':lipstick: style',
      name: '💄 style:\tAdd or update styles, UI, or UX',
    },
    {
      value: ':recycle: refactor',
      name: '♻️ refactor:\tChange code without fixing a bug or adding a feature',
    },
    { value: ':zap: perf', name: '⚡️ perf:\tImprove performance' },
    { value: ':white_check_mark: test', name: '✅ test:\tAdd or update tests' },
    {
      value: ':truck: chore',
      name: '🚚 chore:\tUpdate tooling, dependencies, or auxiliary tasks',
    },
    { value: ':rewind: revert', name: '⏪️ revert:\tRevert a commit' },
    { value: ':construction: wip', name: '🚧 wip:\tCommit work in progress' },
    {
      value: ':construction_worker: build',
      name: '👷 build:\tAdd or update the build process',
    },
    { value: ':green_heart: ci', name: '💚 ci:\tAdd or update CI/CD configuration' },
  ],

  scopes: [
    { name: 'api' },
    { name: 'admin' },
    { name: 'web' },
    { name: 'database' },
    { name: 'ci' },
    { name: 'cd' },
    { name: 'docker' },
    { name: 'general' },
  ],

  usePreparedCommit: false,
  allowTicketNumber: false,
  isTicketNumberRequired: false,
  ticketNumberPrefix: 'TICKET-',
  ticketNumberRegExp: '\\d{1,5}',

  messages: {
    type: "Select the type of change that you're committing:",
    scope: '\nSelect the scope of this change (optional):',
    subject: 'Write a short, imperative description of the change:\n',
    body: 'Provide a longer description (optional). Use "|" for a new line:\n',
    breaking: 'List any breaking changes (optional):\n',
    footer: 'List any issues closed by this change (optional), for example #31:\n',
    confirmCommit: 'Are you sure you want to create this commit?',
  },

  allowCustomScopes: false,
  allowBreakingChanges: [':sparkles: feat', ':bug: fix'],
  subjectLimit: 100,
}
