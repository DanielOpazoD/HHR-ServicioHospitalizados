# Getting Started & Developer Setup

# Getting Started & Developer Setup

<details>
<summary>Relevant source files</summary>

The following files were used as context for generating this wiki page:

- [.github/workflows/ci-cd.yml](.github/workflows/ci-cd.yml)
- [.nvmrc](.nvmrc)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [README.md](README.md)
- [docs/CI_GATES_AND_FAILURE_RUNBOOKS.md](docs/CI_GATES_AND_FAILURE_RUNBOOKS.md)
- [docs/DEVELOPER_COMMANDS.md](docs/DEVELOPER_COMMANDS.md)
- [docs/QUALITY_GUARDRAILS.md](docs/QUALITY_GUARDRAILS.md)
- [docs/RUNBOOK_LOCAL_E2E_EMULATOR.md](docs/RUNBOOK_LOCAL_E2E_EMULATOR.md)
- [docs/architecture/build-chunking.md](docs/architecture/build-chunking.md)
- [e2e/auth-multi-tab-lock.spec.ts](e2e/auth-multi-tab-lock.spec.ts)
- [e2e/census-navigation.spec.ts](e2e/census-navigation.spec.ts)
- [e2e/census-persistence-reload.spec.ts](e2e/census-persistence-reload.spec.ts)
- [e2e/chaos-network.spec.ts](e2e/chaos-network.spec.ts)
- [e2e/comprehensive.spec.ts](e2e/comprehensive.spec.ts)
- [e2e/export-artifact-validation.spec.ts](e2e/export-artifact-validation.spec.ts)
- [e2e/legacy-firebase-compat.spec.ts](e2e/legacy-firebase-compat.spec.ts)
- [e2e/startup-performance-budget.spec.ts](e2e/startup-performance-budget.spec.ts)
- [e2e/sync-conflict-resolution.spec.ts](e2e/sync-conflict-resolution.spec.ts)
- [functions/index.js](functions/index.js)
- [netlify.toml](netlify.toml)
- [package.json](package.json)
- [playwright.emulator-critical.config.ts](playwright.emulator-critical.config.ts)
- [public/version.json](public/version.json)
- [scripts/check-chunk-graph.mjs](scripts/check-chunk-graph.mjs)
- [scripts/check-feature-public-api-boundary.mjs](scripts/check-feature-public-api-boundary.mjs)
- [scripts/check-quality-aggregate.mjs](scripts/check-quality-aggregate.mjs)
- [scripts/check-release-evidence.mjs](scripts/check-release-evidence.mjs)
- [scripts/check-technical-ownership-map.mjs](scripts/check-technical-ownership-map.mjs)
- [scripts/config/chunkingPolicy.ts](scripts/config/chunkingPolicy.ts)
- [scripts/config/flow-performance-budgets.json](scripts/config/flow-performance-budgets.json)
- [scripts/config/guardrail-governance.json](scripts/config/guardrail-governance.json)
- [scripts/config/technical-ownership-map.json](scripts/config/technical-ownership-map.json)
- [scripts/feature-public-api-allowlist.json](scripts/feature-public-api-allowlist.json)
- [scripts/releaseConfidenceMatrixSupport.mjs](scripts/releaseConfidenceMatrixSupport.mjs)
- [src/features/census/components/CensusModals.tsx](src/features/census/components/CensusModals.tsx)
- [src/features/census/components/CensusPrintHeader.tsx](src/features/census/components/CensusPrintHeader.tsx)
- [src/index.css](src/index.css)
- [src/service-worker.ts](src/service-worker.ts)
- [src/services/auth/authFlow.ts](src/services/auth/authFlow.ts)
- [src/services/auth/authShared.ts](src/services/auth/authShared.ts)
- [src/shared/runtime/e2eRuntime.ts](src/shared/runtime/e2eRuntime.ts)
- [src/tests/build/chunkingPolicy.test.ts](src/tests/build/chunkingPolicy.test.ts)
- [src/tests/build/releaseConfidenceMatrixSupport.test.ts](src/tests/build/releaseConfidenceMatrixSupport.test.ts)
- [src/tests/build/releaseEvidence.test.ts](src/tests/build/releaseEvidence.test.ts)
- [src/tests/security/netlifyHeadersStatic.test.ts](src/tests/security/netlifyHeadersStatic.test.ts)
- [vite.config.ts](vite.config.ts)

