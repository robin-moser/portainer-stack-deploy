#!/bin/bash

set -e

main() {

  if [ -n "$1" ]; then
    echo "Using provided port: $1"
    ports="$1"
  else
    ports="16000 16001 16002 16003"
  fi

  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  for port in $ports; do
    PORTAINER_HOST="http://localhost:$port"
    echo "Setting up Portainer on $PORTAINER_HOST"
    if CI_TOKEN=$(setup "$PORTAINER_HOST"); then

      # write current Portainer host and token to .env file
      echo "INTEGRATION_PORTAINER_HOST=$PORTAINER_HOST" >> "$SCRIPT_DIR/.env"
      echo "INTEGRATION_PORTAINER_TOKEN=$CI_TOKEN" >> "$SCRIPT_DIR/.env"

      # Run integration tests
      npm run test:integration || true

    else
      echo "Failed to set up Portainer on $PORTAINER_HOST: $CI_TOKEN"
    fi
  done

  # Remove old Portainer token entries from .env file
  needle='# AUTO_INTEGRATION_SEPERATOR #'
  if grep -q "$needle" "$SCRIPT_DIR/.env"; then
    echo "Removing old Portainer token entries from $SCRIPT_DIR/.env"
    sed -i "" "/$needle/q" "$SCRIPT_DIR/.env"
  fi
}

setup() {
  PORTAINER_HOST="$1"
  ADMIN_USER="admin"
  ADMIN_PASS="portainer-password-admin"
  CI_USER="ci"
  CI_PASS="portainer-password-ci"

  # Admin login
  ADMIN_TOKEN=$(curl -s -X POST "$PORTAINER_HOST/api/auth" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" | \
    jq -r '.jwt')

  if [ "$ADMIN_TOKEN" = "null" ] || [ -z "$ADMIN_TOKEN" ]; then
    echo "Failed to login as admin"
    exit 1
  fi

  # Create CI user
  curl -s -X POST "$PORTAINER_HOST/api/users" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"Username\":\"$CI_USER\",\"Password\":\"$CI_PASS\",\"Role\":2}" > /dev/null

  # Get user ID from api
  USER_ID=$(curl -s -X GET "$PORTAINER_HOST/api/users" \
    -H "Authorization: Bearer $ADMIN_TOKEN" | \
    jq -r --arg CI_USER "$CI_USER" '.[] | select(.Username == $CI_USER) | .Id')

  # CI user login
  CI_JWT_TOKEN=$(curl -s -X POST "$PORTAINER_HOST/api/auth" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$CI_USER\",\"password\":\"$CI_PASS\"}" | \
    jq -r '.jwt')

  if [ "$CI_JWT_TOKEN" = "null" ] || [ -z "$CI_JWT_TOKEN" ]; then
    echo "Failed to login as CI user"
    exit 1
  fi

  # Add CI user to Endpoint 1 (default endpoint)
  curl -s -X PUT "$PORTAINER_HOST/api/endpoints/1" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"UserAccessPolicies\":{\"$USER_ID\":{\"RoleId\":0}}}" > /dev/null

  # Create CI token
  CI_TOKEN=$(curl -s -X POST "$PORTAINER_HOST/api/users/$USER_ID/tokens" \
    -H "Authorization: Bearer $CI_JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"description\":\"CI Access Token\",\"password\":\"$CI_PASS\"}" | \
    jq -r '.rawAPIKey')

  echo "$CI_TOKEN"
}

main "$@"
