# Navbar Status Model

## Semanticas distintas

- `Autenticacion`: existe sesion valida o estado auth soportado.
- `Conexion`: el cliente puede hablar con Firebase/servicios remotos.
- `Sincronizacion`: hay o no actividad/error de guardado y colas.

## Reglas de presentacion

- El punto del boton de usuario representa `conexion`.
- `SyncStatusIndicator` representa `sincronizacion`, y no debe mostrar pill persistente de "Conectado".
- El badge de avisos solo representa recordatorios pendientes, nunca estado de conexion o auth.

## Invariantes

- No mezclar estas tres semanticas en un mismo badge o copy.
- Si falla la conexion, el menu de usuario puede mostrar detalle textual; la navbar no debe llenarse de pills redundantes.
