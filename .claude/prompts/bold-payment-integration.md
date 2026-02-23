# Integración de Pasarela de Pagos Bold

## Contexto del Proyecto

Cabanero es una app de gestión de hospedajes/cabañas en Colombia. Stack:
- **Frontend**: Vue 3 + CoreUI + Vite, SPA con hash router
- **Backend**: Express.js (CJS) en `server/`, Prisma ORM
- **Database**: Neon Postgres (remoto)
- **Deployment**: Vercel (frontend estático + backend como Serverless Function)
- **Dominio**: `cabaneroco.vercel.app`

### Flujo actual de pagos
- Los clientes pagan manualmente por **Nequi** o transferencia bancaria
- El administrador registra los pagos manualmente en la app (monto, método, referencia, comprobante)
- Los pagos se almacenan en la tabla `payments` vinculados a `accommodations`
- La comunicación con clientes es por **WhatsApp** (ya hay botones de WhatsApp en la app)

### Archivos clave
- `server/index.js` — Todos los endpoints de la API (Express)
- `server/prisma/schema.prisma` — Esquema de base de datos
- `src/views/accommodations/AccommodationDetailView.vue` — Detalle del hospedaje (muestra pagos, depósitos, etc.)
- `src/views/payments/PaymentFormView.vue` — Formulario de registro de pagos
- `src/components/accommodations/AccommodationForm.vue` — Formulario de hospedaje

## Sobre Bold (Pasarela de Pagos Colombia)

Bold es una pasarela de pagos colombiana. Documentación: https://developers.bold.co/pagos-en-linea/api-integration

### API Bold - Resumen

**Base URL**: `https://integrations.api.bold.co`
**Auth**: Header `Authorization: x-api-key <API_KEY>`

#### Endpoints:

1. **GET** `/online/link/v1/payment_methods` — Consultar métodos habilitados (CREDIT_CARD, PSE, NEQUI, BOTON_BANCOLOMBIA)

2. **POST** `/online/link/v1` — Crear link de pago
   - `amount_type`: "CLOSE" (monto fijo) o "OPEN" (monto libre)
   - `amount`: { currency: "COP", total_amount, taxes, tip_amount }
   - `reference`: ID único (alfanumérico, max 60 chars)
   - `description`: Descripción (2-100 chars)
   - `expiration_date`: Timestamp en nanosegundos Unix
   - `callback_url`: URL HTTPS de redirección post-pago
   - `payment_methods`: Array de métodos aceptados
   - `payer_email`: Email del cliente
   - Respuesta: `{ payload: { payment_link: "LNK_xxx", url: "https://checkout.bold.co/LNK_xxx" }, errors: [] }`

3. **GET** `/online/link/v1/{payment_link}` — Consultar estado
   - Estados: ACTIVE, PROCESSING, PAID, REJECTED, CANCELLED, EXPIRED
   - Incluye: transaction_id, total, payment_method, reference, is_sandbox

#### Webhooks:
- Bold notifica cambios de estado a un webhook configurado en el panel del comercio
- Investigar la documentación de webhooks en: https://developers.bold.co

### Consideraciones
- Bold requiere `callback_url` con HTTPS (Vercel lo cumple)
- Tiene ambiente sandbox para pruebas
- Después de integrar, Bold pide certificación

## Tarea

### Fase 1: Investigación (NO escribir código aún)

1. **Leer la documentación completa de Bold** via web:
   - https://developers.bold.co/pagos-en-linea/api-integration
   - https://developers.bold.co/pagos-en-linea/api-link-de-pagos
   - https://developers.bold.co/pagos-en-linea/boton-de-pagos/ambiente-pruebas
   - Buscar documentación de **webhooks** (payload, verificación de firma, etc.)
   - Buscar documentación del **botón de pagos** (puede ser alternativa más simple al API)

2. **Leer el código actual** para entender la estructura de pagos:
   - Modelo `payments` en `server/prisma/schema.prisma`
   - Endpoints de payments en `server/index.js` (buscar `/api/payments`)
   - `AccommodationDetailView.vue` — sección de pagos
   - `PaymentFormView.vue` — formulario actual

3. **Definir el flujo propuesto**:
   - ¿Link de pago o botón de pagos embebido?
   - ¿Cómo manejar pagos parciales? (el cliente puede abonar, no siempre paga el total)
   - ¿Webhook o polling para confirmar pago?
   - ¿Cómo vincular el pago Bold con el registro en la tabla `payments`?

### Fase 2: Plan de implementación

Crear un plan detallado que incluya:

1. **Cambios en base de datos**:
   - Campos nuevos en `payments` (payment_link_id, transaction_id, bold_status, etc.)
   - O tabla nueva para transacciones Bold

2. **Endpoints backend nuevos**:
   - Crear link de pago Bold
   - Webhook receiver para notificaciones de Bold
   - Consultar estado de pago Bold

3. **Cambios frontend**:
   - Botón "Enviar link de pago" en detalle del hospedaje
   - Mostrar estado del pago Bold
   - Página de callback post-pago (¿o redirigir al detalle?)

4. **Configuración**:
   - Variables de entorno necesarias (BOLD_API_KEY, BOLD_SECRET_KEY, etc.)
   - Configuración de webhook en Bold

5. **Testing**:
   - Usar sandbox de Bold
   - Probar flujo completo: crear link → pagar → webhook → verificar en app

### Fase 3: Implementación

Implementar según el plan aprobado. Seguir las convenciones del proyecto:
- Backend en CJS (require/module.exports)
- Frontend en Vue 3 Composition API con `<script setup>`
- CoreUI para componentes UI
- Prisma para queries de DB
- Variables de entorno en Vercel

## Variables de entorno a agregar en Vercel
```
BOLD_API_KEY=<api_key_de_bold>
BOLD_WEBHOOK_SECRET=<si_aplica>
BOLD_SANDBOX=true  # cambiar a false en producción
```

## Notas importantes
- La app ya maneja pagos manuales. Bold NO reemplaza esto — es una opción adicional
- Los clientes actuales pagan por Nequi/transferencia. Bold permitiría pagar por link
- El link de pago se puede enviar por WhatsApp (flujo natural para los usuarios)
- Considerar que Bold cobra comisión por transacción — investigar tarifas
- El `reference` del link Bold debe ser trazable al payment/accommodation en Cabanero
