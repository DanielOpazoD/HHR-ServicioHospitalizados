# Auth Access Model

## Objetivo

Definir la fuente de verdad y el flujo real del acceso al sistema para que auth no dependa de leer código disperso.

Estado documental:

- este archivo es la referencia canónica para auth/login general;
- si otro documento o comentario contradice este modelo, este archivo prevalece;
- documentación generada o legacy no debe usarse como fuente primaria de permisos.

## 1. Fuente de verdad

Para el **login general** la fuente operativa de acceso es:

- `config/roles` en Firestore

Excepción mínima:

- allowlist técnica de bootstrap admin para recuperación

No forman parte del login general:

- `allowedUsers`
- listas hardcodeadas legacy de roles
- lookups cloud legacy fuera del callable actual de resolución

## 2. Regla principal

Un usuario puede iniciar sesión en el shell principal **solo si**:

1. autenticó con Google/Firebase
2. su correo tiene un rol válido en `config/roles`

Si no cumple eso:

- se hace `signOut`
- no se construye sesión de app usable
- no se monta navbar ni módulos
- el usuario vuelve al login con error visible

## 3. Flujo real del login general

```text
Google popup
  -> Firebase Auth user
  -> frontend pide rol efectivo
  -> callable checkUserRole
  -> backend consulta config/roles
  -> rol válido / no autorizado
  -> entrar al shell / signOut + volver a login
```

Puntos clave:

- el cliente **no** lee `config/roles` directamente
- el rol efectivo se resuelve desde backend
- claims viejos no deben volver a autorizar por sí solos un acceso ya revocado
- si aparece un alias legacy de rol en `config/roles`, backend y Gestión de Roles lo recanonizan a `viewer`

## 4. Shared Census

No existe una vía paralela de acceso por link para el censo.

No usa la misma regla de acceso que el login general y no debe mezclarse con este modelo.

## 5. Roles operativos actuales

| Rol                 | Puede usar login general | Alcance resumido                                       |
| ------------------- | ------------------------ | ------------------------------------------------------ |
| `admin`             | sí                       | acceso completo                                        |
| `nurse_hospital`    | sí                       | operación clínica/enfermería                           |
| `doctor_urgency`    | sí                       | handoff/firma médica y permisos clínicos asociados     |
| `doctor_specialist` | sí                       | `CENSUS` + `MEDICAL_HANDOFF` con capacidades limitadas |
| `viewer`            | sí                       | acceso limitado según policy vigente                   |
| `editor`            | sí                       | accesos técnicos/operativos según policy vigente       |

## 6. Perfil especialista

`doctor_specialist`:

- entra por el login normal con Google
- no tiene shell paralelo
- no usa modo/link especial separado
- depende de la misma resolución de rol que los demás usuarios internos

## 7. Qué hace Gestión de Roles

La sección web de Gestión de Roles:

- agrega o elimina correos en `config/roles`
- define el rol efectivo del login general

Efecto esperado:

- si un correo se agrega en `config/roles`, puede entrar
- si un correo se elimina de `config/roles`, deja de poder entrar

## 8. Qué revisar si un usuario “debería entrar” pero no entra

1. confirmar que el correo esté presente y bien escrito en `config/roles`
2. confirmar que el rol asignado sea válido
3. si el documento viene de una migración antigua, recargar Gestión de Roles o reintentar login para forzar recanonización del alias legacy
4. confirmar que frontend publicado incluya la resolución actual por `checkUserRole`
5. confirmar que functions publicadas consulten `config/roles`
6. confirmar que `firestore.rules` publicadas no hayan cambiado el perímetro

## 9. Qué revisar si un usuario “removido” sigue entrando

1. verificar que el correo realmente ya no esté en `config/roles`
2. verificar que el callable `checkUserRole` ya esté desplegado
3. verificar que el frontend publicado ya no dependa de fuentes legacy
4. hacer recarga dura y repetir login

## 10. Archivos clave

- [src/services/auth/authAccessResolution.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/services/auth/authAccessResolution.ts)
- [src/services/auth/authPolicy.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/services/auth/authPolicy.ts)
- [src/services/auth/authRoleLookup.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/services/auth/authRoleLookup.ts)
- [functions/lib/auth/authFunctionsFactory.js](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/functions/lib/auth/authFunctionsFactory.js)
- [functions/lib/auth/authHelpersFactory.js](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/functions/lib/auth/authHelpersFactory.js)
- [firestore.rules](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/firestore.rules)

## 11. Runbook de incidentes

Para soporte operativo rápido:

- [Runbook Auth Access Incidents](./RUNBOOK_AUTH_ACCESS_INCIDENTS.md)
