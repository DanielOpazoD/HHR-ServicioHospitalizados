#!/usr/bin/env bash
set -euo pipefail

ensure_java_available() {
  if command -v java >/dev/null 2>&1 && java -version >/dev/null 2>&1; then
    return 0
  fi

  local candidates=(
    "/opt/homebrew/opt/openjdk@21"
    "/usr/local/opt/openjdk@21"
    "/opt/homebrew/opt/openjdk"
    "/usr/local/opt/openjdk"
  )

  local candidate
  for candidate in "${candidates[@]}"; do
    if [[ -x "$candidate/bin/java" ]]; then
      export JAVA_HOME="$candidate"
      export PATH="$JAVA_HOME/bin:$PATH"
      if java -version >/dev/null 2>&1; then
        return 0
      fi
    fi
  done

  echo "Java runtime not found. Install OpenJDK 21 or set JAVA_HOME." >&2
  exit 1
}

ensure_java_available

npx -y firebase-tools@13.35.1 emulators:exec --only firestore "npm run test:emulator:sync && npm run test:emulator:ui"
