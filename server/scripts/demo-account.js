/**
 * Cuenta de demostración: un usuario con su propia organización, tres cabañas y
 * un año de alquileres (pasados y próximos) con pagos, depósitos, gastos,
 * comisionista, contratos, cotizaciones, chats, tareas, mantenimiento e inventario.
 *
 * Uso (desde la raíz del repo; o `npm --prefix server run demo -- <comando>`):
 *   node server/scripts/demo-account.js create  [--email demo@cabania.app] [--password <clave>]
 *   node server/scripts/demo-account.js refresh [--email ...]  corre las fechas para que los datos sigan alrededor de hoy
 *   node server/scripts/demo-account.js reset   [--email ...]  borra los datos y los vuelve a crear (conserva usuario y clave)
 *   node server/scripts/demo-account.js delete  [--email ...]  elimina el usuario, su organización y todo lo creado
 *
 * Contra producción: DATABASE_URL="<url de prod>" node server/scripts/demo-account.js <comando>
 *
 * El usuario queda marcado en users.preferences.demo; refresh, reset y delete
 * solo actúan sobre un usuario con esa marca y una organización sin otros miembros.
 * Las cabañas no son públicas y tienen apagados los avisos y seguimientos, así
 * que la cuenta no le escribe a nadie.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { prisma } = require('../db');
const contractRenderer = require('../services/contractRenderer');
const { sections: CONTRACT_SECTIONS } = require('./seeds/contract-templates');

const DEFAULT_EMAIL = 'demo@cabania.app';
const ORG_NAME = 'Cabañas Demo';
const DAY = 86400000;
const TX = { timeout: 300000, maxWait: 20000 };

// ---------- dates (all booking dates are Colombia calendar days) ----------

const todayBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const addDays = (s, n) => new Date(Date.parse(`${s}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const dateOf = (s) => new Date(`${s}T00:00:00Z`);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
const weekday = (s) => dateOf(s).getUTCDay();
const at = (s, hhmm) => new Date(`${s}T${hhmm}:00-05:00`);
const timeOf = (hhmm) => new Date(`1970-01-01T${hhmm}:00Z`);
const ymd = (d) => new Date(d).toISOString().slice(0, 10);

// ---------- deterministic randomness, so reset rebuilds the same account ----------

function makeRandom(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (min, max) => min + Math.floor(next() * (max - min + 1));
  next.pick = (list) => list[Math.floor(next() * list.length)];
  next.chance = (p) => next() < p;
  next.weighted = (pairs) => {
    let r = next() * pairs.reduce((s, [, w]) => s + w, 0);
    for (const [value, w] of pairs) if ((r -= w) < 0) return value;
    return pairs[pairs.length - 1][0];
  };
  return next;
}

const roundTo = (n, step) => Math.round(n / step) * step;
const hhmm = (rand, from, to) => `${String(rand.int(from, to)).padStart(2, '0')}:${String(rand.pick([0, 10, 15, 25, 30, 40, 45, 55])).padStart(2, '0')}`;

// ---------- the account's content ----------

const VENUES = [
  {
    name: 'Cabaña El Roble', city: 'Guatapé', department: 'Antioquia', suburb: 'Vereda El Roble',
    address: 'Km 4 vía Guatapé - El Peñol', latitude: 6.2325, longitude: -75.1585, instagram: 'cabanaelroble.demo',
    deposit: 300000, weight: 1,
    info: 'Cabaña frente al embalse con piscina, kiosco con BBQ, zona de camping y muelle privado.',
    plans: [
      { name: 'Pasadía', plan_type: 'pasadia', adult: 60000, child: 40000, in: '09:00', out: '19:00', min: 8, max: 30,
        description: 'Día completo con piscina, kiosco, BBQ y muelle.' },
      { name: 'Pasanoche', plan_type: 'pasanoche', adult: 110000, child: 70000, in: '15:00', out: '12:00', min: 8, max: 20, overnight: true,
        description: 'Llegada en la tarde, noche en la cabaña y salida al mediodía.' }
    ]
  },
  {
    name: 'Finca La Esperanza', city: 'Santa Fe de Antioquia', department: 'Antioquia', suburb: 'Vereda Tonusco',
    address: 'Vía al Puente de Occidente, km 2', latitude: 6.5562, longitude: -75.8281, instagram: 'fincalaesperanza.demo',
    deposit: 400000, weight: 0.85,
    info: 'Finca de clima cálido con dos piscinas, cancha de fútbol, jacuzzi y seis habitaciones.',
    plans: [
      { name: 'Pasadía con almuerzo', plan_type: 'pasadia', adult: 85000, child: 55000, in: '09:00', out: '18:00', min: 10, max: 40, food: 'Almuerzo típico: sancocho o bandeja paisa.',
        description: 'Día de piscina con almuerzo incluido.' },
      { name: 'Fin de semana', plan_type: 'hospedaje', adult: 180000, child: 110000, in: '15:00', out: '13:00', min: 8, max: 24, overnight: true, food: 'Desayuno incluido.',
        description: 'Noche con desayuno, piscinas y jacuzzi.' }
    ]
  },
  {
    name: 'Refugio Los Pinos', city: 'Villa de Leyva', department: 'Boyacá', suburb: 'Vereda Sabana',
    address: 'Vía a Sutamarchán, km 3', latitude: 5.6346, longitude: -73.5249, instagram: 'refugiolospinos.demo',
    deposit: 250000, weight: 0.65,
    info: 'Refugio de montaña con chimenea, fogata y senderos entre pinos.',
    plans: [
      { name: 'Hospedaje', plan_type: 'hospedaje', adult: 150000, child: 90000, in: '15:00', out: '12:00', min: 4, max: 14, overnight: true,
        description: 'Noche con chimenea, fogata y desayuno campesino.', food: 'Desayuno campesino.' },
      { name: 'Pasadía', plan_type: 'pasadia', adult: 55000, child: 35000, in: '10:00', out: '18:00', min: 6, max: 20,
        description: 'Día de caminata, fogata y almuerzo campestre.' }
    ]
  }
];

const CUSTOMERS = [
  'Laura Gómez', 'Andrés Castaño', 'Mariana Ríos', 'Juan Pablo Restrepo', 'Valentina Herrera', 'Santiago Montoya',
  'Daniela Ospina', 'Camilo Zapata', 'Natalia Cardona', 'Sebastián Arango', 'Isabella Vélez', 'Felipe Londoño',
  'Carolina Muñoz', 'Mateo Giraldo', 'Paula Henao', 'Alejandro Rendón', 'Sofía Mejía', 'Esteban Quintero',
  'Manuela Betancur', 'Julián Correa', 'Catalina Duque', 'David Salazar', 'María José Rincón', 'Nicolás Pineda',
  'Ana María Franco', 'Tomás Agudelo', 'Juliana Toro', 'Diego Marín', 'Luisa Fernanda Soto', 'Samuel Echeverri',
  'Gabriela Uribe', 'Ricardo Patiño', 'Verónica Álvarez', 'Jorge Iván Cano', 'Lina Marcela Gil', 'Cristian Mora',
  'Melissa Arias', 'Óscar Jaramillo', 'Angélica Rojas', 'Mauricio Bedoya', 'Diana Carolina Ruiz', 'Hernán Orozco',
  'Tatiana Cifuentes', 'Fabián Serna', 'Alejandra Posada', 'Iván Darío Mesa', 'Paola Andrea Vargas', 'Wilson Hoyos',
  'Yesenia Castro', 'Gustavo Ramírez', 'Lorena Acevedo', 'Kevin Builes', 'Mónica Tabares', 'Fredy Alzate',
  'Sara Lucía Osorio', 'Brayan Cárdenas', 'Claudia Patricia Gaviria', 'Jhon Fredy Arboleda', 'Estefanía Ochoa', 'Álvaro Suárez'
];

const handle = (name) => name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, '').trim().split(/\s+/).slice(0, 2).join('.');
const phone = (i) => `5730055${String(50100 + i).padStart(5, '0')}`;

// ---------- helpers ----------

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = { command };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--email') opts.email = rest[++i];
    else if (rest[i] === '--password') opts.password = rest[++i];
  }
  opts.email = (opts.email || process.env.DEMO_EMAIL || DEFAULT_EMAIL).toLowerCase().trim();
  opts.password = opts.password || process.env.DEMO_PASSWORD || null;
  return opts;
}

function planDuration(plan) {
  const [ih, im] = plan.in.split(':').map(Number);
  const [oh, om] = plan.out.split(':').map(Number);
  let minutes = oh * 60 + om - (ih * 60 + im);
  if (minutes <= 0) minutes += 24 * 60;
  return minutes * 60;
}

function depositFor(venue, adults) {
  return venue.deposit + Math.max(0, adults - 15) * 20000;
}

/** The terms a signed contract covers, in the shape the otrosí check compares. */
function termsOf(acc, planName) {
  return {
    date: ymd(acc.date),
    plan_id: acc.plan_id,
    plan_name: planName,
    adults: acc.adults,
    children: acc.children,
    agreed_price: Math.round(Number(acc.agreed_price))
  };
}

