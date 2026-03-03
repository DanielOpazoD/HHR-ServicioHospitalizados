# `functions/lib/auth`

## Contrato

- Resolver roles, claims y autorización reusable para callables/eventos de auth.
- Mantener helpers puros en `authPolicies.js` y factories testables en `authHelpersFactory.js`.

## Límites

- No mezclar lógica de mirror o MINSAL aquí.
- Nuevos checks de permisos deben exponerse como helper reusable antes de entrar al wrapper público.
- Validaciones de callables administrativas deben centralizarse en `authCallablePolicy.js`.
