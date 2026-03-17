# `src/hooks/controllers`

## Propósito

Controladores puros consumidos por hooks para separar:

- decisiones de negocio,
- estado derivado,
- traducción de errores/mensajes.

## Mapa

| Archivo                                       | Propósito                                                                     |
| --------------------------------------------- | ----------------------------------------------------------------------------- |
| `dailyRecordSyncNotificationController.ts`    | Traducción de errores de sync a feedback UX                                   |
| `dailyRecordSyncStatusController.ts`          | Estado de sync derivado de mutaciones                                         |
| `censusEmailRecipientsController.ts`          | Parse/normalización de destinatarios email                                    |
| `censusEmailRecipientsBootstrapController.ts` | Bootstrap de destinatarios globales/locales sin exponer excepciones esperadas |
| `censusEmailSendController.ts`                | Reglas de envío de email de censo                                             |
| `censusEmailBrowserRuntimeController.ts`      | Runtime del flujo email desacoplado del browser global                        |

## Patrón

Hook -> controller -> hook.

Esto permite tests unitarios directos de controller sin montar React.
