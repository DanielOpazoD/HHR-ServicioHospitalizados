# CI Gates & Quality Checks

# CI Gates & Quality Checks

<details>
<summary>Relevant source files</summary>

The following files were used as context for generating this wiki page:

- [.github/workflows/ci-cd.yml](.github/workflows/ci-cd.yml)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [README.md](README.md)
- [docs/CI_GATES_AND_FAILURE_RUNBOOKS.md](docs/CI_GATES_AND_FAILURE_RUNBOOKS.md)
- [docs/DEVELOPER_COMMANDS.md](docs/DEVELOPER_COMMANDS.md)
- [docs/QUALITY_GUARDRAILS.md](docs/QUALITY_GUARDRAILS.md)
- [functions/index.js](functions/index.js)
- [netlify/functions/clinical-document-ai-import.ts](netlify/functions/clinical-document-ai-import.ts)
- [netlify/functions/lib/http.ts](netlify/functions/lib/http.ts)
- [package.json](package.json)
- [playwright.emulator-critical.config.ts](playwright.emulator-critical.config.ts)
- [public/version.json](public/version.json)
- [scripts/check-feature-public-api-boundary.mjs](scripts/check-feature-public-api-boundary.mjs)
- [scripts/check-guardrail-governance.mjs](scripts/check-guardrail-governance.mjs)
- [scripts/check-quality-aggregate.mjs](scripts/check-quality-aggregate.mjs)
- [scripts/check-release-evidence.mjs](scripts/check-release-evidence.mjs)
- [scripts/check-technical-ownership-map.mjs](scripts/check-technical-ownership-map.mjs)
- [scripts/check-test-governance.mjs](scripts/check-test-governance.mjs)
- [scripts/config/guardrail-governance.json](scripts/config/guardrail-governance.json)
- [scripts/config/netlifyFunctionDevServer.ts](scripts/config/netlifyFunctionDevServer.ts)
- [scripts/config/technical-ownership-map.json](scripts/config/technical-ownership-map.json)
- [scripts/feature-public-api-allowlist.json](scripts/feature-public-api-allowlist.json)
- [scripts/guardrailGovernanceSupport.mjs](scripts/guardrailGovernanceSupport.mjs)
- [scripts/module-size-allowlist.json](scripts/module-size-allowlist.json)
- [scripts/releaseConfidenceMatrixSupport.mjs](scripts/releaseConfidenceMatrixSupport.mjs)
- [scripts/smoke-netlify-function-dev-module.mjs](scripts/smoke-netlify-function-dev-module.mjs)
- [scripts/test-governance-allowlist.json](scripts/test-governance-allowlist.json)
- [src/features/clinical-documents/components/ClinicalDocumentIndicationsItems.tsx](src/features/clinical-documents/components/ClinicalDocumentIndicationsItems.tsx)
- [src/features/clinical-documents/components/ClinicalDocumentIndicationsPanelHeader.tsx](src/features/clinical-documents/components/ClinicalDocumentIndicationsPanelHeader.tsx)
- [src/features/clinical-documents/components/ClinicalDocumentIndicationsTabSettings.tsx](src/features/clinical-documents/components/ClinicalDocumentIndicationsTabSettings.tsx)
- [src/features/clinical-documents/components/ClinicalDocumentVersionBadge.tsx](src/features/clinical-documents/components/ClinicalDocumentVersionBadge.tsx)
- [src/features/clinical-documents/contracts/clinicalDocumentAiImportContract.ts](src/features/clinical-documents/contracts/clinicalDocumentAiImportContract.ts)
- [src/features/clinical-documents/controllers/clinicalDocumentAiImportController.ts](src/features/clinical-documents/controllers/clinicalDocumentAiImportController.ts)
- [src/features/clinical-documents/controllers/clinicalDocumentIndicationsCatalogController.ts](src/features/clinical-documents/controllers/clinicalDocumentIndicationsCatalogController.ts)
- [src/features/clinical-documents/hooks/useClinicalDocumentWorkspaceImportActions.ts](src/features/clinical-documents/hooks/useClinicalDocumentWorkspaceImportActions.ts)
- [src/features/prescriptions/components/prescriptionBedGridSupport.ts](src/features/prescriptions/components/prescriptionBedGridSupport.ts)
- [src/tests/build/guardrailGovernanceSupport.test.ts](src/tests/build/guardrailGovernanceSupport.test.ts)
- [src/tests/build/releaseConfidenceMatrixSupport.test.ts](src/tests/build/releaseConfidenceMatrixSupport.test.ts)
- [src/tests/build/releaseEvidence.test.ts](src/tests/build/releaseEvidence.test.ts)
- [src/tests/config/netlifyFunctionDevServer.test.ts](src/tests/config/netlifyFunctionDevServer.test.ts)
- [src/tests/features/clinical-documents/clinicalDocumentAiImportContract.test.ts](src/tests/features/clinical-documents/clinicalDocumentAiImportContract.test.ts)
- [src/tests/features/clinical-documents/clinicalDocumentAiImportController.test.ts](src/tests/features/clinical-documents/clinicalDocumentAiImportController.test.ts)
- [src/tests/features/clinical-documents/useClinicalDocumentWorkspaceImportActions.test.ts](src/tests/features/clinical-documents/useClinicalDocumentWorkspaceImportActions.test.ts)
- [src/tests/netlify/clinicalDocumentAiImport.test.ts](src/tests/netlify/clinicalDocumentAiImport.test.ts)
- [src/tests/netlify/http.test.ts](src/tests/netlify/http.test.ts)

