import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const region = process.env.AWS_REGION || 'ap-southeast-2'
const registry = process.env.ECR_REGISTRY
const tag = process.env.IMAGE_TAG || 'latest'

if (!registry) {
  console.error('ECR_REGISTRY environment variable is required.')
  process.exit(1)
}

function aws(args) {
  return execFileSync('aws', ['--region', region, ...args], { encoding: 'utf8' }).trim()
}

const instanceId = aws([
  'ec2',
  'describe-instances',
  '--filters',
  'Name=tag:Project,Values=textile-track',
  'Name=instance-state-name,Values=running',
  '--query',
  'Reservations[0].Instances[0].InstanceId',
  '--output',
  'text',
])

if (!instanceId || instanceId === 'None') {
  console.error('No running EC2 instance found with tag Project=textile-track.')
  process.exit(1)
}

const composeBase64 = Buffer.from(readFileSync('compose.prod.yaml', 'utf8')).toString('base64')

const commands = [
  'set -euo pipefail',
  'for i in $(seq 1 60); do [ -f /opt/textile-track/.env ] && command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1 && break; sleep 3; done',
  'test -f /opt/textile-track/.env',
  'cd /opt/textile-track',
  `printf '%s' '${composeBase64}' | base64 -d > compose.prod.yaml`,
  'TOKEN=$(curl -sX PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")',
  'PUBLIC_IP=$(curl -sH "X-aws-ec2-metadata-token: ${TOKEN}" "http://169.254.169.254/latest/meta-data/public-ipv4")',
  'SITE_DOMAIN="${PUBLIC_IP//./-}.sslip.io"',
  'sed -i "/^SITE_DOMAIN=/d;/^IMAGE_TAG=/d;/^ECR_REGISTRY=/d" .env',
  `printf "ECR_REGISTRY=%s\\nIMAGE_TAG=%s\\nSITE_DOMAIN=%s\\n" "${registry}" "${tag}" "\${SITE_DOMAIN}" >> .env`,
  `aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin ${registry}`,
  'docker compose -f compose.prod.yaml pull',
  'docker compose -f compose.prod.yaml up -d mysql',
  'for i in $(seq 1 40); do [ "$(docker inspect -f "{{.State.Health.Status}}" "$(docker compose -f compose.prod.yaml ps -q mysql)")" = "healthy" ] && break; sleep 2; done',
  'docker compose -f compose.prod.yaml run --rm --no-deps backend alembic -c backend/alembic.ini upgrade head',
  'docker compose -f compose.prod.yaml up -d --remove-orphans',
  'docker image prune -f',
  'echo "Deployed to https://${SITE_DOMAIN}"',
]

const commandId = aws([
  'ssm',
  'send-command',
  '--instance-ids',
  instanceId,
  '--document-name',
  'AWS-RunShellScript',
  '--comment',
  `Deploy ${tag.slice(0, 7)}`,
  '--parameters',
  JSON.stringify({ commands }),
  '--query',
  'Command.CommandId',
  '--output',
  'text',
])

console.log(`Triggered SSM command ${commandId} on ${instanceId}`)

const terminalStatuses = new Set([
  'Success',
  'Cancelled',
  'Failed',
  'TimedOut',
  'Undeliverable',
  'Terminated',
])
let invocation

for (let attempt = 0; attempt < 90; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 4000))
  try {
    invocation = JSON.parse(
      aws([
        'ssm',
        'get-command-invocation',
        '--command-id',
        commandId,
        '--instance-id',
        instanceId,
      ]),
    )
    if (terminalStatuses.has(invocation.Status)) break
  } catch {
    // Invocation record may take a moment to propagate after send-command.
  }
}

if (invocation?.StandardOutputContent) {
  console.log(invocation.StandardOutputContent)
}
if (invocation?.StandardErrorContent) {
  console.error(invocation.StandardErrorContent)
}

if (invocation?.Status !== 'Success') {
  console.error(`SSM deployment failed with status: ${invocation?.Status ?? 'Unknown'}`)
  process.exit(1)
}
