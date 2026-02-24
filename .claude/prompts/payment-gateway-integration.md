# Integración de Pasarela de Pagos — Investigación y Decisión

> Fecha: 2026-02-23
> Estado: Pendiente de decisión
> Contexto: Cabanero necesita cobrar reservas online y distribuir el dinero entre Cabanero (comisión) y los parceleros (venue owners)

## Modelo de negocio

```
Cliente paga reserva → Pasarela → Cabanero retiene comisión → Parcelero recibe el resto
```

**Requisito clave**: Cabanero NUNCA debe manejar datos de tarjeta (evitar PCI DSS SAQ-D).

---

## Bold.co — Evaluación

### Lo que ofrece
- API de Link de Pagos (crear links programáticamente)
- Botón de Pagos (checkout hosted)
- API de Pagos en Línea (integración directa — requiere PCI DSS SAQ-D)
- Webhooks de notificación
- Consulta de transacciones

### Lo que NO ofrece
- **NO tiene split payments / marketplace**
- **NO tiene payouts / dispersiones a terceros**
- **NO tiene registro de sub-merchants**
- Su "Cobro Dividido" es para dividir cuenta entre clientes (como restaurante), NO entre comercios

### T&C del API de Pagos en Línea (v1.1.1, vigente 28 nov 2025)

**Fuente**: https://bold.co/legal/api-pagos-en-linea

#### Resumen ejecutivo
- Si usas la API directa, tú capturas datos de tarjeta → **PCI DSS SAQ-D obligatorio** (~300 controles)
- Si usas Link de Pago o Botón de Pagos, Bold captura los datos → **SAQ-A** (muy liviano)
- Bold actúa como intermediario entre Comercio, Adquirentes y Franquicias
- Bold debita comisiones directamente del Saldo de Ventas
- Bold puede hacer auditorías sin previo aviso a tus sistemas
- Incidentes de seguridad: notificar a Bold en máx 24 horas
- Bold puede cambiar tarifas con 7 días de anticipación
- Cláusula de indemnidad agresiva: Bold puede intervenir y representarte en reclamos
- API se provee "as-is" sin garantía de disponibilidad
- Confidencialidad vigente 5 años post-terminación
- Obligación de incluir en T&C de Cabanero cláusulas que eximan a Bold

#### Conclusión sobre Bold
**No sirve como pasarela única para el modelo marketplace de Cabanero.** Podría servir solo para el cobro, pero la distribución a parceleros tendría que hacerse manualmente o con otra herramienta.

---

## Alternativas evaluadas

### 1. Mercado Pago — Split de Pagos (RECOMENDADA)

**Disponibilidad**: Colombia
**Modelo**: Marketplace nativo con split automático

#### Cómo funciona
- La plataforma (Cabanero) cobra el pago completo
- Automáticamente se divide entre marketplace y vendedores
- Comisión de Mercado Pago se descuenta del vendedor
- Comisión del marketplace se descuenta del saldo restante
- Vendedor no necesita hacer nada — es transparente

#### Modelos de split
- **Split 1:1** — Un pago → plataforma + un vendedor (disponible para todos)
- **Split 1:N** — Un pago → plataforma + múltiples vendedores (requiere "cartera asesorada", contactar equipo comercial)

#### Integración técnica
- **Checkout Pro**: parámetro `marketplace_fee` en `/checkout/preferences`
- **Checkout API**: parámetro `application_fee` en `/payments`
- Autenticación OAuth para vincular cada vendedor (parcelero)
- SDKs disponibles para Node.js

#### Requisitos
- Cuenta Mercado Pago con KYC nivel 6
- App de Mercado Pago instalada
- Credenciales API del panel de desarrollador
- Cuentas de prueba para validación
- Cada parcelero necesita cuenta Mercado Pago vinculada vía OAuth

#### Comisiones en Colombia
| Plazo | Comisión |
|-------|----------|
| Inmediato | 3.29% + $800 COP + IVA |
| 14 días | 2.79% + $800 COP + IVA |

#### Medios de pago
- Tarjetas de crédito y débito
- PSE (transferencia bancaria)
- Nequi
- Efectivo (Efecty, Baloto)

#### Documentación
- Split de Pagos: https://www.mercadopago.com.co/developers/es/docs/split-payments/landing
- Requisitos: https://www.mercadopago.com.co/developers/es/docs/split-payments/prerequisites

#### Pros
- Split automático al momento del pago — no hay intermediación manual
- Elimina riesgo regulatorio de captación de dinero de terceros
- Checkout hosted — Cabanero nunca toca datos de tarjeta (SAQ-A)
- Amplia penetración en Colombia
- SDK Node.js oficial
- El modelo 1:1 (una reserva = un venue) funciona sin restricciones

#### Contras
- Cada parcelero necesita cuenta Mercado Pago
- Split 1:N requiere contacto comercial
- UX del checkout puede no ser tan personalizable como API directa

---

### 2. ePayco (Davivienda) — Pagos Divididos

**Disponibilidad**: Colombia
**Modelo**: Marketplace con split one-to-one y one-to-many

#### Cómo funciona
- Comercio principal recibe el pago
- Se divide automáticamente según reglas configuradas
- Cada receptor recibe su parte directamente

#### Parámetros API para split
```json
{
  "splitpayment": true,
  "split_app_id": "ID de la app",
  "split_merchant_id": "ID del comercio",
  "split_type": "tipo de split",
  "split_primary_receiver": "receptor principal",
  "split_primary_receiver_fee": "comisión del receptor principal",
  "split_rule": "regla de división",
  "split_receivers": [
    { "id": "...", "total": "...", "iva": "...", "base_iva": "...", "fee": "..." }
  ]
}
```