</details>

This page details the environment configuration, local development workflow, and quality enforcement pipeline for the HHR (Hospital Hanga Roa) ServicioHospitalizados codebase.

## 1. Environment Prerequisites

The project enforces specific runtime versions to ensure consistency across development, CI, and production environments.

- **Node.js**: `22.x` (enforced by `.nvmrc` and `package.json` engines) [[.nvmrc:1-1](), [package.json:6-8]()].
- **npm**: `10+` [[README.md:15-15]()].
- **Java**: Version `21` (required for Firebase Emulators) [[.github/workflows/ci-cd.yml:173-178]()].

### Node.js Version Policy

The main workspace uses Node `22.x` for all build and quality tasks. However, the `functions/` directory maintains a Node `20` target to match the current Firebase Functions production runtime [[README.md:18-23]()].

## 2. Local Setup & Installation

1.  **Clone the repository.**
2.  **Install dependencies**:
    ```bash
    npm install
    ```
    This command also initializes `husky` for git hooks [[package.json:27-28, 53-53]()].
3.  **Configure Environment Variables**:
    Create a `.env` file based on the project requirements. Key variables include:
    - `VITE_FIREBASE_*`: Client-side Firebase configuration [[README.md:46-46]()].
    - `VITE_AUTH_EMULATOR_HOST`, `VITE_FIRESTORE_EMULATOR_HOST`: Required for local emulator usage [[README.md:49-49]()].
    - `VITE_ALLOW_DEV_EMAIL_SEND`: Enables real email testing in dev [[README.md:52-52]()].

## 3. Development Workflow

The development environment leverages Vite for the frontend and the Firebase Emulator Suite for backend services.

### Running the Application

- **Standard Dev Mode**: `npm run dev` (starts Vite on `http://localhost:3000`) [[package.json:11-11](), [README.md:32-36]()].
- **With Firebase Emulators**: Before running the app against emulators, build the security rules assets:
  ```bash
  npm run build:rules-assets
  npm run test:rules:ci # Or start emulators manually
  ```
  [[package.json:10-10, 23-25]()].

### Build and Preview

To validate the production-equivalent bundle locally:

```bash
npm run build
npm run preview
```

[[package.json:12-13](), [README.md:57-59]()].

### Development Architecture Data Flow

The following diagram illustrates how the local development environment connects the UI to emulated services.

**Local Development Entity Map**

```mermaid
graph TD
    subgraph "Local Browser Space"
        "ViteDevServer[localhost:3000]" -- "serves" --> "ReactApp"
        "ReactApp" -- "uses" --> "useAuth[src/services/auth/authFlow.ts]"
        "ReactApp" -- "uses" --> "FirestoreRepository[src/services/repositories]"
    end

    subgraph "Firebase Emulator Space"
        "AuthEmulator[localhost:9099]"
        "FirestoreEmulator[localhost:8080]"
        "FunctionsEmulator[localhost:5001]"
    end

    "useAuth" -- "VITE_AUTH_EMULATOR_HOST" --> "AuthEmulator"
    "FirestoreRepository" -- "VITE_FIRESTORE_EMULATOR_HOST" --> "FirestoreEmulator"
    "ReactApp" -- "calls" --> "FunctionsEmulator"

    "FirestoreEmulator" -- "enforces" --> "firestore.rules"
```

Sources: [[README.md:49-49](), [package.json:11-11](), [src/services/auth/authFlow.ts:1-20]()]

## 4. CI Gates & Developer Commands

The project uses a tiered "Gate" system to manage quality. These are defined in `scripts/config/guardrail-governance.json` [[scripts/config/guardrail-governance.json:1-55]()].

### Gate Reference Table