async function findDemo(email) {
  const user = await prisma.users.findFirst({ where: { email } });
  if (!user) throw new Error(`No existe el usuario ${email}`);
  const demo = user.preferences?.demo;
  if (!demo?.organization_id) throw new Error(`${email} no es una cuenta demo: no se toca`);
  const others = await prisma.user_organizations.count({ where: { organization_id: demo.organization_id, user_id: { not: user.id } } });
  if (others) throw new Error(`La organización demo tiene ${others} miembro(s) más: no se toca`);
  const venues = await prisma.venues.findMany({ where: { organization: demo.organization_id }, select: { id: true } });
  return { user, demo, orgId: demo.organization_id, venueIds: venues.map((v) => v.id) };
}

// ---------- build ----------

/**
 * Creates the venues and their history around `today` for an existing user and
 * organization. Everything is relative to today, so the account looks lived-in.
 */
async function seedData(tx, { userId, orgId, today }) {
  const rand = makeRandom(20261017);
  const uuid = () => crypto.randomUUID();
  const rows = {
    venues: [], venue_plans: [], venue_payment_methods: [], contacts: [], contact_venue: [], contact_organization: [],
    providers: [], commission_agents: [], commission_rules: [], accommodations: [], payments: [], incomes: [],
    deposits: [], expenses: [], commission_payments: [], estimates: [], chat_conversations: [], chat_messages: [],
    contract_templates: [], contract_template_sections: [], contracts: [], maintenance_zones: [], maintenance_logs: [],
    pending_tasks: [], inventory_items: [], notifications: []
  };
  const nowTs = new Date();
  const clampPast = (d) => (d > nowTs ? new Date(nowTs.getTime() - rand.int(5, 120) * 60000) : d);

  const categories = await tx.expense_categories.findMany({ where: { is_active: true }, select: { id: true, name: true } });
  const category = (name) => categories.find((c) => c.name === name)?.id || null;
  const invCategories = await tx.inventory_categories.findMany({ where: { organization_id: null }, select: { id: true, name: true } });
  const invCategory = (name) => invCategories.find((c) => c.name === name)?.id || null;

  // Venues, plans, payment methods, contract templates.
  const venues = VENUES.map((v, index) => {
    const id = uuid();
    rows.venues.push({
      id, organization: orgId, name: v.name, city: v.city, department: v.department, suburb: v.suburb, country: 'Colombia',
      address: v.address, latitude: v.latitude, longitude: v.longitude, instagram: v.instagram, venue_info: v.info,
      is_public: false, location_source: 'manual',
      deposit_base_amount: v.deposit, deposit_max_people_included: 15, deposit_per_extra_person: 20000, deposit_refund_hours: 24,
      deposit_policy: 'El depósito se devuelve entre 12 y 24 horas después de la salida, descontando daños si los hay.',
      advance_percentage: 50, notify_booking_whatsapp: false, notify_booking_email: false, ig_summary_enabled: false,
      followup_enabled: false, wifi_ssid: `${v.name.split(' ').pop()}_WiFi`, wifi_password: 'demo2026'
    });
    const plans = v.plans.map((p) => {
      const planId = uuid();
      rows.venue_plans.push({
        id: planId, venue_id: id, name: p.name, plan_type: p.plan_type, description: p.description,
        adult_price: p.adult, child_price: p.child, min_guests: p.min, max_capacity: p.max,
        check_in_time: p.in, check_out_time: p.out, includes_overnight: !!p.overnight, includes_rooms: !!p.overnight,
        includes_food: !!p.food, food_description: p.food || null, free_children_qty: 2, free_children_max_age: 3,
        is_active: true
      });
      return { ...p, id: planId, duration: planDuration(p) };
    });
    rows.venue_payment_methods.push(
      { venue_id: id, method_type: 'nequi', label: 'Nequi', account_info: `300 555 01${String(90 + index)}`, holder_name: `${ORG_NAME} S.A.S.`, sort_order: 0 },
      { venue_id: id, method_type: 'breb', label: 'Bre-B', account_info: `@${v.instagram.split('.')[0]}`, holder_name: `${ORG_NAME} S.A.S.`, sort_order: 1 },
      { venue_id: id, method_type: 'cash', label: 'Efectivo', instructions: 'Solo para el saldo, el día del alquiler.', sort_order: 2 }
    );
    const templateId = uuid();
    rows.contract_templates.push({ id: templateId, venue_id: id, name: 'Contrato Estándar', is_default: true, is_active: true, created_by: userId });
    const sections = CONTRACT_SECTIONS.map((s) => ({ id: uuid(), template_id: templateId, title: s.title, content: s.content, sort_order: s.sort_order }));
    rows.contract_template_sections.push(...sections);
    return { ...v, id, index, plans, templateId, sections, record: rows.venues[rows.venues.length - 1] };
  });

  // Customers, linked to the organization and to the venues they booked.
  const contacts = CUSTOMERS.map((fullname, i) => {
    const id = uuid();
    rows.contacts.push({
      id, fullname, whatsapp: phone(i), instagram: i % 3 === 0 ? `@${handle(fullname)}` : null,
      email: i % 4 === 0 ? `${handle(fullname)}@correo.test` : null,
      city: rand.pick(['Medellín', 'Medellín', 'Envigado', 'Bello', 'Itagüí', 'Rionegro', 'Bogotá', 'Sabaneta']),
      state: 'Antioquia', country: 'Colombia', created_at: at(addDays(today, -rand.int(30, 420)), '12:00')
    });
    rows.contact_organization.push({ contact: id, organization: orgId, type: 'customer' });
    return { id, fullname, whatsapp: phone(i), record: rows.contacts[i] };
  });
  const linked = new Set();
  const linkContact = (contactId, venueId) => {
    const key = `${venueId}:${contactId}`;
    if (linked.has(key)) return;
    linked.add(key);
    rows.contact_venue.push({ venue: venueId, contact: contactId, type: 'customer' });
  };

  // Providers and a commission agent who brings groups to the first two venues.
  const provider = (name, extra = {}) => {
    const id = uuid();
    rows.providers.push({ id, organization_id: orgId, name, ...extra });
    return id;
  };
  const providers = {
    epm: provider('EPM', { notes: 'Energía y agua' }),
    internet: provider('Tigo Hogar', { notes: 'Internet' }),
    aseo: provider('Aseo Brillante', { phone: '3005550301' }),
    jardin: provider('Jardines del Oriente', { phone: '3005550302' }),
    piscinas: provider('Piscinas y Bombas S.A.S.', { phone: '3005550303' }),
    cuidandero: provider('Don Jairo (cuidandero)', { phone: '3005550304' }),
    agent: provider('Viajes Paisas (comisionista)', { phone: '3005550305' })
  };
  const agentId = uuid();
  rows.commission_agents.push({ id: agentId, provider_id: providers.agent, organization_id: orgId, name: 'Viajes Paisas', notes: 'Agencia que trae grupos empresariales y de colegios.', created_by: userId });
  rows.commission_rules.push(
    { agent_id: agentId, plan_type: 'pasadia', min_adults: 1, rate_percent: 10, sort_order: 0 },
    { agent_id: agentId, plan_type: 'pasanoche', min_adults: 1, rate_percent: 10, sort_order: 1 },
    { agent_id: agentId, plan_type: 'hospedaje', min_adults: 1, rate_percent: 8, sort_order: 2 }
  );

  // Bookings: a year back and three months ahead, mostly on weekends, growing over time.
  const guaranteed = new Set();
  const nextWeekday = (from, wd) => addDays(from, ((wd - weekday(from) + 7) % 7) || 7);
  const sat1 = nextWeekday(addDays(today, -1), 6);
  guaranteed.add(`0:${sat1}`).add(`0:${addDays(sat1, 7)}`).add(`1:${addDays(sat1, 1)}`).add(`2:${sat1}`).add(`1:${addDays(sat1, 14)}`);
  guaranteed.add(`0:${addDays(nextWeekday(addDays(today, -1), 6), -7)}`); // last weekend: deposit still held

  const bookings = [];
  for (const venue of venues) {
    for (let d = -365; d <= 90; d++) {
      const day = addDays(today, d);
      const wd = weekday(day);
      let p = { 6: 0.55, 0: 0.25, 5: 0.1 }[wd] ?? 0.03;
      if ([12, 1, 6, 7].includes(Number(day.slice(5, 7)))) p *= 1.3;
      if (d < 0) p *= 0.65 + 0.35 * ((d + 365) / 365);
      else if (d > 45) p *= 0.3;
      else if (d > 14) p *= 0.6;
      p *= venue.weight;
      if (!guaranteed.has(`${venue.index}:${day}`) && !rand.chance(p)) continue;
      const overnight = venue.plans.find((pl) => pl.overnight);
      const plan = (wd === 6 && rand.chance(0.5)) || (venue.plans[0].overnight && rand.chance(0.7)) ? overnight : venue.plans.find((pl) => !pl.overnight);
      const adults = rand.int(plan.min, plan.max);
      const children = rand.chance(0.5) ? rand.int(1, 5) : 0;
      const calculated = adults * plan.adult + Math.max(0, children - 2) * plan.child;
      const agreed = rand.chance(0.2) ? roundTo(calculated * 0.9, 10000) : calculated;
      const contact = contacts[rand.int(0, contacts.length - 1)];
      const lead = rand.int(5, 45);
      let created = at(addDays(day, -lead), hhmm(rand, 8, 21));
      created = clampPast(created);
      const cancelled = rand.chance(0.03) && d !== 0 && !guaranteed.has(`${venue.index}:${day}`);
      const noShow = !cancelled && d < -7 && rand.chance(0.015);
      const viaAgent = venue.index < 2 && rand.chance(0.15);
      const id = uuid();
      const acc = {
        id, venue: venue.id, date: dateOf(day), time: timeOf(plan.in), duration: plan.duration, customer: contact.id,
        adults, children, agreed_price: agreed, calculated_price: calculated, plan_id: plan.id, created_by: userId,
        created_at: created, commission_agent_id: viaAgent ? agentId : null,
        cancelled_at: cancelled ? clampPast(new Date(created.getTime() + rand.int(1, 10) * DAY)) : null,
        cancelled_by: cancelled ? userId : null,
        cancel_note: cancelled ? rand.pick(['El cliente canceló por cambio de planes.', 'Canceló por pronóstico de lluvia; queda con saldo a favor.']) : null,
        no_show_at: noShow ? at(day, '13:00') : null, no_show_by: noShow ? userId : null,
        no_show_note: noShow ? 'No llegaron ni respondieron llamadas.' : null
      };
      rows.accommodations.push(acc);
      linkContact(contact.id, venue.id);
      bookings.push({ acc, venue, plan, contact, day, d, cancelled, noShow, viaAgent });
    }
  }

  // Payments (and incomes for the verified ones), deposits and commissions.
  const pushPayment = (b, amount, day, { verified = true, method, kind }) => {
    const id = uuid();
    const paidOn = day > today ? today : day;
    const createdAt = clampPast(at(paidOn, hhmm(rand, 7, 21)));
    rows.payments.push({
      id, accommodation: b.acc.id, amount, payment_method: method, payment_date: dateOf(paidOn), type: 'accommodation',
      reference: method === 'Efectivo' ? null : `M${rand.int(10000000, 99999999)}`,
      notes: kind, verified, verified_at: verified ? new Date(createdAt.getTime() + rand.int(10, 300) * 60000) : null,
      verified_by: verified ? userId : null, created_by: userId, created_at: createdAt
    });
    if (verified) {
      rows.incomes.push({ payment_id: id, organization_id: orgId, venue_id: b.venue.id, amount, type: 'accommodation', date: dateOf(paidOn), accrual_date: b.acc.date, created_at: createdAt });
    }
  };
  const method = () => rand.weighted([['Nequi', 50], ['Bre-B', 30], ['Bancolombia', 12], ['Daviplata', 8]]);

  for (const b of bookings) {
    const agreed = Number(b.acc.agreed_price);
    const advance = roundTo(agreed * 0.5, 1000);
    const bookedOn = ymd(b.acc.created_at.getTime() - 5 * 3600000);
    const advanceDay = addDays(bookedOn, rand.int(0, 2)) > today ? today : addDays(bookedOn, rand.int(0, 2));
    const recent = daysBetween(bookedOn, today) <= 3;
    if (b.d >= 0 && !b.cancelled && rand.chance(0.08)) {
      // Booked but the advance hasn't arrived yet.
    } else if (b.d >= 0 && !b.cancelled && rand.chance(0.15)) {
      pushPayment(b, agreed, advanceDay, { method: method(), kind: 'Pago total anticipado' });
    } else {
      pushPayment(b, advance, advanceDay, { method: method(), kind: 'Anticipo 50%', verified: !(recent && b.d >= 0 && rand.chance(0.6)) });
      if (b.d < 0 && !b.cancelled && !b.noShow) {
        pushPayment(b, agreed - advance, b.day, { method: rand.weighted([['Nequi', 45], ['Bre-B', 30], ['Efectivo', 25]]), kind: 'Saldo' });
      }
    }

    if (b.d < 0 && !b.cancelled && !b.noShow && rand.chance(0.88)) {
      const amount = depositFor(b.venue, b.acc.adults);
      const held = b.d >= -6;
      const damaged = !held && rand.chance(0.08);
      const damage = damaged ? rand.pick([18000, 50000, 80000, 120000]) : 0;
      rows.deposits.push({
        accommodation_id: b.acc.id, venue_id: b.venue.id, organization_id: orgId, amount, calculated_amount: amount,
        status: held ? 'pending' : 'refunded', payment_method: 'Nequi', payment_date: b.acc.date,
        reference: `M${rand.int(10000000, 99999999)}`,
        refund_amount: held ? null : amount - damage, refund_date: held ? null : dateOf(addDays(b.day, 1)),
        refund_reference: held ? null : `M${rand.int(10000000, 99999999)}`,
        damage_amount: damage || null, damage_notes: damaged ? rand.pick(['Vaso y plato quebrados.', 'Suciedad excesiva al salir.', 'Salieron una hora tarde.']) : null,
        verified: true, verified_at: at(b.day, '10:00'), verified_by: userId, created_by: userId, created_at: at(b.day, '09:30')
      });
    }

    if (b.viaAgent && b.d < 0 && !b.cancelled) {
      const rate = b.plan.plan_type === 'hospedaje' ? 8 : 10;
      const amount = roundTo(agreed * rate / 100, 1000);
      const paid = b.d < -10;
      let expenseId = null;
      const payDay = addDays(b.day, 5);
      if (paid) {
        expenseId = uuid();
        rows.expenses.push({
          id: expenseId, organization_id: orgId, venue_id: b.venue.id, category_id: category('Otros'), provider_id: providers.agent,
          amount, description: `Comisión - Viajes Paisas - Evento ${dateOf(b.day).toLocaleDateString('es-CO', { timeZone: 'UTC' })}`,
          expense_date: dateOf(payDay), notes: `Pago de comisión por evento con ${b.acc.adults} adultos`, created_by: userId, created_at: at(payDay, '11:00')
        });
      }
      rows.commission_payments.push({
        agent_id: agentId, accommodation_id: b.acc.id, organization_id: orgId, venue_id: b.venue.id, adults: b.acc.adults,
        agreed_price: agreed, calculated_amount: amount, status: paid ? 'paid' : 'pending',
        payment_date: paid ? dateOf(payDay) : null, payment_method: paid ? 'Nequi' : null, expense_id: expenseId,
        breakdown: [{ range_min: 1, range_max: null, adults_in_tier: b.acc.adults, commission_percent: rate, per_adult_price: Math.round(agreed / b.acc.adults), subtotal: amount }],
        created_by: userId, created_at: clampPast(at(addDays(b.day, 1), '10:00'))
      });
    }
  }

  // Operating expenses: monthly services and payroll, cleaning after each booking, some repairs.
  const expense = (venue, cat, prov, amount, day, description, extra = {}) => {
    if (day > today) return;
    rows.expenses.push({
      organization_id: orgId, venue_id: venue.id, category_id: category(cat), provider_id: prov, amount, description,
      expense_date: dateOf(day), created_by: userId, created_at: at(day, '18:00'), ...extra
    });
  };
  for (const venue of venues) {
    for (let m = 12; m >= 0; m--) {
      const base = addDays(today, -m * 30);
      const month = base.slice(0, 8);
      expense(venue, 'Servicios', providers.epm, roundTo(rand.int(170000, 330000), 100), `${month}10`, 'Energía');
      expense(venue, 'Servicios', providers.epm, roundTo(rand.int(55000, 120000), 100), `${month}12`, 'Acueducto');
      expense(venue, 'Servicios', providers.internet, 95000, `${month}05`, 'Internet');
      expense(venue, 'Nómina', providers.cuidandero, venue.index === 2 ? 1100000 : 1423500, `${month}28`, 'Pago mensual del cuidandero');
      expense(venue, 'Jardinería', providers.jardin, rand.pick([120000, 150000, 180000]), `${month}15`, 'Poda y mantenimiento de zonas verdes');
      expense(venue, 'Insumos', null, roundTo(rand.int(80000, 210000), 1000), `${month}08`, 'Cloro, jabón y bolsas de basura');
      if (rand.chance(0.25)) {
        expense(venue, 'Mantenimiento', providers.piscinas, roundTo(rand.int(250000, 1200000), 10000), `${month}${String(rand.int(16, 26))}`,
          rand.pick(['Cambio de arena del filtro de la piscina', 'Reparación de la bomba de agua', 'Pintura del kiosco', 'Arreglo de la cerradura de la puerta principal']));
      }
    }
  }
  for (const b of bookings) {
    if (b.d < 0 && !b.cancelled && !b.noShow && rand.chance(0.75)) {
      expense(b.venue, 'Limpieza', providers.aseo, rand.pick([60000, 70000, 80000, 90000]), addDays(b.day, 1), 'Aseo después del alquiler', { accommodation_id: b.acc.id });
    }
  }

  // Contracts: signed for recent and upcoming bookings, a couple still waiting for the client's signature.
  const contractFor = (b, signed, signedTerms) => {
    const id = uuid();
    const plan = b.plan;
    const base = signedTerms ? { ...b.acc, adults: signedTerms.adults, children: signedTerms.children, agreed_price: signedTerms.agreed_price } : b.acc;
    const { renderedSections } = contractRenderer.renderContract(b.venue.sections, {
      accommodation: base, customer: b.contact.record, venue: b.venue.record, organization: { name: ORG_NAME },
      plan: { name: plan.name }, payments: rows.payments.filter((p) => p.accommodation === b.acc.id), deposit: null
    });
    const acceptedAt = signed ? clampPast(new Date(b.acc.created_at.getTime() + rand.int(2, 30) * 3600000)) : null;
    rows.contracts.push({
      id, accommodation_id: b.acc.id, template_id: b.venue.templateId, snapshot_html: JSON.stringify(renderedSections),
      access_code: String(rand.int(100000, 999999)), status: signed ? 'signed' : 'draft', accepted_at: acceptedAt,
      accepted_ip: signed ? '190.248.0.10' : null, created_by: userId, created_at: b.acc.created_at, updated_at: acceptedAt || b.acc.created_at,
      signed_terms: signed ? (signedTerms || termsOf(b.acc, plan.name)) : null
    });
  };
  let drafts = 0;
  let amended = false;
  for (const b of bookings) {
    if (b.cancelled || b.d < -60 || b.d > 30) continue;
    if (b.d >= 3 && drafts < 2 && rand.chance(0.35)) { drafts++; contractFor(b, false); continue; }
    if (b.d >= 3 && !amended) {
      // Signed with fewer people: the booking grew afterwards, so it shows the otrosí notice.
      amended = true;
      const signedTerms = termsOf(b.acc, b.plan.name);
      signedTerms.adults = Math.max(b.plan.min, b.acc.adults - 4);
      signedTerms.agreed_price = signedTerms.adults * b.plan.adult + Math.max(0, b.acc.children - 2) * b.plan.child;
      contractFor(b, true, signedTerms);
      continue;
    }
    contractFor(b, true);
  }

  // Quotes: some turned into the latest bookings, a few still open.
  const recentBookings = bookings.filter((b) => b.d >= 0 && !b.cancelled).sort((a, b) => b.acc.created_at - a.acc.created_at).slice(0, 6);
  for (const b of recentBookings) {
    rows.estimates.push({
      venue_id: b.venue.id, plan_id: b.plan.id, customer_name: b.contact.fullname, contact_type: 'whatsapp', contact_value: b.contact.whatsapp,
      contact_phone: b.contact.whatsapp, check_in: b.acc.date, check_out: b.acc.date, adults: b.acc.adults, children: b.acc.children,
      calculated_price: b.acc.calculated_price, agreed_price: b.acc.agreed_price, status: 'converted', payment_status: 'verified',
      accommodation_id: b.acc.id, converted_at: b.acc.created_at, created_by: userId,
      created_at: new Date(b.acc.created_at.getTime() - rand.int(1, 48) * 3600000)
    });
  }
  const taken = new Set(bookings.map((b) => `${b.venue.index}:${b.day}`));
  const freeDay = (venueIndex, from) => {
    let day = nextWeekday(addDays(today, from), 6);
    while (taken.has(`${venueIndex}:${day}`)) day = addDays(day, 7);
    taken.add(`${venueIndex}:${day}`);
    return day;
  };
  const openQuotes = [
    { venue: 0, name: 'Laura Gómez', type: 'whatsapp', adults: 18, children: 3, from: 10, payment: 'link_sent', hoursAgo: 5 },
    { venue: 1, name: 'Mariana Ríos', type: 'instagram', adults: 25, children: 0, from: 20, payment: 'none', hoursAgo: 1 },
    { venue: 0, name: 'Esteban Quintero', type: 'whatsapp', adults: 12, children: 2, from: 25, payment: 'none', hoursAgo: 30 },
    { venue: 2, name: 'Gabriela Uribe', type: 'instagram', adults: 6, children: 2, from: 15, payment: 'none', hoursAgo: 52 }
  ];
  const quoteDays = {};
  for (const q of openQuotes) {
    const venue = venues[q.venue];
    const plan = venue.plans[q.venue === 2 ? 0 : 0];
    const day = freeDay(q.venue, q.from);
    quoteDays[q.name] = day;
    const contact = contacts.find((c) => c.fullname === q.name);
    const calculated = q.adults * plan.adult + Math.max(0, q.children - 2) * plan.child;
    rows.estimates.push({
      venue_id: venue.id, plan_id: plan.id, customer_name: q.name, contact_type: q.type,
      contact_value: q.type === 'whatsapp' ? contact.whatsapp : `@${handle(q.name)}`, contact_phone: contact.whatsapp,
      check_in: dateOf(day), check_out: dateOf(day), adults: q.adults, children: q.children, calculated_price: calculated,
      agreed_price: calculated, status: 'pending', payment_status: q.payment, created_by: userId,
      created_at: new Date(nowTs.getTime() - q.hoursAgo * 3600000)
    });
  }

  // Chats from the website widget: one waiting for an answer, one handed to the team, the rest handled by the AI.
  const longDate = (day) => dateOf(day).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const money = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;
  const chat = (venueIndex, name, messages, extra = {}) => {
    const id = uuid();
    const contact = contacts.find((c) => c.fullname === name);
    const times = messages.map(([, , minutesAgo]) => new Date(nowTs.getTime() - minutesAgo * 60000));
    rows.chat_conversations.push({
      id, venue_id: venues[venueIndex].id, source: 'web', name, phone: contact?.whatsapp || null, status: 'active',
      created_at: times[0], updated_at: times[times.length - 1], last_read_at: times[times.length - 1], ...extra
    });
    messages.forEach(([role, content], i) => rows.chat_messages.push({ conversation_id: id, role, content, created_at: times[i], status: 'sent' }));
  };
  const lauraDay = quoteDays['Laura Gómez'];
  const pasadia0 = venues[0].plans[0];
  chat(0, 'Laura Gómez', [
    ['user', `Hola! Tienen disponible el ${longDate(lauraDay)} para pasadía? Somos 18 adultos y 3 niños`, 330],
    ['assistant', `¡Hola Laura! Sí, el ${longDate(lauraDay)} está disponible en Cabaña El Roble 🙌\n\nEl pasadía es de 9:00 a. m. a 7:00 p. m. e incluye piscina, kiosco con BBQ y muelle.\n\n• 18 adultos × ${money(pasadia0.adult)}\n• 3 niños (2 menores de 3 años sin costo) × ${money(pasadia0.child)}\n\nTotal: *${money(18 * pasadia0.adult + pasadia0.child)}*. Para apartar se paga el 50%.`, 328],
    ['user', 'Perfecto, me mandas el link para pagar?', 310],
    ['assistant', 'Claro, aquí tienes el link de pago del anticipo. Apenas se confirme te llega el contrato para firmar. 😊', 309]
  ]);
  chat(0, 'Andrés Castaño', [
    ['user', 'Buenas, queremos hacer el paseo de fin de año de la empresa, seríamos 40 personas', 150],
    ['assistant', 'Hola Andrés, ¡qué buen plan! La capacidad del pasadía en Cabaña El Roble es de 30 personas. ¿Te gustaría que revisemos opciones para tu grupo?', 149],
    ['user', 'Y si llevamos 2 perros? y hay descuento por ser empresa? necesito hablar con alguien', 120],
    ['assistant', 'Te comunico con el equipo para que revisen el descuento y la capacidad. En un momento te escriben. 🙏', 119]
  ], { status: 'human_attention', escalated_at: new Date(nowTs.getTime() - 119 * 60000), escalated_reason: 'customer_request', last_read_at: null });
  chat(1, 'Mariana Ríos', [
    ['user', 'Hola, vi su página en Instagram. Cuánto vale el pasadía con almuerzo para 25 personas?', 75],
    ['assistant', `¡Hola Mariana! El pasadía con almuerzo en Finca La Esperanza vale ${money(venues[1].plans[0].adult)} por adulto e incluye almuerzo típico, piscinas y cancha. Para 25 adultos serían *${money(25 * venues[1].plans[0].adult)}*.`, 74],
    ['user', 'Tienen parqueadero para 2 buses?', 32]
  ], { last_read_at: null });
  const converted = recentBookings[0];
  if (converted) {
    chat(converted.venue.index, converted.contact.fullname, [
      ['user', `Hola, quiero reservar el ${longDate(converted.day)} para ${converted.acc.adults} personas`, 4200],
      ['assistant', `¡Hola! Ese día está disponible en ${converted.venue.name}. El total para ${converted.acc.adults} adultos es *${money(Number(converted.acc.agreed_price))}* y para apartar se paga el 50%.`, 4199],
      ['user', 'Listo, ya hice la transferencia', 4100],
      ['assistant', '¡Recibido! Tu reserva quedó confirmada. Te enviamos el contrato para firmar. ¡Nos vemos pronto! 🌿', 4095]
    ]);
  }
  chat(2, 'Gabriela Uribe', [
    ['user', 'Hola! El refugio tiene chimenea? Vamos con niños pequeños', 3200],
    ['assistant', '¡Hola Gabriela! Sí, el Refugio Los Pinos tiene chimenea en la sala y zona de fogata afuera. Los niños menores de 3 años no pagan. ¿Para qué fecha lo estás pensando?', 3199],
    ['user', 'Para dentro de 2 o 3 semanas, te confirmo', 3150],
    ['assistant', '¡Perfecto! Te dejo la cotización lista. Cuando confirmes la fecha te la apartamos. 😊', 3149]
  ]);
  chat(1, 'Felipe Londoño', [
    ['user', 'Buenas tardes, a qué hora es la entrada del plan fin de semana?', 13000],
    ['assistant', 'Hola Felipe, la entrada es a las 3:00 p. m. y la salida al día siguiente a la 1:00 p. m. Incluye desayuno. 🍳', 12999],
    ['user', 'Gracias!', 12900]
  ]);

  // Maintenance, pending tasks and inventory for the first venue.
  const v0 = venues[0];
  const zone = (name, type) => { const id = uuid(); rows.maintenance_zones.push({ id, organization_id: orgId, venue_id: v0.id, name, type }); return id; };
  const pool = zone('Piscina', 'piscina');
  const kiosk = zone('Kiosco y BBQ', 'social');
  const garden = zone('Zonas verdes', 'exterior');
  rows.maintenance_logs.push(
    { organization_id: orgId, venue_id: v0.id, zone_id: pool, provider_id: providers.piscinas, title: 'Mantenimiento de la bomba de la piscina', description: 'Cambio de sellos y limpieza del prefiltro.', status: 'completed', priority: 'high', maintenance_date: dateOf(addDays(today, -38)), completed_at: at(addDays(today, -38), '16:00'), work_performed: 'Se cambiaron los sellos mecánicos y se lavó el filtro.', cost: 350000, total_cost: 350000, created_by: userId, created_at: at(addDays(today, -40), '09:00') },
    { organization_id: orgId, venue_id: v0.id, zone_id: garden, provider_id: providers.jardin, title: 'Poda general y abono', status: 'completed', priority: 'normal', maintenance_date: dateOf(addDays(today, -9)), completed_at: at(addDays(today, -9), '15:00'), work_performed: 'Poda de setos y abono del césped.', cost: 180000, total_cost: 180000, created_by: userId, created_at: at(addDays(today, -12), '09:00') },
    { organization_id: orgId, venue_id: v0.id, zone_id: kiosk, title: 'Revisión del gas de la BBQ', description: 'Revisar mangueras y regulador antes del puente festivo.', status: 'pending', priority: 'normal', scheduled_date: at(addDays(today, 4), '09:00'), maintenance_date: dateOf(addDays(today, 4)), created_by: userId, created_at: at(addDays(today, -2), '10:00') }
  );
  rows.pending_tasks.push(
    { organization_id: orgId, venue_id: v0.id, zone_id: kiosk, title: 'Cambiar bombillos del kiosco', priority: 'high', due_date: dateOf(addDays(today, 2)), created_by: userId, created_at: at(addDays(today, -3), '19:00') },
    { organization_id: orgId, venue_id: v0.id, zone_id: pool, title: 'Comprar cloro granulado', description: 'Quedan menos de 5 kg.', priority: 'medium', due_date: dateOf(addDays(today, 3)), created_by: userId, created_at: at(addDays(today, -1), '08:00') },
    { organization_id: orgId, venue_id: venues[1].id, title: 'Reparar la hamaca del corredor', priority: 'low', due_date: dateOf(addDays(today, 10)), created_by: userId, created_at: at(addDays(today, -6), '12:00') },
    { organization_id: orgId, venue_id: v0.id, title: 'Lavar cojines de las sillas', priority: 'low', status: 'completed', completed_at: at(addDays(today, -5), '17:00'), created_by: userId, created_at: at(addDays(today, -14), '12:00') }
  );
  const item = (venue, type, name, qty, unit, extra = {}) => rows.inventory_items.push({
    organization_id: orgId, venue_id: venue.id, type, name, quantity: qty, unit, created_by: userId,
    category_id: invCategory(type === 'asset' ? 'Mobiliario' : 'Limpieza'), ...extra
  });
  item(v0, 'asset', 'Sillas Rimax', 40, 'unidad', { condition: 'bueno', location: 'Kiosco', unit_cost: 45000 });
  item(v0, 'asset', 'Colchonetas', 12, 'unidad', { condition: 'bueno', location: 'Habitación principal', unit_cost: 90000 });
  item(v0, 'asset', 'Hamacas', 4, 'unidad', { condition: 'regular', location: 'Corredor' });
  item(v0, 'supply', 'Cloro granulado', 3, 'kg', { minimum_stock: 5, unit_cost: 18000 });
  item(v0, 'supply', 'Jabón líquido', 6, 'litro', { minimum_stock: 4, unit_cost: 9000 });
  item(venues[1], 'supply', 'Papel higiénico', 24, 'unidad', { minimum_stock: 20, unit_cost: 1800 });

  // A few recent notifications so the bell isn't empty.
  const upcoming = bookings.filter((b) => b.d >= 0 && !b.cancelled).sort((a, b) => a.d - b.d);
  const notify = (b, type, title, body, minutesAgo, read) => b && rows.notifications.push({
    user_id: userId, organization_id: orgId, venue_id: b.venue.id, type, title, body, link: `/business/accommodations/${b.acc.id}`,
    created_at: new Date(nowTs.getTime() - minutesAgo * 60000), read_at: read ? new Date(nowTs.getTime() - (minutesAgo - 5) * 60000) : null
  });
  if (converted) notify(converted, 'booking_confirmed', `Nueva reserva: ${converted.venue.name}`, `${converted.contact.fullname} reservó para el ${longDate(converted.day)} (${converted.acc.adults} adultos).`, 4090, false);
  notify(upcoming[0], 'payment_received', `Pago recibido: ${upcoming[0] ? longDate(upcoming[0].day) : ''}`, `${upcoming[0]?.contact.fullname} pagó el anticipo por Nequi.`, 600, false);
  notify(upcoming[1], 'booking_confirmed', `Nueva reserva: ${upcoming[1]?.venue.name}`, `${upcoming[1]?.contact.fullname} reservó para el ${upcoming[1] ? longDate(upcoming[1].day) : ''}.`, 2900, true);

  // Insert in dependency order.
  const order = ['venues', 'venue_plans', 'venue_payment_methods', 'contract_templates', 'contract_template_sections', 'contacts',
    'contact_organization', 'contact_venue', 'providers', 'commission_agents', 'commission_rules', 'accommodations', 'payments',
    'incomes', 'deposits', 'expenses', 'commission_payments', 'contracts', 'estimates', 'chat_conversations', 'chat_messages',
    'maintenance_zones', 'maintenance_logs', 'pending_tasks', 'inventory_items', 'notifications'];
  const counts = {};
  for (const table of order) {
    if (!rows[table].length) continue;
    await tx[table].createMany({ data: rows[table] });
    counts[table] = rows[table].length;
  }
  return counts;
}