#### Requisitos
- Cuenta ePayco en modelo agregador
- Activación del servicio vía ticket de soporte
- Registro de receptores/merchants desde el panel de ePayco
- SDK Node.js: `epayco-node` (GitHub: epayco/epayco-node)

#### Documentación
- Descripción: https://epayco.com/pagos-divididos/
- Docs técnicos: https://docs.epayco.com/docs/split-descripcion

#### Pros
- Respaldado por Davivienda (banco colombiano grande)
- Modelo one-to-many para marketplace
- SDK Node.js oficial
- Soporta medios de pago locales

#### Contras
- Requiere activación manual vía soporte (modelo agregador)
- Documentación menos clara que Mercado Pago
- Menos adopción que Mercado Pago entre usuarios finales

---

### 3. Opción híbrida: Bold (cobro) + Wompi (dispersión)

**Modelo**: Cobrar con Bold, dispersar con Wompi

#### Flujo
1. Cliente paga vía Bold (Link de Pago o Botón)
2. Dinero llega a cuenta Bold de Cabanero
3. Cabanero transfiere a su cuenta bancaria
4. Cabanero usa API de Wompi para dispersar a parceleros

#### API de Pagos a Terceros de Wompi
- Dispersiones individuales o en lotes (batch)
- Pagos inmediatos, programados y recurrentes
- Endpoints: `POST /payouts` y `POST /payouts/file`
- Límite diario: $1.5 billones COP
- Límite de lotes diarios: 3,800

#### Documentación Wompi
- https://docs.wompi.co/en/docs/colombia/introduccion-pagos-a-terceros/

#### Pros
- Mantiene Bold como frontend de pagos (si ya hay integración)
- Wompi es de Bancolombia, muy confiable

#### Contras
- **Mayor complejidad operativa** (dos pasarelas, flujo manual)
- **Riesgo regulatorio**: el dinero pasa por la cuenta de Cabanero primero
- **Fiscal**: Cabanero factura 100% y luego paga al parcelero (IVA, retención)
- Latencia: el parcelero no recibe inmediatamente
- Dos sets de comisiones (Bold + Wompi)

---

### 4. PayU Latam — Solo Payouts

**NO tiene split payments para Colombia.** Solo ofrece Payouts (dispersiones post-transacción).

- Dispersiones ACH en lotes
- Requiere solicitud especial y firma de anexo al contrato
- Similar a la opción híbrida pero con más restricciones

#### Documentación
- https://developers.payulatam.com/latam/en/docs/services/payouts.html

---

### 5. Stripe Connect — Marketplace completo

**Disponibilidad**: Colombia (desde ~2024, con limitaciones)

#### Lo que ofrece
- Separate Charges and Transfers
- Application Fees (retener comisión automáticamente)
- Onboarding KYC integrado para sub-merchants
- Dashboard completo para cada vendedor

#### Limitaciones en Colombia
- Métodos de pago locales MUY limitados (PSE, Nequi probablemente no disponibles)
- Liquidación posiblemente en USD/EUR, no COP
- Tarifas más altas que pasarelas locales
- Standard y Express connected accounts; Custom puede no estar disponible

#### Documentación
- https://docs.stripe.com/connect

#### Pros
- La solución técnicamente más robusta
- Documentación excelente
- SDK Node.js de primera clase

#### Contras
- **Medios de pago locales colombianos muy limitados** (deal breaker para Colombia)
- Tarifas más altas
- Mejor para expansión internacional, no para mercado local

---

## Tabla comparativa

| Criterio | Mercado Pago | ePayco | Bold + Wompi | Stripe |
|----------|:---:|:---:|:---:|:---:|
| Split automático | Si | Si | No (manual) | Si |
| PSE | Si | Si | Si | No |
| Nequi | Si | Si | Si | No |
| Tarjetas | Si | Si | Si | Si |
| Efectivo | Si | Si | Si | No |
| SDK Node.js | Si | Si | Si + Si | Si |
| Complejidad | Media | Media | Alta | Media-Alta |
| Riesgo regulatorio | Bajo | Bajo | Alto | Bajo |
| Carga fiscal | Baja | Baja | Alta | Baja |
| Adopción CO | Alta | Media | Alta | Baja |

---

## Recomendación

### Primera opción: Mercado Pago Split de Pagos
1. Split nativo — el dinero se divide automáticamente
2. Cabanero nunca toca datos de tarjeta (SAQ-A)
3. No hay riesgo de intermediación financiera
4. Cada parcelero recibe directo en su cuenta
5. Soporta todos los medios de pago colombianos
6. Modelo 1:1 disponible sin restricciones (perfecto para reservas)

### Segunda opción: ePayco Pagos Divididos
- Mismas ventajas pero menos adopción entre usuarios finales
- Respaldo de Davivienda

### NO recomendado para Cabanero
- **Bold solo**: no tiene split, tendríamos que ser intermediarios financieros
- **Stripe**: métodos de pago locales muy limitados
- **Opción híbrida**: demasiada complejidad y riesgo regulatorio/fiscal

---

## Próximos pasos (cuando se retome)

1. **Decidir** entre Mercado Pago y ePayco
2. **Crear cuenta de desarrollador** en la pasarela elegida
3. **Diseñar el flujo** de onboarding de parceleros (vincular cuenta de pago)
4. **Implementar** checkout en el booking widget público
5. **Implementar** webhooks para confirmar pagos y actualizar reservas
6. **Probar** en sandbox con cuentas de prueba
7. **Definir** estructura de comisiones de Cabanero
8. **Revisar** implicaciones fiscales con contador (facturación, IVA, retención)