| Gate             | Command                   | Purpose                                                                                                   |
| :--------------- | :------------------------ | :-------------------------------------------------------------------------------------------------------- |
| **Inner Loop**   | `npm run ci:inner-loop`   | Fast local feedback (Typecheck, Lint, Critical Units) [[docs/CI_GATES_AND_FAILURE_RUNBOOKS.md:20-30]()]   |
| **Pre-Merge**    | `npm run ci:pre-merge`    | Mandatory check before PR (Full Unit Suite + Quality) [[docs/CI_GATES_AND_FAILURE_RUNBOOKS.md:35-44]()]   |
| **Merge Gate**   | `npm run ci:merge-gate`   | Deep validation (Core Lint, Coverage, Production Build) [[docs/CI_GATES_AND_FAILURE_RUNBOOKS.md:50-62]()] |
| **Preview Gate** | `npm run ci:preview-gate` | Bundle budget and production bootstrap smoke test [[docs/CI_GATES_AND_FAILURE_RUNBOOKS.md:63-72]()]       |
| **Release Gate** | `npm run ci:release-gate` | Final validation (Emulators, Rules, E2E Critical) [[docs/CI_GATES_AND_FAILURE_RUNBOOKS.md:87-97]()]       |

### Key Developer Commands

- **Quality Aggregate**: `npm run check:quality` runs all structural guardrails (architecture boundaries, module sizes, etc.) [[package.json:111-111](), [scripts/config/guardrail-governance.json:135-176]()].
- **E2E Critical**: `npm run test:e2e:critical` runs Playwright tests against the emulator for core clinical flows [[package.json:40-40]()].
- **Performance**: `npm run test:e2e:flow-performance:gate` validates startup times against budgets [[package.json:42-42](), [e2e/startup-performance-budget.spec.ts:58-91]()].

## 5. Build Configuration & Chunking

Vite is configured to optimize the clinical application's "Offline-First" nature by splitting heavy vendor libraries.

### Manual Chunking Policy

The `chunkingPolicy.ts` isolates heavyweight dependencies to keep the initial bootstrap path light [[scripts/config/chunkingPolicy.ts:1-126]()].

- **`vendor-react`**: React core and TanStack Query [[scripts/config/chunkingPolicy.ts:38-47]()].
- **`vendor-firebase-firestore`**: Isolated to prevent blocking Auth [[scripts/config/chunkingPolicy.ts:58-60]()].
- **`vendor-excel-*` / `vendor-pdf-*`**: Heavy clinical export libraries are lazy-loaded [[scripts/config/chunkingPolicy.ts:81-122]()].
- **`app-authenticated-shell`**: Specifically chunks the shell runtime to avoid circular dependencies with feature modules [[scripts/config/chunkingPolicy.ts:6-16](), [src/tests/build/chunkingPolicy.test.ts:40-42]()].

**Build Pipeline Entity Map**

```mermaid
graph LR
    subgraph "Source Space"
        "src/app-shell" --> "AppShellChunk"
        "src/features/census" --> "FeatureChunk"
        "node_modules/exceljs" --> "ExcelVendorChunk"
    end

    subgraph "Vite/Rollup Process"
        "chunkForModule[scripts/config/chunkingPolicy.ts]" -- "categorizes" --> "ManualChunks"
        "ManualChunks" -- "applies" --> "vite.config.ts"
    end

    subgraph "Output (dist/assets)"
        "AppShellChunk" --> "app-authenticated-shell.[hash].js"
        "ExcelVendorChunk" --> "vendor-excel-xlsx.[hash].js"
    end
```

Sources: [[vite.config.ts:173-177](), [scripts/config/chunkingPolicy.ts:1-126](), [src/tests/build/chunkingPolicy.test.ts:139-150]()]

## 6. Security & Infrastructure

### Netlify Configuration

The `netlify.toml` defines the production environment's security posture:

- **CSP Headers**: Strict Content Security Policy that removes `unsafe-inline` from scripts [[netlify.toml:21-26]()].
- **Cache Control**: `index.html` and `version.json` are never cached to ensure immediate updates [[netlify.toml:42-51]()].
- **Redirects**: Single Page Application (SPA) support via `/* to /index.html` [[netlify.toml:13-16]()].

### Versioning

A `version.json` is generated at build time containing a timestamp (`version`) and `buildDate`. The application uses this to detect updates and trigger reconciliation [[vite.config.ts:16-30](), [public/version.json:1-4]()].

Sources:

- [[package.json:1-60]()]
- [[README.md:1-120]()]
- [[netlify.toml:1-82]()]
- [[vite.config.ts:1-210]()]
- [[docs/CI_GATES_AND_FAILURE_RUNBOOKS.md:1-130]()]
- [[scripts/config/guardrail-governance.json:1-176]()]
- [[scripts/config/chunkingPolicy.ts:1-126]()]
- [[e2e/startup-performance-budget.spec.ts:1-100]()]

---
