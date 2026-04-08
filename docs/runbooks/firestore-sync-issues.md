# Runbook: Firestore Sync Issues

## Síntomas

- Datos no se sincronizan entre dispositivos
- Indicador de "Guardando..." permanente
- Errores de concurrencia ("registro modificado por otro usuario")

## Diagnóstico

### 1. Verificar estado de conexión

- Abrir DevTools → Network → filtrar por `firestore`
- Si no hay requests: problema de red o firewall del hospital

### 2. Verificar consola del navegador

```
[ERROR] [firestoreWrite] save failed: ...
```

- `permission-denied` → verificar reglas de Firestore y rol del usuario
- `not-found` → el documento fue eliminado desde otro dispositivo
- `unavailable` → Firestore está caído o hay problemas de red

### 3. Verificar cache local

- DevTools → Application → IndexedDB → buscar `hhr-tracker`
- Si la DB está corrupta: borrar y recargar

## Resolución

### Conflicto de concurrencia

1. Recargar la página (F5)
2. El sistema usa "last-write-wins" con detección de conflictos (30s tolerancia)
3. Si persiste: verificar que no hay dos sesiones editando el mismo registro

### Cache corrupto

1. DevTools → Application → IndexedDB → Click derecho → Delete database
2. Recargar la página
3. Los datos se re-sincronizan desde Firestore

### Firestore no responde

1. Verificar https://status.firebase.google.com
2. La app funciona offline con IndexedDB como fallback
3. Los cambios se sincronizan automáticamente cuando la conexión se restaura
