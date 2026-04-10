#!/usr/bin/env bash

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
  return 1
}

resolve_local_firebasetools() {
  local firebase_bin="./node_modules/.bin/firebase"
  if [[ ! -x "$firebase_bin" ]]; then
    echo "firebase-tools is not installed locally. Run npm install first." >&2
    return 1
  fi

  printf '%s\n' "$firebase_bin"
}

run_firestore_emulator_exec() {
  local command="$1"
  local firebase_bin
  firebase_bin="$(resolve_local_firebasetools)" || return 1

  export NO_UPDATE_NOTIFIER="${NO_UPDATE_NOTIFIER:-1}"
  export CI="${CI:-1}"

  "$firebase_bin" emulators:exec --only firestore "$command"
}
