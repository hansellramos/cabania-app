# DB Migrate — Flujo de migración de base de datos

Ejecuta el flujo de migración de base de datos siguiendo el orden: **Local (Docker) → Neon Dev → Neon Prod**.

## Variables de entorno requeridas (en `server/.env`)

Todas las credenciales y IDs se leen de `server/.env`. Verifica que estas variables estén configuradas antes de ejecutar:

- `DATABASE_URL_LOCAL` — Connection string local (Docker)
- `DATABASE_URL_DEV` — Connection string Neon Dev
- `DATABASE_URL_PROD` — Connection string Neon Prod
- `NEON_PROJECT_ID` — ID del proyecto en Neon
- `NEON_DATABASE_NAME` — Nombre de la base de datos en Neon
- `TEST_USER_EMAIL` — Email para login en pruebas
- `TEST_USER_PASSWORD` — Password para login en pruebas

## Instrucciones

Sigue estos pasos en orden estricto. **Nunca saltes un paso ni apliques cambios en un ambiente remoto sin confirmación explícita del usuario.**

### Paso 1 — Identificar cambios pendientes

1. Lee el schema de Prisma en `server/prisma/schema.prisma`.
2. Compara con el estado actual de la base de datos local (Docker).
3. Genera el SQL equivalente a los cambios (ALTER TABLE, CREATE TABLE, ADD COLUMN, etc.).
4. Muestra al usuario un resumen claro de los cambios que se van a aplicar.

Si el usuario pasa un argumento con la descripción de los cambios, úsalo como contexto. Si no, detecta automáticamente los cambios del schema.

### Paso 2 — Verificar Docker local

1. Ejecuta `docker compose ps` para verificar que el container `cabanero-postgres` está corriendo.
2. Si no está corriendo, ejecuta `docker compose up -d` y espera a que esté listo.
3. Lee `DATABASE_URL_LOCAL` de `server/.env` y verifica conectividad ejecutando una query simple.

### Paso 3 — Aplicar en Local (Docker)

1. Ejecuta: `DATABASE_URL="$DATABASE_URL_LOCAL" npx prisma db push --schema server/prisma/schema.prisma` (usando el valor de `DATABASE_URL_LOCAL`).
2. Verifica que los cambios se aplicaron correctamente ejecutando una query de verificación (ej: `SELECT column_name FROM information_schema.columns WHERE table_name = 'tabla_afectada'`).
3. Muestra el resultado al usuario.

### Paso 4 — Probar localmente con Playwright

Antes de enviar cambios a cualquier ambiente remoto, verifica que la aplicación funciona correctamente en local con los cambios de DB aplicados.

1. Verifica que el servidor de desarrollo esté corriendo (`http://localhost:5173`). Si no, avisa al usuario que lo inicie.
2. Navega a `http://localhost:5173/#/login` con `mcp__playwright__browser_navigate`.
3. Lee `TEST_USER_EMAIL` y `TEST_USER_PASSWORD` de `server/.env` y haz login automático con esas credenciales.
4. Navega a las secciones afectadas por los cambios de DB y verifica que no hay errores:
   - Toma snapshots (`mcp__playwright__browser_snapshot`) y screenshots (`mcp__playwright__browser_take_screenshot`).
   - Revisa la consola del navegador (`mcp__playwright__browser_console_messages`) en busca de errores.
5. Si las pruebas pasan, muestra evidencia al usuario (screenshots) y continúa.
6. **Si hay errores, DETENTE.** Reporta los errores y no avances a ambientes remotos hasta que se resuelvan.

### Paso 5 — Confirmar para Neon Dev

1. Muestra al usuario la evidencia de las pruebas locales exitosas.
2. Muestra un resumen del SQL que se va a aplicar en **Neon Dev**.
3. Usa `AskUserQuestion` para pedir confirmación explícita antes de continuar.
4. **No continúes sin confirmación.**

### Paso 6 — Aplicar en Neon Dev

1. Lee `NEON_PROJECT_ID` y `NEON_DATABASE_NAME` de `server/.env`.
2. Usa la herramienta `mcp__Neon__run_sql` con:
   - `projectId`: valor de `NEON_PROJECT_ID`
   - `databaseName`: valor de `NEON_DATABASE_NAME`
   - SQL: los statements generados en el Paso 1
   - **No especifiques branchId** (usa el branch por defecto, que es dev)
3. Verifica que los cambios se aplicaron correctamente.
4. Muestra el resultado al usuario.

### Paso 7 — Confirmar para Neon Prod

1. Muestra al usuario un resumen de lo que se va a aplicar en **Neon Prod (PRODUCCIÓN)**.
2. Usa `AskUserQuestion` para pedir confirmación explícita. Incluye una advertencia clara de que esto es **PRODUCCIÓN**.
3. **No continúes sin confirmación.**

### Paso 8 — Aplicar en Neon Prod

1. Usa la herramienta `mcp__Neon__run_sql` con:
   - `projectId`: valor de `NEON_PROJECT_ID`
   - `branchId`: `main`
   - `databaseName`: valor de `NEON_DATABASE_NAME`
   - SQL: los mismos statements del Paso 1
2. Verifica que los cambios se aplicaron correctamente.
3. Muestra el resultado al usuario.

### Paso 9 — Resumen final

Muestra un resumen con el estado de cada ambiente:

| Paso | Estado | Detalles |
|------|--------|----------|
| Local (Docker) | OK/Error | ... |
| Pruebas Playwright | OK/Error | ... |
| Neon Dev | OK/Error | ... |
| Neon Prod | OK/Error | ... |

## Reglas importantes

- **Orden estricto**: Local → Pruebas Playwright → Dev → Prod. Nunca saltes pasos.
- **Pruebas obligatorias**: No avances a ambientes remotos sin haber verificado que la app funciona localmente con Playwright.
- **Confirmación obligatoria**: Siempre pide confirmación antes de Dev y antes de Prod.
- **SQL explícito**: Siempre muestra el SQL que se va a ejecutar antes de aplicarlo.
- **Verificación**: Después de cada aplicación, verifica que los cambios existen.
- **Rollback**: Si un paso falla, detente y reporta el error. No intentes continuar con el siguiente ambiente.
- **Sin datos destructivos**: Si el SQL incluye DROP TABLE, DROP COLUMN, o DELETE, advierte al usuario con énfasis especial.
- **Sin datos sensibles**: Nunca imprimas credenciales, connection strings ni API keys en el output. Usa las variables de entorno de `server/.env`.