// ---------- refresh: keep the data around today ----------

/** Moves every demo date by `days` (a whole number of weeks, so weekends stay weekends). */
async function shiftDates(tx, { orgId, venueIds, userId }, days) {
  const accIds = (await tx.accommodations.findMany({ where: { venue: { in: venueIds } }, select: { id: true } })).map((a) => a.id);
  const convIds = (await tx.chat_conversations.findMany({ where: { venue_id: { in: venueIds } }, select: { id: true } })).map((c) => c.id);
  const shift = async (table, where, params, dateCols, tsCols) => {
    const sets = [
      ...dateCols.map((c) => `"${c}" = "${c}" + ${days}`),
      ...tsCols.map((c) => `"${c}" = "${c}" + make_interval(days => ${days})`)
    ];
    return tx.$executeRawUnsafe(`UPDATE ${table} SET ${sets.join(', ')} WHERE ${where}`, ...params);
  };
  const V = [venueIds];
  const A = [accIds];
  await shift('accommodations', 'venue = ANY($1::uuid[])', V, ['date', 'original_date'], ['created_at', 'cancelled_at', 'no_show_at', 'rescheduled_at']);
  await shift('payments', 'accommodation = ANY($1::uuid[])', A, ['payment_date'], ['created_at', 'verified_at', 'updated_at']);
  await shift('incomes', 'organization_id = $1::uuid', [orgId], ['date', 'accrual_date'], ['created_at']);
  await shift('deposits', 'accommodation_id = ANY($1::uuid[])', A, ['payment_date', 'refund_date'], ['created_at', 'verified_at', 'updated_at']);
  await shift('expenses', 'organization_id = $1::uuid', [orgId], ['expense_date'], ['created_at', 'updated_at']);
  await shift('commission_payments', 'organization_id = $1::uuid', [orgId], ['payment_date'], ['created_at', 'updated_at']);
  await shift('estimates', 'venue_id = ANY($1::uuid[])', V, ['check_in', 'check_out'], ['created_at', 'updated_at', 'converted_at']);
  await shift('chat_conversations', 'venue_id = ANY($1::uuid[])', V, [], ['created_at', 'updated_at', 'escalated_at', 'last_read_at', 'resume_at']);
  await shift('chat_messages', 'conversation_id = ANY($1::uuid[])', [convIds], [], ['created_at']);
  await shift('contracts', 'accommodation_id = ANY($1::uuid[])', A, [], ['created_at', 'updated_at', 'accepted_at']);
  await shift('contract_amendments', 'accommodation_id = ANY($1::uuid[])', A, [], ['created_at', 'accepted_at']);
  await shift('maintenance_logs', 'organization_id = $1::uuid', [orgId], ['maintenance_date'], ['scheduled_date', 'started_at', 'completed_at', 'created_at', 'updated_at']);
  await shift('pending_tasks', 'venue_id = ANY($1::uuid[])', V, ['due_date'], ['completed_at', 'created_at', 'updated_at']);
  await shift('notifications', 'user_id = $1', [userId], [], ['created_at', 'read_at']);

  // Contract terms carry the date too; without this every contract would ask for an otrosí.
  const contracts = await tx.contracts.findMany({ where: { accommodation_id: { in: accIds } } });
  for (const c of contracts) {
    if (c.signed_terms?.date) {
      await tx.contracts.update({ where: { id: c.id }, data: { signed_terms: { ...c.signed_terms, date: addDays(c.signed_terms.date, days) } } });
    }
  }
  const amendments = await tx.contract_amendments.findMany({ where: { accommodation_id: { in: accIds } } });
  for (const a of amendments) {
    if (a.terms_after?.date) {
      await tx.contract_amendments.update({ where: { id: a.id }, data: { terms_after: { ...a.terms_after, date: addDays(a.terms_after.date, days) } } });
    }
  }
  await rerenderContracts(tx, accIds);
  return accIds.length;
}

