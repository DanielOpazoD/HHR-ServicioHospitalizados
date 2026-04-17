# Runbook — Rotación de secretos y credenciales

Documento único y vivo con el **inventario, procedimiento y cadencia** de rotación de todas las credenciales del sistema HHR. Si un secreto existe en producción y no está listado aquí, **añadirlo es parte de la rotación**.

> **Propiedad:** mantenedor técnico principal.
> **Revisión:** cada vez que se agregue/retire un secreto, y auditoría completa al menos **cada 6 meses** o ante cualquier incidente de acceso.

---

## Índice de secretos

Cada fila es **la fuente de verdad de rotación** para ese secreto. No duplicar este inventario en otros docs.

| ID                       | Nombre                                                                                   | Ubicación                                | Usado por                                   | Impacto si se filtra                                                                          | Cadencia sugerida                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `FB-WEB-API-KEY`         | `VITE_FIREBASE_API_KEY`                                                                  | Netlify env (prod) + `.env.local` (dev)  | Cliente web (Firebase SDK)                  | Bajo por sí sola — la protección real son las reglas Firestore/Storage                        | Ante incidente o cambio de proyecto                                               |
| `FB-LEGACY-API-KEY`      | `VITE_LEGACY_FIREBASE_*`                                                                 | Netlify env (opcional)                   | Lecturas legacy controladas                 | Bajo (proyecto legacy, read-only por reglas)                                                  | Ante incidente                                                                    |
| `PASSPORT-SECRET`        | `VITE_PASSPORT_SECRET`                                                                   | Netlify env + `.env.local`               | Firma de passports offline (cliente)        | Medio — permite falsificar passports offline. La verificación definitiva debe ser server-side | Anual o ante incidente                                                            |
| `GMAIL-OAUTH`            | `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`                          | Netlify env                              | `netlify/functions/send-census-email.ts`    | Alto — permite enviar correo en nombre de la cuenta institucional                             | Anual, o ante rotación de la cuenta Google                                        |
| `AI-GEMINI`              | `GEMINI_API_KEY`                                                                         | Netlify env                              | `cie10-ai-search`, `clinical-ai-summary`    | Medio — coste y rate limits                                                                   | Trimestral / ante incidente                                                       |
| `AI-OPENAI`              | `OPENAI_API_KEY`                                                                         | Netlify env                              | mismos endpoints (si activado)              | Medio                                                                                         | Trimestral / ante incidente                                                       |
| `AI-ANTHROPIC`           | `ANTHROPIC_API_KEY`                                                                      | Netlify env                              | mismos endpoints (si activado)              | Medio                                                                                         | Trimestral / ante incidente                                                       |
| `AI-LOCAL-*`             | `VITE_LOCAL_GEMINI_API_KEY`, `VITE_LOCAL_OPENAI_API_KEY`, `VITE_LOCAL_ANTHROPIC_API_KEY` | **Sólo `.env.local` de desarrolladores** | Fallback AI en `localhost`                  | Medio (usa cuota personal del dev)                                                            | Cada desarrollador lo gestiona; nunca subir a Netlify                             |
| `MMRAD-RIS`              | `MMRAD_USERNAME`, `MMRAD_PASSWORD`                                                       | Netlify env                              | `netlify/functions/mmrad-search.ts`         | Alto — acceso al RIS radiológico                                                              | Según política del proveedor MMRAD. Ante incidente: inmediato                     |
| `GOOGLE-OAUTH-DRIVE`     | `VITE_GOOGLE_CLIENT_ID`                                                                  | Netlify env + `.env.local`               | "Editar Cloud" en documentos de traslado    | Bajo (client ID público; el riesgo es el consent screen)                                      | Ante cambio de proyecto Google Cloud                                              |
| `WHATSAPP-BOT-URL`       | `VITE_WHATSAPP_BOT_URL` + `SESSION_SECRET`, `DATABASE_URL` del bot                       | Railway env (bot)                        | `netlify/functions/whatsapp-proxy.ts` → bot | Alto — acceso al bot de WhatsApp institucional                                                | Rotar `SESSION_SECRET` y `DATABASE_URL` al menos anualmente o ante incidente      |
| `FB-FUNCTIONS-ADMIN`     | Service account implícito en Firebase Functions                                          | Google Cloud (no en repo)                | `functions/index.js` (`setUserRole`, etc.)  | Crítico — privilegios admin Firestore/Auth                                                    | Rotar si se sospecha compromiso o al cambiar de mantenedor                        |
| `BOOTSTRAP-ADMIN-EMAILS` | Allowlist hardcoded en `firestore.rules` (`isBootstrapAdmin`)                            | Repo                                     | Reglas Firestore (recuperación técnica)     | Crítico — cualquier email en esa lista puede escribir reglas/roles                            | Sólo por PR explícito. Guard en `src/tests/security/rulesHardeningStatic.test.ts` |

> **Nota:** el secret-leak scan (`npm run check:secret-leaks`) bloquea accidentalmente commitear archivos prohibidos. No reemplaza la rotación — la complementa.

---

## Procedimiento genérico de rotación

