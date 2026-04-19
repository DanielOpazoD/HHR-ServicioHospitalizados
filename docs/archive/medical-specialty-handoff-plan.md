# Plan detallado: Entrega de turno médico por especialidad con autoría y fecha

## 1) Objetivo funcional

Permitir que **cada especialista autorizado** complete y mantenga sus propias notas de entrega de turno médico, separadas por especialidad:

- Cirugía
- Traumatología
- Ginecobstetricia
- Pediatría
- Psiquiatría
- Medicina Interna

Cada nota debe registrar:

- contenido de la nota,
- autor (nombre + uid + email),
- fecha/hora de creación y última edición,
- trazabilidad de edición (auditoría mínima).

Además, si un especialista no actualiza su nota en un día determinado, un administrador (u otro usuario explícitamente autorizado) debe poder registrar una **confirmación diaria de continuidad** con el mensaje: _"condición actual sin cambios respecto a última entrega de especialista"_.

Además, el acceso debe restringirse a usuarios con:

- correo institucional `@hospitalhangaroa.cl`, o
- correos Gmail explícitamente autorizados (allowlist).

---

## 2) Estado actual resumido (base para el cambio)

- Existe una sección de entrega de turno médico (`MEDICAL_HANDOFF`) ya integrada en navegación y permisos por módulo.
- El modelo `DailyRecord` actualmente soporta una nota médica global (`medicalHandoffNovedades`) y firma médica (`medicalSignature`), no una estructura por especialidad.
- El RBAC actual tiene roles como `admin`, `nurse_hospital`, `doctor_urgency`, con permisos de acción para firma médica, pero no control fino por especialidad.
- La configuración de funciones ya usa listas de correos permitidos por tipo de cuenta, incluyendo `DOCTOR_EMAILS` y allowlist compartida.

---

## 3) Diseño propuesto

### 3.1 Modelo de datos (extensión de `DailyRecord`)

Agregar un bloque nuevo, por ejemplo:

```ts
medicalHandoffBySpecialty?: {
  cirugia?: SpecialtyHandoffNote;
  traumatologia?: SpecialtyHandoffNote;
  ginecobstetricia?: SpecialtyHandoffNote;
  pediatria?: SpecialtyHandoffNote;
  psiquiatria?: SpecialtyHandoffNote;
  medicinaInterna?: SpecialtyHandoffNote;
};
```

Donde `SpecialtyHandoffNote` incluiría:

```ts
interface SpecialtyHandoffNote {
  note: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  author: {
    uid: string;
    displayName: string;
    email: string;
    specialty: MedicalSpecialty;
  };
  lastEditor?: {
    uid: string;
    displayName: string;
    email: string;
  };
  version: number;
}
```

**Decisión clave:** mantener `medicalHandoffNovedades` como legado por compatibilidad temporal y migrar UI/escritura al nuevo campo.

---

### 3.2 Identidad clínica por usuario

Agregar en claims/perfil de usuario:

- `role` (ya existe),
- `medicalSpecialties: MedicalSpecialty[]` (1..n),
- `isInstitutionalOrAllowedExternal: boolean`.

Esto permitirá:

- un especialista con 1 sola especialidad → edita su sección;
- especialista con múltiples especialidades autorizadas → edita varias;
- admin → lectura global y override opcional.

---

### 3.3 Reglas de autorización

#### Backend (fuente de verdad)

1. Validar email:
   - permitido si termina en `@hospitalhangaroa.cl`, o
   - pertenece a allowlist explícita de Gmail autorizados.
2. Validar claims de especialidad.
3. En escritura de nota de especialidad:
   - el usuario solo puede modificar `medicalHandoffBySpecialty.<suEspecialidad>`.
4. Bloquear edición cruzada (p.ej. pediatría intentando editar cirugía).

#### Frontend (UX + prevención temprana)

- Mostrar solo tabs de especialidades habilitadas para el usuario.
- Campo de texto en read-only para especialidades sin permiso.
- Indicadores de “Última edición por X, fecha Y”.