/** Re-renders contract text so the dates in it match the moved bookings (signed ones keep their signed terms). */
async function rerenderContracts(tx, accIds) {
  const contracts = await tx.contracts.findMany({ where: { accommodation_id: { in: accIds }, template_id: { not: null } } });
  for (const c of contracts) {
    const acc = await tx.accommodations.findUnique({ where: { id: c.accommodation_id } });
    const template = await tx.contract_templates.findUnique({ where: { id: c.template_id }, include: { sections: { orderBy: { sort_order: 'asc' } } } });
    if (!acc || !template) continue;
    const venue = await tx.venues.findUnique({ where: { id: acc.venue } });
    const organization = venue?.organization ? await tx.organizations.findUnique({ where: { id: venue.organization } }) : null;
    const customer = acc.customer ? await tx.contacts.findUnique({ where: { id: acc.customer } }) : null;
    const plan = acc.plan_id ? await tx.venue_plans.findUnique({ where: { id: acc.plan_id } }) : null;
    const payments = await tx.payments.findMany({ where: { accommodation: acc.id } });
    const t = c.signed_terms;
    const accommodation = t ? { ...acc, adults: t.adults, children: t.children, agreed_price: t.agreed_price } : acc;
    const { renderedSections } = contractRenderer.renderContract(template.sections, { accommodation, customer, venue, organization, plan, payments, deposit: null });
    await tx.contracts.update({ where: { id: c.id }, data: { snapshot_html: JSON.stringify(renderedSections) } });
  }
}

