# Rules Sources

These fragments are the editable sources for the generated root rules files:

- `firestore.rules`
- `storage.rules`

Why this exists:

- the generated root files remain where Firebase and the emulator expect them
- the editable source is split by helper/match area so reviews are smaller
- `scripts/check-rules-generated.mjs` prevents source/output drift

Commands:

- regenerate outputs: `node scripts/build-rules-assets.mjs`
- verify sync: `node scripts/check-rules-generated.mjs`
- verify fragment governance: `node scripts/check-rules-source-governance.mjs`

Firestore source fragments are kept below the governance line limit so security
reviews stay local and new rules do not silently recreate a monolithic rules
file inside a single fragment.
