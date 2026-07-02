# ADR: Observabilidad paciente-centrica

**Estado:** adoptado  
**Fecha:** 2026-07-02  
**Modulo:** Observabilidad / Auditoria

## Contexto

La auditoria historica se persistia correctamente como eventos `auditLogs` append-only, pero la
lectura normal estaba orientada a eventos crudos. Para entender que ocurrio con un paciente habia
que abrir multiples filas, repetir contexto de usuario/IP y reconstruir manualmente cambios que
pertenecian al mismo episodio operativo.

El caso guia fue un paciente con cambios cercanos de estado y diagnostico: ambos eventos eran
correctos como evidencia forense, pero debian verse como un solo bloque clinico legible.

## Decision

La fuente forense sigue siendo el log crudo append-only. No se elimina, modifica ni compacta ningun
evento persistido.

La vista principal de Observabilidad agrega una proyeccion derivada:

`AuditLogEntry[] -> ClinicalAuditPatientPackage[]`

Un paquete paciente-centrico agrupa eventos por:

1. fecha de censo (`recordDate`, `details.recordDate`, `dailyRecord.entityId` o fecha del timestamp);
2. identidad clinica fuerte (`episodeKey`, `clinicalEpisodeId`, RUT o `patientIdentifier`);
3. fallback estable cuando falta identidad fuerte (`patientName` + cama, o entidad);
4. ventana temporal corta de 10 minutos.

El paquete expone sin abrir detalle:

- paciente o sujeto afectado;
- RUT/identificador cuando existe;
- cama o movimiento de cama;
- fecha del censo;
- rango horario;
- responsables e IPs;
- modulos/acciones afectadas;
- cambios before/after normalizados;
- flags clinicas: alta, traslado, movimiento interno, CMA, conflicto, diagnostico y estado;
- cantidad de eventos crudos incluidos.

La expansion conserva los eventos originales y el JSON tecnico para auditoria forense.

## Contrato de verdad clinica visible

La verdad visible no es "el ultimo navegador que escribio". La vista paciente-centrica representa
la intencion clinica aceptada y agrupada por paciente/censo/episodio, preservando:

- mutacion aceptada por autoridad clinica;
- merge por intencion clinica cuando hay sincronizacion/conflictos;
- invariantes del censo diario;
- trazabilidad cruda append-only.

Si faltan identificadores fuertes, el fallback es deliberadamente conservador para evitar mezclar
pacientes distintos. El fallback permite lectura operativa, pero no reemplaza la necesidad futura de
`clinicalEpisodeId` completo en todos los eventos.

## Performance

La carga inicial de Observabilidad usa una ventana por defecto de 500 registros. La UI ofrece
"Cargar mas" para ampliar la ventana en bloques de 500 hasta un maximo gobernado. Esto reduce el
costo inicial sin ocultar que el usuario esta viendo una ventana acotada.

## Fuera de alcance

- Migrar documentos historicos de `auditLogs`.
- Reescribir Firestore o crear una base de auditoria separada.
- Eliminar la vista de eventos crudos.
- Firmas criptograficas o cadena legal inmutable adicional.

## Siguiente deuda razonable

- Consultas server-side por fecha/usuario/paciente con indices dedicados.
- Export Excel/PDF paciente-centrico.
- Metricas de latencia de Observabilidad por volumen de logs.
- Mayor adopcion de `clinicalEpisodeId` en emisores historicos.
