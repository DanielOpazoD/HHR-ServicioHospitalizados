# Folder Dependency Debt Report

Generated at: 2026-02-18T05:10:48.587Z

Current violations: **40**

## Violations by Zone Pair

| Zone Pair              | Count |
| ---------------------- | ----: |
| hooks -> features      |    26 |
| components -> features |    14 |

## Top Importer Files

| File                                                                  | Violations |
| --------------------------------------------------------------------- | ---------: |
| `src/hooks/usePatientDischarges.ts`                                   |         13 |
| `src/hooks/usePatientTransfers.ts`                                    |         13 |
| `src/components/modals/actions/DischargeModal.tsx`                    |          4 |
| `src/components/modals/actions/MoveCopyModal.tsx`                     |          4 |
| `src/components/modals/actions/TransferModal.tsx`                     |          2 |
| `src/components/modals/BedManagerModal.tsx`                           |          2 |
| `src/components/modals/actions/discharge/DischargeTargetSelector.tsx` |          1 |
| `src/components/modals/actions/shared/MovementDateTimeField.tsx`      |          1 |

## Full Violation List

- `src/components/modals/actions/discharge/DischargeTargetSelector.tsx` (components) -> `@/features/census/domain/movements/contracts` => `src/features/census/domain/movements/contracts/index.ts` (features)
- `src/components/modals/actions/DischargeModal.tsx` (components) -> `@/features/census/domain/movements/contracts` => `src/features/census/domain/movements/contracts/index.ts` (features)
- `src/components/modals/actions/DischargeModal.tsx` (components) -> `@/features/census/controllers/dischargeModalController` => `src/features/census/controllers/dischargeModalController.ts` (features)
- `src/components/modals/actions/DischargeModal.tsx` (components) -> `@/features/census/hooks/useDischargeModalForm` => `src/features/census/hooks/useDischargeModalForm.ts` (features)
- `src/components/modals/actions/DischargeModal.tsx` (components) -> `@/features/census/types/censusActionModalContracts` => `src/features/census/types/censusActionModalContracts.ts` (features)
- `src/components/modals/actions/MoveCopyModal.tsx` (components) -> `@/features/census/controllers/moveCopyModalController` => `src/features/census/controllers/moveCopyModalController.ts` (features)
- `src/components/modals/actions/MoveCopyModal.tsx` (components) -> `@/features/census/hooks/useMoveCopyTargetRecord` => `src/features/census/hooks/useMoveCopyTargetRecord.ts` (features)
- `src/components/modals/actions/MoveCopyModal.tsx` (components) -> `@/features/census/hooks/useMoveCopyModalState` => `src/features/census/hooks/useMoveCopyModalState.ts` (features)
- `src/components/modals/actions/MoveCopyModal.tsx` (components) -> `@/features/census/types/censusActionModalContracts` => `src/features/census/types/censusActionModalContracts.ts` (features)
- `src/components/modals/actions/shared/MovementDateTimeField.tsx` (components) -> `@/features/census/controllers/clinicalShiftCalendarController` => `src/features/census/controllers/clinicalShiftCalendarController.ts` (features)
- `src/components/modals/actions/TransferModal.tsx` (components) -> `@/features/census/hooks/useTransferModalForm` => `src/features/census/hooks/useTransferModalForm.ts` (features)
- `src/components/modals/actions/TransferModal.tsx` (components) -> `@/features/census/types/censusActionModalContracts` => `src/features/census/types/censusActionModalContracts.ts` (features)
- `src/components/modals/BedManagerModal.tsx` (components) -> `@/features/census/controllers/bedManagerGridItemsController` => `src/features/census/controllers/bedManagerGridItemsController.ts` (features)
- `src/components/modals/BedManagerModal.tsx` (components) -> `@/features/census/hooks/useBedManagerModalModel` => `src/features/census/hooks/useBedManagerModalModel.ts` (features)
- `src/hooks/usePatientDischarges.ts` (hooks) -> `@/features/census/domain/movements/contracts` => `src/features/census/domain/movements/contracts/index.ts` (features)
- `src/hooks/usePatientDischarges.ts` (hooks) -> `@/features/census/controllers/patientMovementCreationController` => `src/features/census/controllers/patientMovementCreationController.ts` (features)
- `src/hooks/usePatientDischarges.ts` (hooks) -> `@/features/census/controllers/patientMovementCreationInputController` => `src/features/census/controllers/patientMovementCreationInputController.ts` (features)
- `src/hooks/usePatientDischarges.ts` (hooks) -> `@/features/census/controllers/patientMovementMutationController` => `src/features/census/controllers/patientMovementMutationController.ts` (features)
- `src/hooks/usePatientDischarges.ts` (hooks) -> `@/features/census/controllers/patientMovementUndoMutationController` => `src/features/census/controllers/patientMovementUndoMutationController.ts` (features)
- `src/hooks/usePatientDischarges.ts` (hooks) -> `@/features/census/controllers/patientMovementRuntimeController` => `src/features/census/controllers/patientMovementRuntimeController.ts` (features)
- `src/hooks/usePatientDischarges.ts` (hooks) -> `@/features/census/controllers/patientMovementSelectionController` => `src/features/census/controllers/patientMovementSelectionController.ts` (features)
- `src/hooks/usePatientDischarges.ts` (hooks) -> `@/features/census/hooks/usePatientMovementFeedback` => `src/features/census/hooks/usePatientMovementFeedback.ts` (features)
- `src/hooks/usePatientDischarges.ts` (hooks) -> `@/features/census/hooks/usePatientMovementAudit` => `src/features/census/hooks/usePatientMovementAudit.ts` (features)
- `src/hooks/usePatientDischarges.ts` (hooks) -> `@/features/census/hooks/usePatientMovementCreationExecutor` => `src/features/census/hooks/usePatientMovementCreationExecutor.ts` (features)
- `src/hooks/usePatientDischarges.ts` (hooks) -> `@/features/census/hooks/usePatientMovementUndoExecutor` => `src/features/census/hooks/usePatientMovementUndoExecutor.ts` (features)
- `src/hooks/usePatientDischarges.ts` (hooks) -> `@/features/census/hooks/usePatientMovementCurrentRecord` => `src/features/census/hooks/usePatientMovementCurrentRecord.ts` (features)
- `src/hooks/usePatientDischarges.ts` (hooks) -> `@/features/census/hooks/usePatientMovementMutationExecutor` => `src/features/census/hooks/usePatientMovementMutationExecutor.ts` (features)
- `src/hooks/usePatientTransfers.ts` (hooks) -> `@/features/census/controllers/patientMovementCreationController` => `src/features/census/controllers/patientMovementCreationController.ts` (features)
- `src/hooks/usePatientTransfers.ts` (hooks) -> `@/features/census/controllers/patientMovementCreationInputController` => `src/features/census/controllers/patientMovementCreationInputController.ts` (features)
- `src/hooks/usePatientTransfers.ts` (hooks) -> `@/features/census/controllers/patientMovementMutationController` => `src/features/census/controllers/patientMovementMutationController.ts` (features)
- `src/hooks/usePatientTransfers.ts` (hooks) -> `@/features/census/controllers/patientMovementUndoMutationController` => `src/features/census/controllers/patientMovementUndoMutationController.ts` (features)
- `src/hooks/usePatientTransfers.ts` (hooks) -> `@/features/census/controllers/patientMovementRuntimeController` => `src/features/census/controllers/patientMovementRuntimeController.ts` (features)
- `src/hooks/usePatientTransfers.ts` (hooks) -> `@/features/census/controllers/patientMovementSelectionController` => `src/features/census/controllers/patientMovementSelectionController.ts` (features)
- `src/hooks/usePatientTransfers.ts` (hooks) -> `@/features/census/hooks/usePatientMovementFeedback` => `src/features/census/hooks/usePatientMovementFeedback.ts` (features)
- `src/hooks/usePatientTransfers.ts` (hooks) -> `@/features/census/hooks/usePatientMovementAudit` => `src/features/census/hooks/usePatientMovementAudit.ts` (features)
- `src/hooks/usePatientTransfers.ts` (hooks) -> `@/features/census/hooks/usePatientMovementCreationExecutor` => `src/features/census/hooks/usePatientMovementCreationExecutor.ts` (features)
- `src/hooks/usePatientTransfers.ts` (hooks) -> `@/features/census/hooks/usePatientMovementUndoExecutor` => `src/features/census/hooks/usePatientMovementUndoExecutor.ts` (features)
- `src/hooks/usePatientTransfers.ts` (hooks) -> `@/features/census/hooks/usePatientMovementCurrentRecord` => `src/features/census/hooks/usePatientMovementCurrentRecord.ts` (features)
- `src/hooks/usePatientTransfers.ts` (hooks) -> `@/features/census/hooks/usePatientMovementMutationExecutor` => `src/features/census/hooks/usePatientMovementMutationExecutor.ts` (features)
- `src/hooks/usePatientTransfers.ts` (hooks) -> `@/features/census/domain/movements/contracts` => `src/features/census/domain/movements/contracts/index.ts` (features)
