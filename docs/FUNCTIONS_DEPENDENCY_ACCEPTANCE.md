# Functions Dependency Acceptance

## Objetivo

Hacer explícita la deuda residual de dependencias `low` en `functions` para que no quede como riesgo implícito ni como presión para hacer upgrades mayores sin validación.

## Estado actual

- Workspace afectado: `functions`
- Severidad blocking del gate: `high`, `critical`
- Estado actual esperado: `0 high`, `0 critical`, `9 low`
- Fuente canónica: `reports/security/dependency-audit.md`

## Paquetes residuales aceptados temporalmente

Los `low` actuales vienen del árbol de `firebase-admin` / `firebase-functions` y hoy no tienen una remediación de bajo riesgo dentro del baseline vigente:

- `firebase-admin`
- `firebase-functions`
- `@google-cloud/firestore`
- `@google-cloud/storage`
- `@tootallnate/once`
- `google-gax`
- `http-proxy-agent`
- `retry-request`
- `teeny-request`

## Motivo de aceptación temporal

1. No hay vulnerabilidades `high` o `critical` abiertas en `functions`.
2. Las remediaciones sugeridas por `npm audit` caen en upgrades mayores o cambios de árbol que no son transparentes para el runtime serverless actual.
3. Forzar overrides adicionales sobre dependencias transitivas de Firebase/Google Cloud sin una ventana de validación amplia agrega más riesgo operativo del que reduce.

## Qué sí se exige mientras esta aceptación siga activa

- `npm run check:dependency-vulnerabilities` debe seguir en `ok`.
- No se aceptan regresiones a `high` o `critical`.
- No se aceptan nuevos `low` directos fuera del árbol actual sin revisarlos en la misma change.
- Cualquier upgrade de `firebase-admin` o `firebase-functions` debe reevaluar esta aceptación.

## Disparadores de reevaluación

Revisar esta aceptación cuando ocurra cualquiera de estos eventos:

1. upgrade de `firebase-admin`
2. upgrade de `firebase-functions`
3. cambio de runtime Node de `functions`
4. cambio de provider o adapters serverless críticos
5. aumento del conteo `low`
6. aparición de fix no-major y de bajo riesgo en el árbol actual

## Qué no hacer

- No forzar `overrides` transitivos incompatibles solo para bajar el contador.
- No cambiar majors del stack Firebase/Google Cloud sin validación específica de functions.
- No considerar estos `low` como "resueltos" mientras sigan apareciendo en `dependency-audit`.

## Criterio de cierre

Esta deuda se puede cerrar cuando ocurra al menos una de estas dos condiciones:

1. el árbol de `functions` queda en `0 low` sin introducir upgrades inseguros;
2. el stack serverless migra a versiones nuevas validadas y los `low` residuales dejan de existir.