</details>

The HHR (Hospital Hanga Roa) system employs a tiered Continuous Integration (CI) architecture designed to balance developer velocity with clinical safety. The system enforces structural integrity, architectural boundaries, and operational readiness through automated guardrails defined in `scripts/config/guardrail-governance.json` [scripts/config/guardrail-governance.json:1-134]().

## CI Tier Architecture

The CI pipeline is organized into four distinct tiers, ranging from local development feedback to final release validation.

### Tier 1: Inner Loop

Designed for rapid local iteration. It provides immediate feedback on syntax, types, and the most critical unit logic without the overhead of full integration suites.

- **Command:** `npm run ci:inner-loop` [package.json:112-112]()
- **Checks:** TypeScript compilation, ESLint (zero warnings), architectural quality aggregate, and critical unit tests [scripts/config/guardrail-governance.json:9-9]().

### Tier 2: Pre-Merge

The mandatory baseline for any Pull Request. It ensures that the basic unit and integration contracts are met before code review.

- **Command:** `npm run ci:pre-merge` [package.json:113-113]()
- **Checks:** Extends the Inner Loop by running the full CI unit test suite (`test:ci:unit`) [scripts/config/guardrail-governance.json:17-17]().

### Tier 3: Merge Gate

A blocking gate triggered when changes impact sensitive areas like clinical logic, authentication, or storage.

- **Command:** `npm run ci:merge-gate` [package.json:114-114]()
- **Checks:** Includes strict linting for core modules, critical coverage enforcement, Netlify function bundle validation, and the **Preview Gate** [scripts/config/guardrail-governance.json:25-32]().
- **Preview Gate:** Validates the production bundle by checking budgets, verifying the chunk graph is acyclic, and performing a smoke test that mounts the real bundle in a local preview [scripts/config/guardrail-governance.json:40-44]().

### Tier 4: Release Gate

The final validation before deployment to production.

- **Command:** `npm run ci:release-gate` [package.json:115-115]()
- **Checks:** Final evidence verification (`check:release-evidence`) and full Firestore emulator suites including security rules and synchronization resilience [scripts/config/guardrail-governance.json:52-52]().

### Data Flow: CI Gate Orchestration

The following diagram illustrates how a change flows through the tiered gates to reach a release-ready state.

**CI Gate Execution Flow**

```mermaid
graph TD
    "Local_Dev"["Local Development"] --> "Inner_Loop"["ci:inner-loop<br/>(Typecheck + Lint + Quality)"]
    "Inner_Loop" -- "Success" --> "Pre_Merge"["ci:pre-merge<br/>(Full Unit Suite)"]
    "Pre_Merge" -- "PR Open/Update" --> "Merge_Gate"["ci:merge-gate<br/>(Coverage + Build + Preview)"]
    "Merge_Gate" -- "Sensitive Change" --> "Release_Gate"["ci:release-gate<br/>(Rules + Emulator + Evidence)"]

    subgraph "Merge_Gate_Detail"["Merge Gate Detail"]
        "Build"["npm run build"] --> "Budget"["check:bundle-budget"]
        "Budget" --> "Preview"["test:e2e:preview:census-bootstrap:built"]
    end
```

