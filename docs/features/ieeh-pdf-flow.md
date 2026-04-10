# IEEH PDF Generation Flow & Architectural Impact

## Overview

The IEEH (Informe Estadístico de Egreso Hospitalario) PDF generation now follows a "Pre-download Data Enrichment" pattern. Instead of generating a PDF directly from database records, a metadata enrichment layer (dialog) is introduced to allow clinical staff to refine critical data before final export.

## Architectural Pattern: Pre-download Data Enrichment

This pattern solves the discrepancy between "System Record Data" (structured, often concise) and "Official Form Data" (detailed, often requiring free-text context).

### Workflow

1. **Trigger**: User clicks the IEEH export button on a discharge record.
2. **State Initialization**: The `IEEHFormDialog` component is initialized with a snapshot of the patient data (`PatientData`) and discharge event data (`DischargeFormData`).
3. **User Enrichment**:
   - **Diagnosis Confirmation**: Users can confirm the standardized CIE-10 diagnosis or provide a free-text "Diagnóstico Principal" which overrides the patient's record for this specific PDF generation.
   - **Clinical Detail Addition**: Fields not typically tracked in the daily census (e.g., specific surgical procedure descriptions, treating doctor's RUT) are filled in temporarily.
   - **Data Inheritance**: Fields like `admissionDate`, `age`, and `patientName` are inherited from the system but can be substituted if needed.
4. **PDF Service Execution**: The `ieehPdfService.ts` receives the enriched data object and performs bitwise-like coordinate mapping onto the PDF template.
5. **Standardized Save**: Uses the modern `showSaveFilePicker` API (supported via a shim or fallback) to allow users to name the file correctly (`IEEH_NAME_DATE.pdf`).

## Key Components

- [IEEHFormDialog.tsx](../../src/features/census/components/IEEHFormDialog.tsx): handles dialog state and delegates orchestration to the hook.
- [useIEEHForm.ts](../../src/features/census/hooks/useIEEHForm.ts): orchestrates search, persistence and print flow.
- [ieehFormDataController.ts](../../src/features/census/controllers/ieehFormDataController.ts): pure serialization of dialog values into persisted and printable shapes.
- [ieehPdfService.ts](../../src/services/pdf/ieehPdfService.ts): pure PDF mapping over the official coordinates.
- [pdfBase.ts](../../src/services/pdf/pdfBase.ts): browser print-opening and fallback runtime.

## Benefits

- **Data Integrity**: The original census records remain clean and structured, while the official PDF is enriched with necessary manual context.
- **Improved UX**: AI-assisted searching directly in the export dialog reduces context switching.
- **Portal Rendering**: Using `ReactDOM.createPortal` ensures the dialog is never clipped by table overflow or z-index issues.
