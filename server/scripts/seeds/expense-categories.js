const data = [
  { name: 'Arreglos', description: 'Reparaciones y arreglos generales', icon: 'cilCog', color: '#4f5d73', is_system: true, is_active: true },
  { name: 'Construcción', description: 'Gastos de construcción y obras', icon: 'cilBuilding', color: '#321fdb', is_system: true, is_active: true },
  { name: 'Impuestos', description: 'Pago de impuestos y contribuciones', icon: 'cilFile', color: '#e55353', is_system: true, is_active: true },
  { name: 'Insumos', description: 'Compra de materiales y suministros', icon: 'cilCart', color: '#2eb85c', is_system: true, is_active: true },
  { name: 'Jardinería', description: 'Gastos de jardinería y áreas verdes', icon: 'cilFlower', color: '#6610f2', is_system: true, is_active: true },
  { name: 'Limpieza', description: 'Servicios y productos de limpieza', icon: 'cilBrush', color: '#f9b115', is_system: true, is_active: true },
  { name: 'Mantenimiento', description: 'Mantenimiento preventivo y correctivo', icon: 'cilSettings', color: '#3399ff', is_system: true, is_active: true },
  { name: 'Nómina', description: 'Pago de salarios y prestaciones al personal', icon: 'cilPeople', color: '#9da5b1', is_system: true, is_active: true },
  { name: 'Otros', description: 'Otros gastos no categorizados', icon: 'cilOptions', color: '#e83e8c', is_system: true, is_active: true },
  { name: 'Seguridad', description: 'Gastos de seguridad y vigilancia', icon: 'cilShieldAlt', color: '#20c997', is_system: true, is_active: true },
  { name: 'Servicios', description: 'Pagos de servicios públicos (agua, luz, gas, internet)', icon: 'cilLightbulb', color: '#ebedef', is_system: true, is_active: true },
  { name: 'Transporte', description: 'Gastos de transporte como gasolina, peajes y demas viaticos', icon: 'cilCarAlt', color: '#fd7e14', is_system: true, is_active: true },
];

async function seed(prisma) {
  const count = await prisma.expense_categories.count();
  if (count > 0) {
    console.log(`  expense_categories: ya tiene ${count} registros, omitido`);
    return;
  }
  await prisma.expense_categories.createMany({ data });
  console.log(`  expense_categories: ${data.length} registros creados`);
}

module.exports = seed;