---

### 3.4 UI/UX propuesta

En `Entrega Turno Médicos`:

1. Reemplazar “nota médica única” por **tabs por especialidad**.
2. Cada tab contiene:
   - editor de nota,
   - metadata de autoría,
   - sello temporal,
   - estado de guardado/sincronización.
3. Agregar filtro “Ver todas” para admin/jefatura.
4. En impresión/PDF:
   - incluir secciones por especialidad,
   - con nombre del autor y timestamp.

---

### 3.5 Auditoría y trazabilidad

Registrar eventos de auditoría específicos:

- `medical_handoff_specialty_note_created`
- `medical_handoff_specialty_note_updated`
- `medical_handoff_specialty_note_attempt_denied`

Con campos: `uid`, `email`, `specialty`, `recordDate`, `before/afterHash`, `timestamp`.

### 3.6 Confirmación diaria “sin cambios” por usuario autorizado

Para cubrir días sin actualización del especialista, agregar una acción adicional por especialidad:

- `confirm_no_changes_since_last_specialist_note`

#### Regla funcional

1. Si la nota de la especialidad no fue modificada hoy por un especialista autorizado, un admin/usuario delegado puede registrar confirmación diaria.
2. La confirmación **no reemplaza** la nota clínica del especialista; solo certifica continuidad para la entrega del día.
3. Debe quedar visible quién confirmó y cuándo.

#### Modelo sugerido

Agregar dentro de cada `SpecialtyHandoffNote`:

```ts
dailyContinuity?: {
  [dateKey: string]: {
    status: 'updated_by_specialist' | 'confirmed_no_changes';
    confirmedBy?: {
      uid: string;
      displayName: string;
      email: string;
      role: string;
    };
    confirmedAt?: string; // ISO
    comment?: string; // ej: "condición actual sin cambios respecto a última entrega..."
  };
};
```

`dateKey` puede ser `YYYY-MM-DD` de la jornada clínica.

#### UX recomendada

- En cada tab de especialidad, mostrar estado del día:
  - ✅ “Actualizado por especialista hoy”
  - 🟡 “Confirmado sin cambios por autorizado”
  - 🔴 “Pendiente de actualización/confirmación”
- Botón visible solo para admin/delegados: **Confirmar sin cambios hoy**.
- Al confirmar, autocompletar comentario estándar editable.

#### Guardas de seguridad

- Solo roles con permiso explícito pueden confirmar “sin cambios”.
- No permitir confirmar si ya existe actualización del especialista ese mismo día (o exigir confirmación explícita de override).
- Guardar evento de auditoría independiente.

---

## 4) Plan de implementación por fases

## Fase 0 — Alineamiento clínico-operacional (1–2 días)

- Validar catálogo oficial de especialidades (nombres canónicos y aliases).
- Definir dueños funcionales por especialidad (jefaturas).
- Acordar política de Gmail autorizado (quién aprueba, cómo se da de baja).

**Entregable:** documento de reglas de negocio firmado por referentes clínicos.

## Fase 1 — Dominio y contratos (2–3 días)

- Extender tipos (`DailyRecord`, tipos auxiliares y patch paths).
- Crear contrato de especialidades médicas (`MedicalSpecialty`).
- Añadir funciones utilitarias de normalización (ej. “gineco”, “g-obst”).
- Mantener backward compatibility con campo legado.

**Entregable:** PR de tipos/contratos + tests unitarios de mapeo.

## Fase 2 — Autenticación y autorización (3–4 días)

- Extender resolución de rol/claims para incluir especialidades autorizadas.
- Ajustar callable/admin tools para asignar especialidades.
- Validar dominio de email + allowlist Gmail.
- Endurecer reglas de escritura (Firestore/functions) por especialidad.

**Entregable:** PR de seguridad + tests de autorización positivos/negativos.

## Fase 3 — UI médica por especialidad (4–6 días)

