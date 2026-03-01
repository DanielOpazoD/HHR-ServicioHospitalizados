# `src/services`

## Propósito

Capa de datos e integración: repositorios, persistencia, exportadores, integraciones externas y servicios de dominio técnico.

## Mapa por subdirectorio

| Subdirectorio                                                 | Rol                                                             |
| ------------------------------------------------------------- | --------------------------------------------------------------- |
| `repositories/`                                               | Repository Pattern para `DailyRecord` y catálogos               |
| `storage/`                                                    | IndexedDB, fallback local legacy mínimo, Firestore sync y colas |
| `integrations/`                                               | Conectores a servicios externos (email, IA, etc.)               |
| `exporters/`                                                  | Exportación Excel/reportes                                      |
| `admin/`                                                      | Servicios de auditoría, mantenimiento y salud                   |
| `transfers/`                                                  | Generación documental y soporte de traslados                    |
| `auth/`                                                       | Servicios de autenticación y políticas de acceso                |
| `backup/`                                                     | Respaldo y restauración                                         |
| `terminology/`                                                | Normalización y búsquedas semánticas clínicas                   |
| `utils/`                                                      | Utilidades de servicio (logging, feature flags, etc.)           |
| `pdf/`                                                        | Generadores PDF                                                 |
| `security/`                                                   | Helpers de contraseña/export seguro                             |
| `calculations/`                                               | Cálculos estadísticos                                           |
| `bookmarks/`, `census/`, `config/`, `email/`, `google/`, etc. | Servicios especializados por dominio                            |

## Archivos raíz relevantes

| Archivo                  | Propósito                                           |
| ------------------------ | --------------------------------------------------- |
| `RepositoryContext.tsx`  | Inyección de repositorios en runtime                |
| `dataService.ts`         | Servicio de datos consolidado legacy/compatibilidad |
| `ExcelParsingService.ts` | Parsing Excel de soporte                            |
| `index.ts`               | Barrel export de servicios                          |

## Patrones clave

- **Repository Pattern** (`DailyRecordRepository`, `CatalogRepository`, etc.).
- **Service split por responsabilidad** (`read/write/sync/init` en repositorio diario).
- **Storage abstraction** con estrategia offline-first y fallback.
- **Auth por flujo y resolución**:
  - `authFlow.ts` como fachada pública del login
  - `authCredentialFlow.ts` para email/password y creación de usuario
  - `authGoogleFlow.ts` para popup, lock multi-tab y ramas E2E
  - `authFallback.ts` para redirect/bootstrap
  - `firebaseAuthConfigPolicy.ts` y `authRedirectRuntime.ts` para validar si el acceso alternativo está realmente disponible según entorno y configuración
  - `firebaseStartupUiPolicy.ts` para mensajes de arranque cuando la configuración de Firebase es inválida o incompleta
  - `authUiCopy.ts` para centralizar textos visibles de login y fallback sin mezclar copy en varios módulos
  - `authSession.ts` para suscripción de sesión activa
  - `authAccessResolution.ts` para autorización y resolución de rol
  - `authPolicy.ts` como fachada de whitelist/roles apoyada en helpers internos de caché y lookup
- **Excel runtime centralizado** en `exporters/excelUtils.ts` para cargar primero el build browser-min (`exceljs/dist/exceljs.min.js`) y evitar crecimiento innecesario del bundle principal.

## Ejemplo

```ts
import { DailyRecordRepository } from '@/services/repositories/DailyRecordRepository';

await DailyRecordRepository.save(record);
```

## Convención de capa

- No importar componentes ni hooks de UI desde `services`.
- Mantener contratos de entrada/salida tipados (preferir `types`/`schemas`).
- En integraciones externas complejas, usar una fachada pública pequeña y mover auth, payload builders y folder/file helpers a módulos internos específicos.
- Mantener `authService.ts` como fachada pública; evitar que la UI importe módulos internos de `auth/` directamente.
- Mantener `authPolicy.ts` y `authService.ts` estables aunque la resolución de roles se siga particionando internamente.
