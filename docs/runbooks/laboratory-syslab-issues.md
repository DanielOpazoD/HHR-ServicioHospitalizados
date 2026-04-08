# Runbook: Laboratorio / Syslab Issues

## Arquitectura

```
Browser → Express proxy (localhost:3000) → Syslab (10.4.69.90) via Playwright
```

## Síntomas comunes

### "Failed to fetch" al buscar exámenes

**Causa**: El servidor Express no está corriendo.

```bash
cd /path/to/API-laboratorioHHR
node server.js
```

Verificar: `curl http://localhost:3000/api/exams?rut=12345678`

### "Error interno al procesar el scraping"

**Causa**: Playwright no puede conectar a Syslab (10.4.69.90).

1. Verificar que estás en la red del hospital
2. Probar: `ping 10.4.69.90`
3. Si el portal cambió de URL, actualizar `config/env.js`

### Exámenes vacíos (0 resultados)

**Causa**: El RUT no tiene exámenes o el formato es incorrecto.

- Syslab requiere RUT sin puntos, sin guión, sin dígito verificador
- El sistema limpia automáticamente: "12.345.678-9" → "12345678"
- Verificar directamente en http://10.4.69.90/syslab/

### Parser no reconoce variables

**Causa**: El formato del PDF cambió.

1. Revisar logs: `/path/to/API-laboratorioHHR/logs/raw_extract_*.txt`
2. Comparar texto crudo con regex en `utils/reportParser.js`
3. El parser tiene 4 regex: con pipes, sin pipes, notación científica, cualitativo

### PDF no se ve en el visor

**Causa**: El link del examen está malformado o la sesión expiró.

1. El Express server re-autentica en cada request (stateless)
2. Verificar que el link contiene `detalleexamenes.php?id=`
3. Si Syslab cambió la estructura HTML, actualizar `scraperOrchestrator.js`

## Variables de entorno

- `VITE_SYSLAB_API_URL` — URL del Express proxy (default: `http://localhost:3000`)
- `SYSLAB_BASE_URL` — URL de Syslab en el Express server (default: `http://10.4.69.90/syslab/`)
- `SYSLAB_USER` / `SYSLAB_PASS` — Credenciales de Syslab