Sources: [scripts/config/guardrail-governance.json:1-55](), [package.json:112-116](), [docs/CI_GATES_AND_FAILURE_RUNBOOKS.md:19-96]()

## Quality Aggregate Orchestrator

The `check:quality` command serves as the primary structural guardrail, orchestrated by `scripts/check-quality-aggregate.mjs`. It reads the `qualityAggregate` configuration from `guardrail-governance.json` to execute a series of specialized checkers [scripts/check-quality-aggregate.mjs:1-18]().

### Key Boundary Checks

- **Application Port Boundary:** Enforced by `scripts/check-application-port-boundary.mjs`, ensuring that the `application/` layer does not leak infrastructure details and that external layers communicate only through defined ports [scripts/config/guardrail-governance.json:139-139]().
- **Feature Public API:** Enforced by `scripts/check-feature-public-api-boundary.mjs`. It prevents deep-linking into feature internals, requiring all cross-feature communication to go through a `public-api.ts` or equivalent facade [scripts/config/guardrail-governance.json:148-148]().
- **Module Size Limits:** Files exceeding 400 lines (defined in `globalMax`) must be explicitly documented in `scripts/module-size-allowlist.json` with a justification and owner [scripts/module-size-allowlist.json:1-8]().

### Quality Aggregate Components

| Group          | Check ID                     | Purpose                                                   |
| :------------- | :--------------------------- | :-------------------------------------------------------- |
| **Boundaries** | `check:architecture`         | Validates high-level layer dependencies.                  |
| **Boundaries** | `check:feature-dependencies` | Prevents circular dependencies between features.          |
| **Governance** | `check:schema-governance`    | Ensures Zod schemas match domain entity requirements.     |
| **Governance** | `check:runtime-contracts`    | Validates that runtime objects match expected interfaces. |
| **Size**       | `check:hotspot-growth`       | Blocks growth of files already in the size allowlist.     |

Sources: [scripts/config/guardrail-governance.json:135-180](), [scripts/check-quality-aggregate.mjs:28-46](), [docs/QUALITY_GUARDRAILS.md:1-31]()

## Technical Ownership & Governance

The system maintains a `technical-ownership-map.json` to ensure every critical subsystem has an accountable owner and associated operational runbooks [docs/CI_GATES_AND_FAILURE_RUNBOOKS.md:113-113]().

### Technical Ownership Structure

Each entry in `scripts/config/technical-ownership-map.json` defines:

1.  **Owner:** The technical lead or team responsible.
2.  **Primary Metric:** The key indicator of health (e.g., sync success rate).
3.  **Gate:** The CI script that protects this area.
4.  **Runbook:** The recovery procedure located in `docs/`.

**Ownership and Governance Mapping**

```mermaid
classDiagram
    class "TechnicalOwnershipMap" {
        +String subsystemId
        +String owner
        +String primaryMetric
        +String gateScript
        +String runbookPath
    }
    class "GuardrailGovernance" {
        +Tier[] blockingTiers
        +Check[] qualityAggregate
        +Report[] reportOnly
    }
    class "ModuleSizeAllowlist" {
        +Number globalMax
        +Map allowlist
        +Map backlog
    }
    "GuardrailGovernance" ..> "TechnicalOwnershipMap" : references via gates
    "GuardrailGovernance" ..> "ModuleSizeAllowlist" : enforces size limits
```

Sources: [docs/CI_GATES_AND_FAILURE_RUNBOOKS.md:143-153](), [scripts/module-size-allowlist.json:9-30](), [scripts/config/guardrail-governance.json:120-128]()

## Critical Coverage & Risk Gates

The CI pipeline identifies "Critical Modules" (e.g., `dailyRecordRepositoryWriteService.ts`, `authService.ts`) and applies stricter rules to them:

- **Explicit Any Policy:** Enforced by `check:critical-any`, preventing the use of `any` types in files identified as high-risk [package.json:53-53]().
- **Coverage Budgets:** The `check:critical-coverage` script ensures that logic-heavy controllers and services maintain a high test coverage percentage, specifically targeting clinical write paths [scripts/config/guardrail-governance.json:28-28]().
- **Sync Load Baseline:** A specialized test (`test:sync-load`) simulates high volumes of clinical data (120+ records) to ensure the `syncQueueEngine` remains performant under stress [package.json:136-142]().

Sources: [package.json:52-53](), [scripts/config/guardrail-governance.json:58-66](), [docs/QUALITY_GUARDRAILS.md:25-30]()

---
