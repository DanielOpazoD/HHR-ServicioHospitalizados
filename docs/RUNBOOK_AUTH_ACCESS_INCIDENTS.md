# Runbook Auth Access Incidents

## Objetivo

Resolver rápido incidentes donde un usuario:

- debería poder entrar y no puede;
- fue removido y todavía entra;
- ve diferencias entre `localhost` y Netlify;
- entra al login pero no materializa shell.

## Fuente canónica

Antes de depurar, tomar como fuente de verdad:

- [Auth Access Model](./AUTH_ACCESS_MODEL.md)

No usar como referencia primaria:

- documentación generada antigua;
- comentarios legacy sobre `whitelist`;
- claims históricos como evidencia suficiente de acceso.

## Caso 1: el correo está en Gestión de Roles pero no puede entrar

1. revisar `config/roles` y confirmar:
   - email exacto;
   - sin espacios;
   - rol válido.
2. validar que el frontend publicado use el flujo actual:
   - popup Google;
   - callable `checkUserRole`;
   - rechazo con `signOut` si no hay rol.
3. validar que las Functions publicadas correspondan al mismo modelo:
   - `checkUserRole` debe consultar `config/roles`;
   - no debe depender de listas legacy para login general.
4. revisar consola/red:
   - error en callable `checkUserRole`;
   - CSP bloqueando Cloud Functions;
   - build viejo en Netlify.
5. si en localhost funciona y en Netlify no:
   - redeploy frontend;
   - redeploy functions si cambió backend auth;
   - recarga dura una vez.

Chequeo operativo adicional:

- revisar `authRuntimeSnapshot` si el shell no aparece:
  - `budgetProfile`
  - `pendingAgeMs`
  - `runtimeState`
- si `runtimeState = recoverable`, priorizar redirect/popup pendiente antes de asumir fallo duro.
- si `runtimeState = unauthorized`, revisar rol/configuracion antes de depurar bootstrap.

## Caso 2: el correo fue removido pero todavía entra

1. confirmar que el correo ya no exista en `config/roles`;
2. confirmar que el callable publicado ya resuelva `null` o `unauthorized`;
3. confirmar que el frontend publicado ya haga `signOut` en usuarios sin rol;
4. cerrar sesión y volver a entrar;
5. si persiste, revisar si la sesión actual está rehidratando desde un build viejo.

## Caso 3: el usuario entra a Google pero vuelve al login con “Acceso no autorizado”

1. confirmar que el correo autenticado sea exactamente el esperado;
2. revisar si el rol está asignado en `config/roles`;
3. revisar si el rol pertenece al login general:
   - `admin`
   - `nurse_hospital`
   - `doctor_urgency`
   - `doctor_specialist`
   - `viewer`
   - `editor`
4. si el rol es `viewer_census`, no aplica al login general.

## Caso 4: localhost funciona y Netlify no

1. comparar build/local vs deploy actual;
2. revisar `netlify.toml` si hay síntomas de CSP o popup Google;
3. verificar que Netlify esté sirviendo un frontend con el flujo nuevo;
4. verificar que Firebase Functions del proyecto activo estén desplegadas.

## Señales esperadas del sistema sano

- usuario autorizado:
  - entra;
  - materializa shell;
  - recibe el rol correcto.
- usuario no autorizado:
  - no entra;
  - no ve navbar;
  - vuelve al login con error visible.
- usuario removido:
  - no rehidrata shell al recargar.

## Archivos clave

- [src/services/auth/authPolicy.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/services/auth/authPolicy.ts)
- [src/services/auth/authAccessResolution.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/services/auth/authAccessResolution.ts)
- [src/services/auth/authSession.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/services/auth/authSession.ts)
- [src/services/auth/authRoleLookup.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/services/auth/authRoleLookup.ts)
- [functions/lib/auth/authFunctionsFactory.js](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/functions/lib/auth/authFunctionsFactory.js)
- [functions/lib/auth/authHelpersFactory.js](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/functions/lib/auth/authHelpersFactory.js)
