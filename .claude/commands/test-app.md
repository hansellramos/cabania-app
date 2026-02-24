# Test App — Pruebas E2E con Playwright

Ejecuta pruebas end-to-end de la aplicación usando Playwright MCP. Soporta tres ambientes: **Local**, **Dev (Vercel)** y **Prod (Vercel)**.

## Variables de entorno requeridas (en `server/.env`)

- `TEST_USER_EMAIL` — Email para login en pruebas
- `TEST_USER_PASSWORD` — Password para login en pruebas
- `VERCEL_PROJECT_ID` — ID del proyecto en Vercel
- `VERCEL_TEAM_ID` — ID del equipo en Vercel
- `VERCEL_PROD_DOMAIN` — Dominio de producción

## Instrucciones

### Paso 1 — Seleccionar ambiente

Usa `AskUserQuestion` para preguntar al usuario en qué ambiente quiere probar:

| Ambiente | URL base | Auth |
|----------|----------|------|
| **Local** | `http://localhost:5173` | Login con credenciales |
| **Dev (Vercel)** | Obtener de Vercel MCP | Login con credenciales |
| **Prod (Vercel)** | Leer `VERCEL_PROD_DOMAIN` de `server/.env` | Passkeys (manual) |

Si el usuario pasa un argumento (ej: `/test-app local`, `/test-app dev`, `/test-app prod`), úsalo directamente sin preguntar.

### Paso 2 — Obtener URL del ambiente

#### Local
- URL: `http://localhost:5173`
- Verifica que Vite esté corriendo. Si no, avisa al usuario que debe iniciar el servidor de desarrollo.

#### Dev (Vercel preview)
Cada push a cualquier rama genera un deployment en Vercel. La URL puede cambiar entre deployments.

1. Lee `VERCEL_PROJECT_ID` y `VERCEL_TEAM_ID` de `server/.env`.
2. Usa `mcp__vercel__list_deployments` con esos valores.
3. Busca el deployment más reciente que esté en estado `READY`. Si el usuario especificó una rama, filtra por esa rama; si no, usa el deployment más reciente de cualquier rama (excluyendo `main`/producción).
4. Usa `mcp__vercel__get_access_to_vercel_url` con la URL del deployment para obtener una URL con token que bypasea la autenticación de Vercel.
5. Usa esa URL con token para navegar en Playwright.

#### Prod (Vercel)
- Lee `VERCEL_PROD_DOMAIN` de `server/.env` y construye la URL: `https://{VERCEL_PROD_DOMAIN}`
- **IMPORTANTE**: En producción la autenticación es con passkeys. No puedes hacer login automático.
- Navega a la URL y pide al usuario que se autentique manualmente con passkeys.
- Usa `mcp__playwright__browser_snapshot` para verificar que el usuario completó el login.

### Paso 3 — Autenticación

#### Local y Dev — Login automático
1. Lee `TEST_USER_EMAIL` y `TEST_USER_PASSWORD` de `server/.env`.
2. Navega a `{BASE_URL}/#/login` usando `mcp__playwright__browser_navigate`.
3. Espera a que cargue la página con `mcp__playwright__browser_snapshot`.
4. Llena el formulario de login con `mcp__playwright__browser_fill_form` usando las credenciales leídas.
5. Haz click en el botón de login con `mcp__playwright__browser_click`.
6. Espera la redirección al dashboard con `mcp__playwright__browser_wait_for` (busca texto del dashboard o espera unos segundos).
7. Toma un snapshot para verificar que el login fue exitoso.

#### Prod — Login manual con passkeys
1. Navega a `{BASE_URL}/#/login`.
2. Informa al usuario: "Estás en producción. Por favor autentícate con passkeys en el navegador."
3. Usa `AskUserQuestion` para esperar confirmación del usuario de que completó el login.
4. Toma un snapshot para verificar que el login fue exitoso.

### Paso 4 — Ejecutar pruebas

Una vez autenticado, ejecuta las pruebas que el usuario solicite. Si no especifica qué probar, haz un smoke test básico:

#### Smoke test por defecto
1. **Dashboard**: Verifica que el dashboard carga correctamente (snapshot + screenshot).
2. **Navegación**: Navega a las secciones principales y verifica que cargan:
   - `/#/venues` — Venues
   - `/#/reservations` — Reservaciones
   - `/#/calendar` — Calendario
   - `/#/analytics` — Analytics
3. **API health**: Navega a `{BASE_URL}/api/health` o verifica en consola que no hay errores de red.

#### Pruebas específicas
Si el usuario pide probar algo específico (ej: "prueba el formulario de crear venue"), sigue sus instrucciones usando las herramientas de Playwright:
- `mcp__playwright__browser_navigate` — Navegar a URLs
- `mcp__playwright__browser_snapshot` — Capturar estado accesible de la página
- `mcp__playwright__browser_take_screenshot` — Capturar screenshots visuales
- `mcp__playwright__browser_click` — Hacer click en elementos
- `mcp__playwright__browser_fill_form` — Llenar formularios
- `mcp__playwright__browser_type` — Escribir texto en campos
- `mcp__playwright__browser_wait_for` — Esperar elementos o texto
- `mcp__playwright__browser_console_messages` — Ver mensajes de consola
- `mcp__playwright__browser_network_requests` — Ver requests de red
- `mcp__playwright__browser_select_option` — Seleccionar opciones en dropdowns
- `mcp__playwright__browser_press_key` — Presionar teclas
- `mcp__playwright__browser_run_code` — Ejecutar código Playwright personalizado

### Paso 5 — Reporte de resultados

Al finalizar las pruebas, presenta un resumen:

| Prueba | Estado | Detalles |
|--------|--------|----------|
| Login | PASS/FAIL | ... |
| Dashboard | PASS/FAIL | ... |
| ... | ... | ... |

Si hay errores, incluye:
- Screenshot del error
- Mensajes de consola relevantes (`mcp__playwright__browser_console_messages`)
- Network requests fallidos si aplica

## Reglas importantes

- **Sin datos sensibles**: Nunca imprimas credenciales, connection strings ni API keys en el output. Lee siempre de `server/.env`.
- **Producción** siempre requiere autenticación manual del usuario (passkeys).
- Si una prueba falla, **no pares**: continúa con las demás y reporta todos los resultados al final.
- Usa `browser_snapshot` (accesibilidad) para encontrar elementos y `browser_take_screenshot` para evidencia visual.
- Si Playwright no está instalado, usa `mcp__playwright__browser_install` primero.
- Al terminar todas las pruebas, cierra el browser con `mcp__playwright__browser_close`.
