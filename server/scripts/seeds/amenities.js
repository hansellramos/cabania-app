const data = [
  { name: 'Cascada', description: 'Cascada decorativa o natural', icon: 'cil-drop', category: 'Acuático', is_active: true },
  { name: 'Chorros', description: 'Chorros de agua', icon: 'cil-drop', category: 'Acuático', is_active: true },
  { name: 'Cancha de Baloncesto', description: 'Cancha para práctica de baloncesto', icon: 'cil-basketball', category: 'Canchas', is_active: true },
  { name: 'Cancha de Fútbol', description: 'Cancha para práctica de fútbol', icon: 'cil-futbol', category: 'Canchas', is_active: true },
  { name: 'Cancha de Voleibol', description: 'Cancha para práctica de voleibol', icon: 'cil-volleyball', category: 'Canchas', is_active: true },
  { name: 'Plancha Grande', description: 'Plancha de cocina grande', icon: 'cil-fastfood', category: 'Cocina', is_active: true },
  { name: 'Plancha Mediana', description: 'Plancha de cocina mediana', icon: 'cil-fastfood', category: 'Cocina', is_active: true },
  { name: 'Plancha Pequeña', description: 'Plancha de cocina pequeña', icon: 'cil-fastfood', category: 'Cocina', is_active: true },
  { name: 'Zonas Verdes', description: 'Áreas verdes y jardines', icon: 'cil-leaf', category: 'Exteriores', is_active: true },
  { name: 'Kiosco Extragrande (+100 pax)', description: 'Capacidad para más de 100 personas', icon: 'cil-home', category: 'Kiosco', is_active: true },
  { name: 'Kiosco Familiar (hasta 30 pax)', description: 'Capacidad hasta 30 personas', icon: 'cil-home', category: 'Kiosco', is_active: true },
  { name: 'Kiosco Grande (hasta 100 pax)', description: 'Capacidad hasta 100 personas', icon: 'cil-home', category: 'Kiosco', is_active: true },
  { name: 'Kiosco Mediano (hasta 50 pax)', description: 'Capacidad hasta 50 personas', icon: 'cil-home', category: 'Kiosco', is_active: true },
  { name: 'Kiosco Pequeño (menos de 30 pax)', description: 'Capacidad menor a 30 personas', icon: 'cil-home', category: 'Kiosco', is_active: true },
  { name: 'Parqueadero Al Aire Libre', description: 'Estacionamiento descubierto', icon: 'cil-garage', category: 'Parqueadero', is_active: true },
  { name: 'Parqueadero Cubierto', description: 'Estacionamiento techado', icon: 'cil-garage', category: 'Parqueadero', is_active: true },
  { name: 'Parrilla BBQ Grande', description: 'Parrilla de tamaño grande', icon: 'cil-fire', category: 'Parrilla BBQ', is_active: true },
  { name: 'Parrilla BBQ Mediana', description: 'Parrilla de tamaño mediano', icon: 'cil-fire', category: 'Parrilla BBQ', is_active: true },
  { name: 'Parrilla BBQ Pequeña', description: 'Parrilla de tamaño pequeño', icon: 'cil-fire', category: 'Parrilla BBQ', is_active: true },
  { name: 'Parrilla BBQ a Carbón', description: 'Parrilla de barbacoa a carbón', icon: 'cil-fire', category: 'Parrilla BBQ', is_active: true },
  { name: 'Parrilla BBQ a Gas', description: 'Parrilla de barbacoa a gas', icon: 'cil-fire', category: 'Parrilla BBQ', is_active: true },
  { name: 'Piscina Extragrande (+100 pax)', description: 'Capacidad para más de 100 personas', icon: 'cil-drop', category: 'Piscina', is_active: true },
  { name: 'Piscina Familiar (hasta 30 pax)', description: 'Capacidad hasta 30 personas', icon: 'cil-drop', category: 'Piscina', is_active: true },
  { name: 'Piscina Grande (hasta 100 pax)', description: 'Capacidad hasta 100 personas', icon: 'cil-drop', category: 'Piscina', is_active: true },
  { name: 'Piscina Mediana (hasta 50 pax)', description: 'Capacidad hasta 50 personas', icon: 'cil-drop', category: 'Piscina', is_active: true },
  { name: 'Piscina Pequeña (menos de 30 pax)', description: 'Capacidad menor a 30 personas', icon: 'cil-drop', category: 'Piscina', is_active: true },
  { name: 'Arenero', description: 'Área de arena para juegos', icon: 'cil-child', category: 'Recreación', is_active: true },
  { name: 'Parque Infantil', description: 'Área de juegos para niños', icon: 'cil-child', category: 'Recreación', is_active: true },
  { name: 'Salón Extragrande (+100 pax)', description: 'Capacidad para más de 100 personas', icon: 'cil-building', category: 'Salón de Eventos', is_active: true },
  { name: 'Salón Familiar (hasta 30 pax)', description: 'Capacidad hasta 30 personas', icon: 'cil-building', category: 'Salón de Eventos', is_active: true },
  { name: 'Salón Grande (hasta 100 pax)', description: 'Capacidad hasta 100 personas', icon: 'cil-building', category: 'Salón de Eventos', is_active: true },
  { name: 'Salón Mediano (hasta 50 pax)', description: 'Capacidad hasta 50 personas', icon: 'cil-building', category: 'Salón de Eventos', is_active: true },
  { name: 'Salón Pequeño (menos de 30 pax)', description: 'Capacidad menor a 30 personas', icon: 'cil-building', category: 'Salón de Eventos', is_active: true },
  { name: 'Salón de Eventos Al Aire Libre', description: 'Salón sin techo para eventos', icon: 'cil-building', category: 'Salón de Eventos', is_active: true },
  { name: 'Salón de Eventos Climatizado', description: 'Salón con aire acondicionado', icon: 'cil-building', category: 'Salón de Eventos', is_active: true },
  { name: 'Salón de Eventos Cubierto', description: 'Salón con techo para eventos', icon: 'cil-building', category: 'Salón de Eventos', is_active: true },
  { name: 'Caldero Grande', description: 'Caldero de cocina grande', icon: 'cil-dinner', category: 'Utensilios de Cocina', is_active: true },
  { name: 'Caldero Mediano', description: 'Caldero de cocina mediano', icon: 'cil-dinner', category: 'Utensilios de Cocina', is_active: true },
  { name: 'Caldero Pequeño', description: 'Caldero de cocina pequeño', icon: 'cil-dinner', category: 'Utensilios de Cocina', is_active: true },
  { name: 'Cubiertos', description: 'Set de cubiertos', icon: 'cil-dinner', category: 'Utensilios de Cocina', is_active: true },
  { name: 'Cuchillos', description: 'Set de cuchillos de cocina', icon: 'cil-dinner', category: 'Utensilios de Cocina', is_active: true },
  { name: 'Olla a Presión', description: 'Olla de presión', icon: 'cil-dinner', category: 'Utensilios de Cocina', is_active: true },
  { name: 'Olla de Sancocho Grande', description: 'Olla grande para sancocho', icon: 'cil-dinner', category: 'Utensilios de Cocina', is_active: true },
  { name: 'Olla de Sancocho Mediana', description: 'Olla mediana para sancocho', icon: 'cil-dinner', category: 'Utensilios de Cocina', is_active: true },
  { name: 'Olla de Sancocho Pequeña', description: 'Olla pequeña para sancocho', icon: 'cil-dinner', category: 'Utensilios de Cocina', is_active: true },
  { name: 'Platos', description: 'Juego de platos', icon: 'cil-dinner', category: 'Utensilios de Cocina', is_active: true },
  { name: 'Tabla de Picar', description: 'Tabla para cortar alimentos', icon: 'cil-dinner', category: 'Utensilios de Cocina', is_active: true },
  { name: 'Vasos', description: 'Juego de vasos', icon: 'cil-dinner', category: 'Utensilios de Cocina', is_active: true },
];

async function seed(prisma) {
  const count = await prisma.amenities.count();
  if (count > 0) {
    console.log(`  amenities: ya tiene ${count} registros, omitido`);
    return;
  }
  await prisma.amenities.createMany({ data });
  console.log(`  amenities: ${data.length} registros creados`);
}

module.exports = seed;