/** If the demo was used and few upcoming bookings are left, adds some on the next free weekends. */
async function ensureUpcoming(tx, { venueIds, userId, orgId }, today) {
  const upcoming = await tx.accommodations.count({
    where: { venue: { in: venueIds }, cancelled_at: null, date: { gte: dateOf(today), lte: dateOf(addDays(today, 30)) } }
  });
  if (upcoming >= 5) return 0;
  const rand = makeRandom(Date.parse(today) / DAY);
  const contacts = await tx.contacts.findMany({ where: { id: { in: (await tx.contact_organization.findMany({ where: { organization: orgId }, select: { contact: true } })).map((c) => c.contact) } } });
  const venues = await tx.venues.findMany({ where: { id: { in: venueIds } }, orderBy: { created_at: 'asc' } });
  let added = 0;
  for (let week = 0; week < 4 && upcoming + added < 6; week++) {
    const saturday = addDays(today, ((6 - weekday(today) + 7) % 7 || 7) + week * 7);
    for (const venue of venues) {
      if (upcoming + added >= 6) break;
      const exists = await tx.accommodations.findFirst({ where: { venue: venue.id, date: dateOf(saturday), cancelled_at: null } });
      if (exists) continue;
      const plan = await tx.venue_plans.findFirst({ where: { venue_id: venue.id, is_active: true }, orderBy: { created_at: 'asc' } });
      if (!plan || !contacts.length) continue;
      const contact = rand.pick(contacts);
      const adults = rand.int(plan.min_guests, plan.max_capacity || plan.min_guests + 10);
      const total = adults * Number(plan.adult_price);
      const advance = roundTo(total * 0.5, 1000);
      const created = new Date(Date.now() - rand.int(1, 72) * 3600000);
      const acc = await tx.accommodations.create({
        data: {
          venue: venue.id, date: dateOf(saturday), time: timeOf(plan.check_in_time || '09:00'), duration: 36000, customer: contact.id,
          adults, children: 0, agreed_price: total, calculated_price: total, plan_id: plan.id, created_by: userId, created_at: created
        }
      });
      const payment = await tx.payments.create({
        data: {
          accommodation: acc.id, amount: advance, payment_method: 'Nequi', payment_date: dateOf(today), type: 'accommodation', notes: 'Anticipo 50%',
          reference: `M${rand.int(10000000, 99999999)}`, verified: true, verified_at: created, verified_by: userId, created_by: userId, created_at: created
        }
      });
      await tx.incomes.create({ data: { payment_id: payment.id, organization_id: orgId, venue_id: venue.id, amount: advance, type: 'accommodation', date: dateOf(today), accrual_date: dateOf(saturday) } });
      await tx.contact_venue.upsert({ where: { venue_contact: { venue: venue.id, contact: contact.id } }, update: {}, create: { venue: venue.id, contact: contact.id, type: 'customer' } });
      added++;
    }
  }
  return added;
}