Aplicar para cualquier secreto del inventario. Pasos específicos por secreto en la siguiente sección.

1. **Generar nuevo secreto** en el sistema de origen (Google Cloud, proveedor AI, etc.).
2. **Publicar en Netlify** (o Railway, según destino) **sin borrar el anterior todavía**. Netlify soporta convivencia temporal sólo si el código tolera ambas claves; si no, planificar ventana.
3. **Deploy y smoke test**:
   - Producción: verificar endpoint afectado (p. ej. envío de correo, búsqueda CIE-10).
   - Correr `npm run test:risk:platform` antes de promover.
4. **Revocar el secreto antiguo** en el proveedor.
5. **Registrar la rotación**: fecha, secreto, operador y motivo como entrada en `docs/RUNBOOK_SECRET_ROTATION_LOG.md` (crear si no existe — ver plantilla abajo).
6. **Si el secreto estuvo en `.env.example`** o docs: asegurarse de que ahí sólo haya placeholders.

### Plantilla de entrada en el log

```
## YYYY-MM-DD — <ID del secreto>
- Motivo: <rotación programada | sospecha de compromiso | cambio de mantenedor | …>
- Operador: <nombre>
- Sistemas afectados: <netlify, railway, firebase>
- Smoke test: <ok | detalles>
- Revocación del anterior: <timestamp>
```

---

## Procedimientos específicos

### Firebase Web API Key (`FB-WEB-API-KEY`)

1. Google Cloud → APIs & Services → Credentials → regenerar la API key del proyecto.
2. Actualizar `VITE_FIREBASE_API_KEY` en Netlify (prod) y `.env.local` del mantenedor.
3. Redeploy. Smoke: login, lectura de censo.
4. La exposición de esta clave en el bundle es **esperable**: la protección real vive en `firestore.rules` y `storage.rules`.

### Gmail OAuth (`GMAIL-OAUTH`)

1. Google Cloud Console → OAuth 2.0 Client IDs → generar nuevo client secret.
2. Re-autorizar para obtener nuevo `GMAIL_REFRESH_TOKEN` (scope `gmail.send`).
3. Actualizar las tres variables en Netlify.
4. Smoke: `npm run test:send-email` o un envío controlado en staging.
5. Revocar el client secret antiguo en Google Cloud.

### AI providers (`AI-GEMINI`, `AI-OPENAI`, `AI-ANTHROPIC`)

1. Provider console → crear nueva key.
2. Actualizar la variable correspondiente en Netlify.
3. Smoke: probar `cie10-ai-search` o `clinical-ai-summary` en staging.
4. Revocar key antigua.

### MMRAD RIS (`MMRAD-RIS`)

1. Coordinar con el administrador de MMRAD para reset de contraseña.
2. Actualizar `MMRAD_USERNAME` / `MMRAD_PASSWORD` en Netlify.
3. Smoke: búsqueda de un examen conocido.

### WhatsApp bot (`WHATSAPP-BOT-URL` y secretos del bot)

1. En Railway: rotar `SESSION_SECRET` y credenciales de DB del bot.
2. Verificar que `netlify/functions/whatsapp-proxy.ts` sigue apuntando al host correcto.
3. Smoke: ping desde la app a un número de pruebas. Consultar `docs/whatsapp-deployment.md` para detalles operativos del bot.

### Firebase Functions admin (`FB-FUNCTIONS-ADMIN`)

1. Google Cloud → IAM → service accounts del proyecto.
2. Rotar credenciales del service account usado por Firebase Functions.
3. Redeploy de functions.
4. Smoke: `setUserRole` con una cuenta de pruebas (ver `RUNBOOK_AUTH_ACCESS_INCIDENTS`).

### Bootstrap admin allowlist (`BOOTSTRAP-ADMIN-EMAILS`)

1. **No se rota vía consola**. Requiere PR que edite `firestore.rules` y `src/tests/security/rulesHardeningStatic.test.ts` (el guard está diseñado para fallar si la lista cambia sin tocar el test).
2. Deploy de reglas: `firebase deploy --only firestore:rules`.
3. Smoke: correr `npm run test:rules:ci`.

---

## Ante sospecha de compromiso

1. **Revocar inmediato** el secreto sospechoso antes de generar el nuevo.
2. Revisar logs relevantes:
   - Netlify function logs.
   - Google Cloud audit logs (Firebase, Gmail).
   - Firestore security rule denials.
3. Consultar `RUNBOOK_AUTH_ACCESS_INCIDENTS.md` si el compromiso involucra acceso de usuario.
4. Completar la rotación según el procedimiento estándar.
5. Documentar el incidente en el log con prefijo `INCIDENT:`.

---

## Qué **NO** hace este runbook

- No reemplaza `RUNBOOK_AUTH_ACCESS_INCIDENTS.md` para incidentes de acceso de usuario.
- No reemplaza `RUNBOOK_AI_PROVIDER_OPERATIONS.md` para troubleshooting de providers AI (sólo cubre rotación).
- No cubre rotación de dependencias npm — eso vive en el workflow `.github/workflows/security-audit.yml`.
