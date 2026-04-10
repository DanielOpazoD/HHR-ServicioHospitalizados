# `src/hooks/controllers`

## Propósito

Controladores puros consumidos por hooks para separar:

- decisiones de negocio,
- estado derivado,
- traducción de errores/mensajes.

## Ownership

- Los controllers específicos de `census` tienen owner canónico en `src/features/census/controllers`.
- Si el mismo basename existe en `src/hooks/controllers`, ese archivo debe ser solo un shim de compatibilidad.
- No se admiten dos implementaciones activas del mismo controller entre ambas rutas.

## Mapa

| Archivo                                       | Propósito                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------ |
| `dailyRecordSyncNotificationController.ts`    | Traducción de errores de sync a feedback UX                                    |
| `dailyRecordSyncStatusController.ts`          | Estado de sync derivado de mutaciones                                          |
| `censusEmailRecipientsController.ts`          | Parse/normalización de destinatarios email                                     |
| `censusEmailRecipientsBootstrapController.ts` | Bootstrap de destinatarios globales/locales sin exponer excepciones esperadas  |
| `censusEmailSendController.ts`                | Reglas de envío de email de censo                                              |
| `censusEmailBrowserRuntimeController.ts`      | Runtime del flujo email desacoplado del browser global                         |
| `handoffManagementMutationController.ts`      | Runner común para mutaciones de handoff con errores y auditoría consistentes   |
| `handoffShareLinkController.ts`               | Política pura para decidir copia real, fallback E2E o mensaje de error         |
| `medicalHandoffHandlersController.ts`         | Guardas, target patient y filtros de outcome para mutaciones de handoff médico |

## Patrón

Hook -> controller -> hook.

Esto permite tests unitarios directos de controller sin montar React.

Para `census`, los imports legacy desde `src/hooks/controllers/*` siguen soportados, pero reexportan la implementación dueña de la feature.
