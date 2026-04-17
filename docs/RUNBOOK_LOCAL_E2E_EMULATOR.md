# Runbook — Correr tests E2E con emulador de Firestore en local

Cómo ejecutar los tests E2E que requieren emulador (flow-performance, critical-emulator, auth resilience, etc.) desde tu máquina. Útil para reproducir fallas de CI localmente o cerrar el estado `flow=unknown` del scorecard antes de un release.

## Requisitos

1. **Node 22.x** — ya está en el repo (`.nvmrc`).
2. **Java 21+** — el emulador Firestore corre en JVM.
3. **firebase-tools** — instalado como dep local (`npm install` lo trae).
4. **Chromium de Playwright** — instalado por el dev environment.

### Verificar Java

```bash
# Si esto falla, instalar OpenJDK:
#   brew install openjdk@21
#
# El script del repo busca OpenJDK en /opt/homebrew/opt/openjdk@21
# (macOS Apple Silicon) o /usr/local/opt/openjdk@21 (Intel). Si está
# en otra ruta, exportar JAVA_HOME manualmente antes de correr.
java -version
```

Si `java -version` falla pero Homebrew sí lo tiene instalado, exportar la ruta antes del comando:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
export PATH="$JAVA_HOME/bin:$PATH"
```

El script `scripts/lib/firebase-emulator-ci.sh:ensure_java_available` intenta esta resolución automáticamente en CI; para runs locales con PATH limpio puede ser necesario hacerlo a mano.

## Correr el paquete completo de E2E críticos

Lanza los 7 specs emulator-críticos + el flow-performance spec en un solo run. ~3-6 min total. Limpia el emulador al salir.

```bash
bash scripts/run-e2e-critical-emulator-ci.sh
```

Si el `webServer` de Playwright falla con `Timed out waiting 120000ms from config.webServer`, es porque `npm run dev` no arrancó a tiempo. Lo suelen gatillar:

- Primera ejecución post `npm install` (caché Vite frío).
- Puerto 3000 ocupado por otro proceso (`lsof -i :3000`).

Correr `npm run dev -- --host 127.0.0.1 --port 3000` una vez manualmente y matarlo; el caché queda calentado.

## Correr sólo el flow-performance spec

Más rápido (~30 s–1 min) cuando sólo interesa regenerar el artefacto de presupuestos de arranque para el scorecard.

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
export PATH="$JAVA_HOME/bin:$PATH"
./node_modules/.bin/firebase emulators:exec --only firestore \
  "npm run test:e2e:flow-performance"
```

Output esperado:

```
✔  firestore: Firestore Emulator UI websocket is running on 9150.
[1/1] [chromium] › e2e/startup-performance-budget.spec.ts:… › Startup performance budget › meets login, auth, censo, clinical documents, and backup visibility budgets
  1 passed (6.3s)
```

El artefacto se escribe en:

- `reports/e2e/flow-performance-budget.json` (medidas crudas).
- Después corre `node scripts/report-flow-performance-budget.mjs` para derivar `reports/e2e/flow-performance-budget-summary.{json,md}`.

## Regenerar el scorecard tras correr el flow

Una vez exista `flow-performance-budget-summary.json` fresco, regenerar todos los reports y validar:

```bash
node scripts/report-flow-performance-budget.mjs
npm run report:governance-snapshots
npm run check:quality
```

`system_confidence.operational_budgets.flow` pasa de `unknown` a:

- `ok` si todas las métricas cumplen **target** (1500 ms para censo, etc.).
- `target-violations` si el **enforced max** (2500 ms censo) pasa pero el target no.
- `enforced-violations` si un flow supera el enforced max — **esto sí bloquea release**.

## Targets vs. enforced — política corta

- **Enforced max** (`enforcedMaxMs`) = contrato con el usuario. Violarlo bloquea.
- **Target** (`targetMs`) = objetivo aspiracional. Violarlo degrada el scorecard pero no bloquea.

No bajar targets sin una investigación documentada del porqué. El scorecard en `target-violations` es información útil, no una falsa alarma.

## Diagnóstico rápido de un flow lento

Si `reports/e2e/flow-performance-budget.json` muestra un flow fuera de target:

1. Revisar `breakdown` del JSON — se desglosa en `navigationMs`, `readyStateMs`, `ensureRecordMs`, etc.
2. El tiempo dominante suele ser `readyStateMs` (render post-mount). Investigar el feature hook que bloquea el render (`useEffect` sincrónicos, queries no-lazy, imports estáticos pesados).
3. Contra-probar con `npm run build && npm run preview -- --host 127.0.0.1 --port 4173` y correr manualmente el flujo para cronometrar en producción.

## Qué **no** hace este runbook

- No cubre `test:e2e` genérico (específico del emulador crítico; el runner genérico corre contra el dev server sin emulador).
- No cubre setup de CI (ese camino está en `.github/workflows/ci-cd.yml`).
- No reemplaza `RUNBOOK_SYNC_RESILIENCE.md` para incidentes de sync — este es sólo para correr los tests de arranque.