// ---------- delete ----------

/** Removes everything under the demo organization and its venues (not the user or the organization). */
async function wipeData(tx, { orgId, venueIds, userId }) {
  const V = venueIds;
  const accIds = (await tx.accommodations.findMany({ where: { venue: { in: V } }, select: { id: true } })).map((a) => a.id);
  const A = accIds;
  const run = (sql, ...params) => tx.$executeRawUnsafe(sql, ...params);

  const expenseIds = `(SELECT id FROM expenses WHERE organization_id = $1::uuid OR venue_id = ANY($2::uuid[]) OR accommodation_id = ANY($3::uuid[]))`;
  const itemIds = `(SELECT id FROM inventory_items WHERE organization_id = $1::uuid OR venue_id = ANY($2::uuid[]))`;
  await run(`DELETE FROM expense_inventory_items WHERE expense_id IN ${expenseIds} OR inventory_item_id IN ${itemIds}`, orgId, V, A);
  await run(`DELETE FROM maintenance_supplies WHERE inventory_item_id IN ${itemIds} OR maintenance_log_id IN (SELECT id FROM maintenance_logs WHERE organization_id = $1::uuid OR venue_id = ANY($2::uuid[]))`, orgId, V);
  await run(`DELETE FROM inventory_images WHERE inventory_item_id IN ${itemIds}`, orgId, V);
  await run(`DELETE FROM inventory_movements WHERE inventory_item_id IN ${itemIds} OR organization_id = $1::uuid OR venue_id = ANY($2::uuid[])`, orgId, V);
  await run(`DELETE FROM inventory_items WHERE organization_id = $1::uuid OR venue_id = ANY($2::uuid[])`, orgId, V);
  await run(`DELETE FROM inventory_categories WHERE organization_id = $1::uuid`, orgId);

  // Booking data.
  await run(`DELETE FROM incomes WHERE organization_id = $1::uuid OR venue_id = ANY($2::uuid[]) OR payment_id IN (SELECT id FROM payments WHERE accommodation = ANY($3::uuid[]))`, orgId, V, A);
  await run(`DELETE FROM payments WHERE accommodation = ANY($1::uuid[])`, A);
  await run(`DELETE FROM deposits WHERE accommodation_id = ANY($1::uuid[]) OR venue_id = ANY($2::uuid[]) OR organization_id = $3::uuid`, A, V, orgId);
  await run(`DELETE FROM commission_payments WHERE accommodation_id = ANY($1::uuid[]) OR organization_id = $2::uuid OR venue_id = ANY($3::uuid[])`, A, orgId, V);
  await run(`DELETE FROM contract_amendments WHERE accommodation_id = ANY($1::uuid[])`, A);
  await run(`DELETE FROM contracts WHERE accommodation_id = ANY($1::uuid[])`, A);
  await run(`DELETE FROM bold_payment_events WHERE link_id IN (SELECT id FROM bold_payment_links WHERE accommodation_id = ANY($1::uuid[]) OR venue_id = ANY($2::uuid[]))`, A, V);
  await run(`DELETE FROM bold_payment_links WHERE accommodation_id = ANY($1::uuid[]) OR venue_id = ANY($2::uuid[])`, A, V);
  await run(`DELETE FROM ai_audit_logs WHERE accommodation_id = ANY($1::uuid[]) OR venue_id = ANY($2::uuid[])`, A, V);
  await run(`DELETE FROM expenses WHERE organization_id = $1::uuid OR venue_id = ANY($2::uuid[]) OR accommodation_id = ANY($3::uuid[])`, orgId, V, A);
  await run(`DELETE FROM estimates WHERE venue_id = ANY($1::uuid[]) OR accommodation_id = ANY($2::uuid[])`, V, A);

  // Contacts that only belong to the demo (customers created here or during a demo).
  await run(`
    DELETE FROM contacts c
    WHERE c.user IS NULL
      AND (c.id IN (SELECT contact FROM contact_venue WHERE venue = ANY($1::uuid[]))
        OR c.id IN (SELECT contact FROM contact_organization WHERE organization = $2::uuid)
        OR c.id IN (SELECT customer FROM accommodations WHERE venue = ANY($1::uuid[])))
      AND NOT EXISTS (SELECT 1 FROM contact_venue cv WHERE cv.contact = c.id AND NOT (cv.venue = ANY($1::uuid[])))
      AND NOT EXISTS (SELECT 1 FROM contact_organization co WHERE co.contact = c.id AND co.organization <> $2::uuid)
      AND NOT EXISTS (SELECT 1 FROM accommodations a WHERE a.customer = c.id AND NOT (a.venue = ANY($1::uuid[])))`, V, orgId);
  await run(`DELETE FROM contact_venue WHERE venue = ANY($1::uuid[])`, V);
  await run(`DELETE FROM contact_organization WHERE organization = $1::uuid`, orgId);
  await run(`DELETE FROM accommodations WHERE venue = ANY($1::uuid[])`, V);

  // Venue setup and operations.
  await run(`DELETE FROM chat_conversations WHERE venue_id = ANY($1::uuid[])`, V);
  await run(`DELETE FROM contract_templates WHERE venue_id = ANY($1::uuid[])`, V);
  await run(`DELETE FROM message_templates WHERE venue_id = ANY($1::uuid[])`, V);
  await run(`DELETE FROM pending_tasks WHERE venue_id = ANY($1::uuid[]) OR organization_id = $2::uuid`, V, orgId);
  await run(`DELETE FROM maintenance_logs WHERE venue_id = ANY($1::uuid[]) OR organization_id = $2::uuid`, V, orgId);
  await run(`DELETE FROM maintenance_zones WHERE venue_id = ANY($1::uuid[]) OR organization_id = $2::uuid`, V, orgId);
  await run(`DELETE FROM commission_agents WHERE organization_id = $1::uuid OR venue_id = ANY($2::uuid[])`, orgId, V);
  await run(`DELETE FROM providers WHERE organization_id = $1::uuid`, orgId);
  await run(`DELETE FROM plan_amenities WHERE plan_id IN (SELECT id FROM venue_plans WHERE venue_id = ANY($1::uuid[]))`, V);
  await run(`DELETE FROM plan_images WHERE plan_id IN (SELECT id FROM venue_plans WHERE venue_id = ANY($1::uuid[]))`, V);
  await run(`DELETE FROM package_prices WHERE package IN (SELECT id FROM venue_packages WHERE venue = ANY($1::uuid[]))`, V);
  await run(`DELETE FROM venue_packages WHERE venue = ANY($1::uuid[])`, V);
  for (const table of ['venue_plans', 'venue_images', 'venue_amenities', 'venue_payment_methods', 'whatsapp_connections', 'instagram_connections', 'whatsapp_event_log']) {
    await run(`DELETE FROM ${table} WHERE venue_id = ANY($1::uuid[])`, V);
  }
  await run(`DELETE FROM notifications WHERE user_id = $1 OR organization_id = $2::uuid OR venue_id = ANY($3::uuid[])`, userId, orgId, V);
  await run(`DELETE FROM invitations WHERE organization_id = $1::uuid`, orgId);
  await run(`DELETE FROM venues WHERE id = ANY($1::uuid[])`, V);
  return accIds.length;
}

