# Analytics (PostHog)

Frontend: `src/lib/analytics.js`. Backend: `server/lib/analytics.js`. Nada más en el
código debe importar `posthog-js` o `posthog-node` directamente.

## Reglas

- Nombres en `snake_case`, verbo en pasado (`booking_created`).
- Sin datos personales: nada de nombres, correos, teléfonos, documentos ni montos
  exactos. Los montos van en rangos (`amount_bucket` / `total_bucket`:
  `<200k`, `200k-500k`, `500k-1M`, `1M-2M`, `2M+`) y las personas en rangos
  (`1-5`, `6-10`, `11-20`, `21+`).
- Eventos de negocio desde el servidor (no se pierden por bloqueadores ni pestañas
  cerradas). En el frontend solo lo que no pasa por el servidor.
- Los tokens de las URLs (`#/contract/<token>`, `?token=`) se reemplazan por
  `:token` antes de enviar.

## Entornos

| Dónde | Envía |
|---|---|
| Frontend | Solo build de producción servido desde `VITE_POSTHOG_HOSTS` (por defecto `cabania.app`, `cabania.info` y sus subdominios) y con `VITE_POSTHOG_KEY` definida. |
| Servidor | Solo con `POSTHOG_KEY` y en producción (`NODE_ENV=production` o `RAILWAY_ENVIRONMENT_NAME=production`). |

Todos los eventos llevan `app_env` (`production` / `preview` / `development`).
Las sesiones de superadministrador llevan `is_internal: true` y las de la cuenta
demo `is_demo: true` (también como propiedad del grupo `organization`).

## Identidad

- `identify(user.id)` tras cargar el usuario, con `role`, `is_super_admin`,
  `is_demo`, `plan_type` y `created_at`. No se identifica durante una
  impersonación.
- `group('organization', org.id)` con `name`, `plan_type`, `subscription_active`,
  `is_trial`, `venues_count`, `is_demo` (no para superadministradores).
- `reset()` al cerrar sesión. Páginas públicas: anónimas
  (`person_profiles: 'identified_only'`).
- Servidor: `distinct_id` = id del usuario; sin usuario (chats de IA, contrato
  público) = `venue:<id>` sin perfil de persona. Siempre con
  `$groups.organization` cuando se conoce.

## Eventos del frontend

| Evento | Dónde | Propiedades |
|---|---|---|
| `$pageview` | `router.afterEach` | `route_name`, `route_pattern` (p. ej. `/business/accommodations/:id`), `module` |
| `signup_started` | Onboarding con invitación válida | `via` |
| `availability_searched` | Buscador de disponibilidad | `stay_type`, `adults`, `children`, `amenities_count`, `results_count` |
| `contract_opened` | Contrato público (primera carga) | `kind` (contract/amendment), `status` |
| `contract_sign_started` | Abre el modal de firma | `kind` |
| `contract_photo_taken` | Selfie o documento | `target` (selfie/document), `source` (camera/file) |
| `contract_sign_submitted` | Firma enviada con éxito | `kind` |
| `$exception` | SDK + `app.config.errorHandler` de Vue | `route_pattern`, `module`, `vue_info` |

`module` sale de `MODULE_PREFIXES` en `src/lib/analytics.js`; al agregar una
sección nueva, agrégala ahí.

## Eventos del servidor

| Evento | Dónde | Propiedades |
|---|---|---|
| `signup_completed` | Aceptar invitación (único punto que crea cuentas) | `source`, `is_partner`, `profile_code` |
| `onboarding_step_completed` | `PUT /api/onboarding/step` | `step` |
| `onboarding_completed` | `POST /api/onboarding/complete` | |
| `venue_created` | `POST /api/venues` | `source` |
| `booking_created` | Formulario, conversión de cotización, pago Bold de cotización, herramientas de agente | `source` (direct/reseller/quote/quote_paid/api/assistant), `plan_type`, `adults_bucket`, `total_bucket`, `has_agent` |
| `payment_recorded` | `POST /api/payments`, pagos Bold | `method`, `type`, `amount_bucket`, `has_receipt` (Bold: `bold_method`, `automatic`) |
| `quote_created` | Formulario, herramientas de agente, chat IA | `source` (form/api/assistant/ai_chat), `channel`, `total_bucket`, `from_agent` |
| `ai_quote_generated` | Cotización creada por la IA del chat | igual que `quote_created` |
| `quote_converted` | Convertir cotización | `channel`, `from_chat`, `has_agent` |
| `contract_sent` | Contrato creado (manual o tras pago Bold), borrador de otrosí | `kind`, `source`, `number`, `changed_fields` |
| `contract_signed` | Firma pública | `kind`, `with_photo` / `number` |
| `expense_created` | `POST /api/expenses` | `category_id`, `amount_bucket`, `linked_to_booking`, `has_receipt` |
| `commission_paid` | Comisión creada o marcada como pagada | `amount_bucket`, `with_expense` |
| `inventory_item_updated` | Crear/editar artículo, movimiento | `action`, `item_type`, `movement_type` |
| `maintenance_log_created` | `POST /api/maintenance-logs` | `priority`, `has_cost`, `has_zone` |
| `ai_conversation_started` | Chat nuevo (WhatsApp Cloud/Baileys, Instagram, web) | `channel`, `source` |
| `ai_handoff_to_human` | Escalamiento a humano | `channel`, `reason` (human_reply/client_requested/ai_decided/message_limit) |
| `$exception` | Middleware de errores de Express, `uncaughtException` | `path`, `method` |

## Privacidad en grabaciones y autocaptura

- `maskAllInputs`, texto de `td`, `.ph-mask`, `[data-ph-mask]` y `.ph-no-capture`
  enmascarado, y todos los dígitos del texto se reemplazan por `•`.
- La grabación se detiene en `/contract/*`.
- `.ph-no-capture` además excluye el elemento de la autocaptura. Úsalo en
  cualquier bloque nuevo que muestre nombres, teléfonos, documentos o montos.
  Los clics dentro de esos bloques no se registran: si importan, agrega un
  evento explícito.

## Errores y source maps

- Frontend: `capture_exceptions` del SDK + `app.config.errorHandler`. Un chunk
  viejo tras un deploy (`vite:preloadError`, import dinámico fallido) recarga la
  página una sola vez.
- El servidor responde 404 (no `index.html`) a archivos inexistentes y a `*.map`;
  `index.html` va con `no-cache`.
- Source maps: si el build tiene `POSTHOG_CLI_TOKEN` y `POSTHOG_CLI_ENV_ID`,
  `scripts/sourcemaps.mjs` los sube a PostHog y luego los borra de `dist`.

## Probar en local sin tocar producción

1. Crea un proyecto de PostHog de pruebas y usa su clave.
2. En `.env` de la raíz: `VITE_POSTHOG_KEY=<clave de pruebas>` y
   `VITE_POSTHOG_DEBUG=true`. Con `npm run dev` el SDK imprime cada evento en la
   consola del navegador (`[PostHog.js]`).
3. Servidor: `POSTHOG_DEBUG=1 POSTHOG_FORCE=1 POSTHOG_KEY=<clave de pruebas>` imprime
   cada evento en la terminal. Solo con `POSTHOG_DEBUG=1` (sin `FORCE`) no envía
   nada.
4. En PostHog → Activity, filtra por `app_env = development`.
