const sections = [
  {
    title: 'Pagos y Cancelación',
    sort_order: 1,
    content: `1. No se hace devolución de dinero. La reserva queda asegurada para otra fecha, la cual debe ser ajustada con el titular de la propiedad. *Para que este cambio de fecha sea efectivo, debemos primero encontrar un cliente para la fecha original. De no encontrarse, se penaliza con el total de la reserva.*
2. El saldo restante se cancela más tardar en la mañana del día a disfrutar.
3. Si se disminuye la cantidad de personas, se mantiene el valor pactado en la reserva.
4. Las personas adicionales tienen costos que deben ser definidos previamente entre las partes.`,
  },
  {
    title: 'Depósito de Garantía',
    sort_order: 2,
    content: `Se debe entregar un depósito de **{{deposit_amount}}** que cubre daños dentro del lugar. Este es totalmente reembolsable siempre y cuando no ocurran daños por parte de los visitantes.

*Este depósito debe entregarse más tardar al ingresar a la propiedad, vía transferencia al medio de pago del lugar.*

Su devolución se realiza entre 12 a 24 horas de la salida del lugar. Si hubiese algún descuento, se envía factura de lo reemplazado.

**Descuentos automáticos del depósito:**
- Suciedad excesiva al salir: $50.000
- Exceder horario: $100.000 por hora/fracción`,
  },
  {
    title: 'Registro de Asistentes',
    sort_order: 3,
    content: `Se recomienda enviar listado de las personas que van a disfrutar en el lugar (NOMBRE y # de IDENTIFICACIÓN) más tardar la mañana del día a disfrutar.

**Si no se envía listado:** el titular de la reserva (**{{customer_name}}**, CC **{{customer_id}}**) queda como único responsable de cualquier daño o evento que ocurra durante el hospedaje.`,
  },
  {
    title: 'Horarios',
    sort_order: 4,
    content: `- **Check In:** {{check_in}}
- **Check Out:** {{check_out}}

El horario acordado debe respetarse. Si se desea ampliar, debe ser acordado previamente. **De no respetarse, se descontará $100.000 del depósito por cada hora/fracción.**`,
  },
  {
    title: 'Limpieza y Daños',
    sort_order: 5,
    content: `1. La administración entrega el lugar completamente limpio; el huésped debe devolverlo en las mismas condiciones.
2. Entregar la cocina y sus utensilios en las mismas condiciones que los recibió.
3. Verificar el estado de los muebles al llegar y notificar cualquier hallazgo al administrador. Los daños a cualquier mueble o infraestructura deberán ser cubiertos.
4. Se recomienda cuidado con las plantas; su daño debe ser cubierto.
5. Deposite la basura en las bolsas y canecas dispuestas.`,
  },
  {
    title: 'Uso de Instalaciones',
    sort_order: 6,
    content: `1. **Piscina:** No ingerir alimentos ni bebidas dentro de la piscina. Ducharse antes de ingresar. Utilizar ropa de baño.
2. No acostarse en hamacas ni camas estando mojados.
3. No encender equipos como motobombas de piscina o mangueras — esto es responsabilidad del encargado del lugar.
4. No llevar envases de vidrio (cervezas en lata). Si va a ingerir whisky, hacerlo lejos de la piscina.
5. Para sancochos o asados, llevar carbón o comprar leña en la propiedad. No se puede realizar sancochos en la estufa.
6. Las habitaciones se habilitan según la cantidad de personas.`,
  },
  {
    title: 'Mascotas',
    sort_order: 7,
    content: `Si lleva mascotas:
1. No pueden acostarse en camas, sofá camas o hamacas.
2. No ingresarlas a la piscina.
3. Sus heces deben ser recogidas antes de irse.
4. Si orina en zonas pavimentadas (kiosco, cocina, corredor, habitaciones, área de lavado), deben ser limpiadas.
5. Cualquier daño causado por mascotas será descontado del depósito.`,
  },
  {
    title: 'Fuerza Mayor',
    sort_order: 8,
    content: `En caso de lluvias, tormentas, fallas del servicio público de energía o situaciones climáticas adversas, **no se realizarán reembolsos ni compensaciones**, por tratarse de factores ajenos a nuestra operación.`,
  },
];

async function seed(prisma) {
  // Find all venues that don't have a default template
  const venues = await prisma.venues.findMany({ select: { id: true, name: true } });

  let created = 0;
  for (const venue of venues) {
    const existing = await prisma.contract_templates.findFirst({
      where: { venue_id: venue.id, is_default: true },
    });
    if (existing) continue;

    const template = await prisma.contract_templates.create({
      data: {
        venue_id: venue.id,
        name: 'Contrato Estándar',
        is_default: true,
        is_active: true,
      },
    });

    await prisma.contract_template_sections.createMany({
      data: sections.map(s => ({
        template_id: template.id,
        title: s.title,
        content: s.content,
        sort_order: s.sort_order,
      })),
    });

    created++;
  }

  console.log(`  contract-templates: ${created} venues con plantilla creada`);
}

module.exports = seed;
