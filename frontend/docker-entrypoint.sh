#!/bin/sh
set -eu

SITE_DOMAIN="${SITE_DOMAIN:-:80}"
ALLOWED_CLIENT_CIDRS="${ALLOWED_CLIENT_CIDRS:-0.0.0.0/0 ::/0}"

# Normalize whitespace/commas so operators can pass space- or comma-separated CIDRs.
ALLOWED_LIST=$(printf '%s' "$ALLOWED_CLIENT_CIDRS" | tr ',' ' ' | xargs)
if [ -z "$ALLOWED_LIST" ]; then
  ALLOWED_LIST="0.0.0.0/0 ::/0"
fi

cat > /etc/caddy/Caddyfile <<EOF
${SITE_DOMAIN} {
	@allowed {
		remote_ip ${ALLOWED_LIST}
	}
	handle @allowed {
		handle /api/* {
			reverse_proxy backend:8000
		}
		handle /docs* {
			reverse_proxy backend:8000
		}
		handle /openapi.json {
			reverse_proxy backend:8000
		}
		handle {
			root * /srv
			try_files {path} /index.html
			file_server
		}
	}
	handle {
		respond "Forbidden" 403
	}
}
EOF

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