async function deleteAccount(tx, { user, demo, orgId, venueIds }) {
  await wipeData(tx, { orgId, venueIds, userId: user.id });
  const run = (sql, ...params) => tx.$executeRawUnsafe(sql, ...params);
  await run(`DELETE FROM user_organizations WHERE user_id = $1 OR organization_id = $2::uuid`, user.id, orgId);
  await run(`DELETE FROM subscription_users WHERE user_id = $1`, user.id);
  if (demo.subscription_id) await run(`DELETE FROM subscriptions WHERE id = $1::uuid`, demo.subscription_id);
  for (const table of ['onboarding_progress', 'api_keys', 'passkey_credentials', 'auth_verification_codes', 'notifications']) {
    await run(`DELETE FROM ${table} WHERE user_id = $1`, user.id);
  }
  await run(`DELETE FROM referral_rewards WHERE referrer_id = $1 OR referred_id = $1`, user.id);
  await run(`DELETE FROM sessions WHERE sess::text LIKE $1`, `%"${user.id}"%`);
  await run(`DELETE FROM users WHERE id = $1`, user.id);
  await run(`DELETE FROM organizations WHERE id = $1::uuid`, orgId);
}

// ---------- commands ----------

async function create({ email, password }) {
  if (await prisma.users.findFirst({ where: { email } })) {
    throw new Error(`Ya existe un usuario con ${email}. Usa "reset" para rehacer sus datos o "delete" para borrarlo.`);
  }
  const generated = !password;
  if (generated) password = crypto.randomBytes(9).toString('base64url');
  if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');

  const today = todayBogota();
  const profile = await prisma.profiles.findUnique({ where: { code: 'organization:admin' } });
  if (!profile) throw new Error('No existe el perfil organization:admin (corre los seeds)');
  const userId = `demo_${crypto.randomUUID().split('-')[0]}`;

  const counts = await prisma.$transaction(async (tx) => {
    const org = await tx.organizations.create({ data: { name: ORG_NAME } });
    const subscription = await tx.subscriptions.create({
      data: { name: 'Cuenta demo', description: 'Suscripción de la cuenta de demostración', plan_type: 'owner', max_users: 1, max_organizations: 1 }
    });
    await tx.users.create({
      data: {
        id: userId, email, display_name: 'Usuario Demo', password_hash: await bcrypt.hash(password, 10), role: 'user', profile_id: profile.id,
        preferences: { demo: { organization_id: org.id, subscription_id: subscription.id, anchor: today } }
      }
    });
    await tx.user_organizations.create({ data: { user_id: userId, organization_id: org.id } });
    await tx.subscription_users.create({ data: { subscription_id: subscription.id, user_id: userId, role: 'owner', is_owner: true } });
    await tx.onboarding_progress.create({ data: { user_id: userId, current_step: 99, completed_at: new Date(), data: {} } });
    return seedData(tx, { userId, orgId: org.id, today });
  }, TX);

  console.log(`Cuenta demo creada: ${email}`);
  if (generated) console.log(`Contraseña generada: ${password}  (guárdala; no se vuelve a mostrar)`);
  printCounts(counts);
}

