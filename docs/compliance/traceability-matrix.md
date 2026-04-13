# Matriz de Trazabilidad Normativa (MINSAL / Ley 20.584)

Este documento vincula los requerimientos legales de salud en Chile con las implementaciones técnicas del sistema HHR.

## 1. Integridad y Autoría (Ley 20.584, Art. 12-13)

| Requerimiento Legal                   | Implementación Técnica                 | Ubicación en el Código                |
| :------------------------------------ | :------------------------------------- | :------------------------------------ |
| Registro de autoría de toda anotación | Sistema de Atribución Automática       | `services/auth/attributionService.ts` |
| Firma de registros clínicos           | Firma Médica Digital (Simulada/Manual) | `views/handoff/SignatureStatus.tsx`   |
| Atribución en cuentas compartidas     | Lógica de autores por turno            | `services/admin/auditService.ts:L92`  |

## 2. Privacidad y Confidencialidad (Ley 19.628 / Res. Exenta 146)

| Requerimiento Legal             | Implementación Técnica                  | Ubicación en el Código                        |
| :------------------------------ | :-------------------------------------- | :-------------------------------------------- |
| Acceso restringido por rol      | RBAC (Role Based Access Control)        | `hooks/useAuthState.ts:L263`                  |
| Bloqueo por inactividad         | Auto-logout con `SESSION_TIMEOUT_MS`    | `hooks/useAuthState.ts:L109`                  |
| Encriptación de datos sensibles | Clave PIN mensual de 4 dígitos en Excel | `services/exporters/exportPasswordService.ts` |
| Protección en tránsito          | Pasaporte de Acceso Island (Encrypted)  | `services/auth/passportService.ts`            |

## 3. Trazabilidad e Historial (Circular N°23 MINSAL)

| Requerimiento Legal              | Implementación Técnica                      | Ubicación en el Código                                      |
| :------------------------------- | :------------------------------------------ | :---------------------------------------------------------- |
| Log de visualización de datos    | Registro de `PATIENT_VIEWED`                | `services/admin/auditService.ts:L272`                       |
| Registro de modificaciones       | Logs de `PATIENT_MODIFIED` y `NOTE_UPDATED` | `services/admin/auditService.ts:L283`                       |
| Fallback offline con integridad  | Persistencia híbrida local-cloud            | `services/repositories/dailyRecordRepositoryReadService.ts` |
| Imposibilidad de borrado anónimo | Auditoría centralizada persistente          | `services/admin/auditService.ts`                            |

---

> [!NOTE]
> Esta matriz debe actualizarse tras cada cambio en la lógica de seguridad o flujos críticos para mantener el estatus de cumplimiento.
