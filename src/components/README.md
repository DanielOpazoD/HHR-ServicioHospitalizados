# `src/components`

## Propósito

Capa de presentación reusable: layout global, componentes compartidos, modales y piezas UI reutilizables.

## Estructura

| Path                                                  | Rol                                                                          |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| `AppProviders.tsx`                                    | Ensamble de providers del árbol de app                                       |
| `AppRouter.tsx`                                       | Router por módulo (lazy views + permisos)                                    |
| `DeviceSelector.tsx`                                  | Selector visual de dispositivos                                              |
| `layout/`                                             | Navbar, DateStrip, AppContent, badges de estado                              |
| `modals/`                                             | Modales globales de acciones/configuración                                   |
| `shared/`                                             | Componentes transversales (`BaseModal`, error boundaries, viewer modals)     |
| `ui/`                                                 | Primitivas y helpers de interacción (`VirtualizedTable`, inputs y status UI) |
| `bookmarks/`                                          | UI de marcadores                                                             |
| `device-selector/`                                    | UI + controllers locales del selector de dispositivos                        |
| `exam-request/`                                       | Subcomponentes del flujo de solicitud de examen                              |
| `security/`                                           | UI de bloqueo/pin                                                            |
| `debug/`                                              | Componentes de diagnóstico interno                                           |
| `admin/`, `auth/`, `census/`, `handoff/`, `whatsapp/` | Espacios reservados/compatibilidad                                           |
| `index.ts`                                            | Barrel export de componentes                                                 |

## Archivos clave

| Archivo                         | Cuándo tocarlo                                        |
| ------------------------------- | ----------------------------------------------------- |
| `AppRouter.tsx`                 | Cambios de navegación entre módulos o gating por rol  |
| `layout/AppContent.tsx`         | Cambios de shell principal de UI                      |
| `modals/ActionModals.tsx`       | Cambios en modales clínicos principales               |
| `shared/BaseModal.tsx`          | Ajustes de comportamiento/estilo de todos los modales |
| `ui/DatabaseStatusBanner.tsx`   | Indicadores de degradación de persistencia            |
| `layout/StorageStatusBadge.tsx` | Alertas de fallback de almacenamiento                 |

## Patrones clave

- **Container/Presentational híbrido**: vistas grandes delegan en subcomponentes.
- **Runtime adapter**: componentes críticos usan `defaultBrowserWindowRuntime` en lugar de `window.*`.
- **Boundary-first UX**: `GlobalErrorBoundary` y `SectionErrorBoundary` para resiliencia visual.

## Ejemplo de uso

```tsx
import { BaseModal } from '@/components/shared/BaseModal';

<BaseModal isOpen={isOpen} onClose={onClose} title="Editar">
  {/* contenido */}
</BaseModal>;
```

## Reglas de mantenimiento

1. Evitar lógica de negocio compleja en componente; mover a hooks/controllers.
2. Si el componente tiene efectos de browser (`alert`, `open`, etc.), usar adapter runtime.
3. Si crece demasiado, dividir por subcomponentes y documentar en este README.