async function refresh({ email }) {
  const ctx = await findDemo(email);
  const today = todayBogota();
  const anchor = ctx.demo.anchor || today;
  const days = Math.round(daysBetween(anchor, today) / 7) * 7;
  const result = await prisma.$transaction(async (tx) => {
    const scope = { orgId: ctx.orgId, venueIds: ctx.venueIds, userId: ctx.user.id };
    const moved = days > 0 ? await shiftDates(tx, scope, days) : 0;
    const added = await ensureUpcoming(tx, scope, today);
    await tx.users.update({
      where: { id: ctx.user.id },
      data: { preferences: { ...ctx.user.preferences, demo: { ...ctx.demo, anchor: addDays(anchor, days) } } }
    });
    return { moved, added };
  }, TX);
  if (days > 0) console.log(`Fechas corridas ${days} días (${result.moved} alquileres).`);
  else console.log('Las fechas ya están al día (se corren por semanas completas).');
  if (result.added) console.log(`Se agregaron ${result.added} alquileres próximos.`);
}

async function reset({ email }) {
  const ctx = await findDemo(email);
  const today = todayBogota();
  const counts = await prisma.$transaction(async (tx) => {
    await wipeData(tx, { orgId: ctx.orgId, venueIds: ctx.venueIds, userId: ctx.user.id });
    await tx.users.update({
      where: { id: ctx.user.id },
      data: { preferences: { ...ctx.user.preferences, demo: { ...ctx.demo, anchor: today } } }
    });
    return seedData(tx, { userId: ctx.user.id, orgId: ctx.orgId, today });
  }, TX);
  console.log(`Datos de ${email} rehechos.`);
  printCounts(counts);
}

async function remove({ email }) {
  const ctx = await findDemo(email);
  await prisma.$transaction((tx) => deleteAccount(tx, ctx), TX);
  console.log(`Cuenta demo ${email} eliminada con su organización y datos.`);
}

function printCounts(counts) {
  const labels = {
    venues: 'cabañas', venue_plans: 'planes', contacts: 'clientes', accommodations: 'alquileres', payments: 'pagos', incomes: 'ingresos',
    deposits: 'depósitos', expenses: 'gastos', commission_payments: 'comisiones', contracts: 'contratos', estimates: 'cotizaciones',
    chat_conversations: 'chats', pending_tasks: 'tareas', maintenance_logs: 'mantenimientos', inventory_items: 'inventario', notifications: 'notificaciones'
  };
  console.log(Object.entries(labels).filter(([k]) => counts[k]).map(([k, label]) => `${counts[k]} ${label}`).join(', '));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const commands = { create, refresh, reset, delete: remove };
  const command = commands[opts.command];
  if (!command) {
    console.error('Uso: node server/scripts/demo-account.js <create|refresh|reset|delete> [--email correo] [--password clave]');
    process.exit(1);
  }
  await command(opts);
}

main()
  .catch((err) => {
    console.error('Error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
