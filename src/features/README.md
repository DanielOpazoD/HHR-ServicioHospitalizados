# `src/features`

## Propósito

Organización principal por módulo funcional (feature-first). Cada feature agrupa UI, hooks, controllers y servicios específicos.

## Mapa de features

| Feature      | Contenido típico                                                      | Estado                       |
| ------------ | --------------------------------------------------------------------- | ---------------------------- |
| `census/`    | `components`, `hooks`, `controllers`, `domain`, `types`, `validation` | Núcleo principal del sistema |
| `handoff/`   | Entrega de turno (enfermería/médica), controllers y servicios         | Activo                       |
| `transfers/` | Flujo de gestión de traslados y documentos                            | Activo                       |
| `admin/`     | Paneles de administración, roles, auditoría                           | Activo                       |
| `analytics/` | KPIs MINSAL/DEIS y visualización                                      | Activo                       |
| `backup/`    | Gestión de respaldos y archivos                                       | Activo                       |
| `cudyr/`     | Módulo clínico CUDYR                                                  | Activo                       |
| `whatsapp/`  | Integración y configuración WhatsApp                                  | Activo                       |
| `auth/`      | UI/flows específicos de autenticación                                 | Acotado                      |
| `reports/`   | Espacio para reportes adicionales                                     | Reservado/ligero             |

## Subestructura esperada por feature

```text
feature/
├── components/   # UI del módulo
├── hooks/        # estado + orquestación de casos de uso
├── controllers/  # lógica pura, validación y transformación
├── domain/       # contratos/reglas de negocio propias
├── services/     # integración de datos específica del módulo
└── types/        # tipos locales del módulo
```

## Detalle por feature principal

### `census/`

- Módulo más extenso del sistema.
- Implementa patrón de comandos tipados para acciones de movimiento (alta/traslado/move-copy).
- Incluye boundaries de runtime y validaciones de fecha/turno centralizadas.

### `handoff/`

- Consolida entrega de turno y comunicación clínica.
- Se apoya en `DailyRecordContext` + hooks de handoff.

### `transfers/`

- Gestión de solicitud/confirmación/cancelación de traslados.
- Integración con generación documental y Google Drive.
- Documentación específica del módulo en [transfers/README.md](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/features/transfers/README.md).

### `admin/`

- Herramientas operativas: roles, mantenimiento, auditoría, diagnósticos.

## Reglas de arquitectura

- `controllers/hooks/domain/types` de una feature no deben importar capas restringidas de otra feature (controlado por script de arquitectura).
- Priorizar contratos locales (`types`, `domain/contracts`) antes de usar tipos ad-hoc en componentes.
- Todo consumo externo a la feature debe entrar por `index.ts` o `public.ts`. Evitar imports profundos desde `src/App.tsx`, `src/views/*` o desde otras features.
- Dentro de la feature, preferir imports relativos para distinguir claramente implementación interna
  de API pública. Los aliases `@/features/<feature>/...` quedan reservados para consumo externo y
  deben apuntar solo al entrypoint público.
- Si una vista/componente debe ser lazy-loaded por el router, exponerla primero desde el entrypoint público de la feature.

## Ejemplo de flujo dentro de una feature

```text
components/Modal
  -> hooks/useXxxForm
  -> controllers/xxxController
  -> hooks/useXxxCommand
  -> controllers/commandRuntimeController
  -> shared/service/context actions
```

## Navegación recomendada

1. `index.ts` de la feature.
2. `components` para entender UI.
3. `hooks` para flujo.
4. `controllers` para reglas de negocio.
5. `domain/types` para contratos.

## Entry points públicos actuales

- `auth/index.ts`: autenticación de alto nivel.
- `auth/public.ts`: API pública mínima de autenticación (`LoginPage` + props).
- `clinical-documents/public.ts`: contratos y helpers permitidos para `application`/`shared`.
- `admin/index.ts`: vistas operativas del panel admin.
- `backup/index.ts`: explorador de respaldos.
- `census/index.ts`: vistas y modales públicos del módulo.
- `cudyr/index.ts` y `cudyr/public.ts`: vistas y utilidades permitidas.
- `games/index.ts`: menú y accesos del feature lúdico.
- `handoff/index.ts`: vista principal de entrega de turno.
- `transfers/index.ts`: vista de gestión de traslados.
- `whatsapp/index.ts`: integración principal de WhatsApp.