- Implementar tabs de especialidad en módulo `MEDICAL_HANDOFF`.
- Editor por tab con autosave controlado.
- Mostrar metadata (autor y fecha) bajo cada nota.
- Modo admin “visión consolidada”.
- Estado diario por especialidad (actualizado/confirmado sin cambios/pendiente).
- Acción “Confirmar sin cambios hoy” para perfiles autorizados.

**Entregable:** PR frontend + tests de componentes + E2E de flujo médico.

## Fase 4 — Auditoría y observabilidad (2 días)

- Eventos de auditoría de creación/edición/denegación.
- Dashboard mínimo con conteo por especialidad y por día.
- Alertas básicas de intentos de edición no autorizada.
- Trazabilidad de confirmaciones diarias “sin cambios”.

**Entregable:** PR de auditoría + reporte operativo inicial.

## Fase 5 — Migración gradual y despliegue (2–3 días)

- Feature flag: `medicalHandoffBySpecialtyEnabled`.
- Migración lazy:
  - si existe `medicalHandoffNovedades` legado, mostrarlo en bloque “histórico/legacy”;
  - nuevas escrituras van solo al esquema por especialidad.
- Capacitación breve a médicos especialistas.
- Monitoreo 1 semana post go-live.

**Entregable:** rollout controlado + checklist de reversa.

---

## 5) Pruebas recomendadas

### 5.1 Unitarias

- Normalización de especialidad.
- Guard de autorización por email + claims.
- Función que determina ruta editable por especialidad.

### 5.2 Integración

- Usuario pediatría edita pediatría ✅ / no edita cirugía ❌.
- Admin visualiza todo y solo sobreescribe si política lo permite.
- Usuario sin dominio permitido ni allowlist → acceso denegado.
- Especialista no actualiza hoy; admin confirma “sin cambios” y estado diario queda en amarillo.
- Si especialista actualiza luego, estado pasa a “actualizado por especialista” y se conserva historial.

### 5.3 E2E

- Login → módulo médico → tab especialidad → guardar → refrescar → persiste autor/fecha.
- Concurrencia: dos sesiones del mismo especialista (última edición controlada).
- Export/print incluye bloques por especialidad.

### 5.4 Seguridad

- Intento de escritura directa a ruta de otra especialidad desde cliente manipulado.
- Intento con token válido pero claim de especialidad ausente.
- Intento con gmail no autorizado.
- Intento de confirmar “sin cambios” por rol no autorizado.

---

## 6) Riesgos y mitigaciones

- **Riesgo:** claims de especialidad incompletos al inicio.  
  **Mitigación:** fallback read-only + proceso express de alta de especialidades.

- **Riesgo:** confusión de nomenclaturas clínicas.  
  **Mitigación:** catálogo canónico con aliases y validación server-side.

- **Riesgo:** sobreescritura accidental en concurrencia.  
  **Mitigación:** control por `updatedAt/version` y resolución explícita de conflicto.

- **Riesgo:** dependencia en allowlist manual Gmail.  
  **Mitigación:** owner operativo + revisión semanal automática.

---

## 7) KPIs de éxito

- % de entregas médicas completadas por especialidad.
- Tiempo promedio de registro por especialista.
- Tasa de intentos denegados por permisos (debe bajar tras estabilización).
- % de notas con autoría completa (objetivo: 100%).
- % de días con estado válido por especialidad (`updated_by_specialist` o `confirmed_no_changes`).

---

## 8) Recomendación de implementación técnica concreta (resumen)

1. **No reemplazar de golpe** el campo actual: introducir nuevo esquema coexistente.
2. **Hacer enforcement en backend/rules** (frontend solo ayuda UX).
3. **Claims de especialidad + validación de dominio/allowlist** como condición de edición.
4. **Auditoría desde día 1** para trazabilidad médico-legal.
5. **Feature flag + despliegue por etapas** para reducir riesgo operacional.
