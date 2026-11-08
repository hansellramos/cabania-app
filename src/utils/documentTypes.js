// Identity documents a guest can have (same list as server/lib/contactFields.js).
export const DOCUMENT_TYPES = {
  CC: 'Cédula de ciudadanía',
  CE: 'Cédula de extranjería',
  TI: 'Tarjeta de identidad',
  PA: 'Pasaporte',
  PPT: 'Permiso por protección temporal',
  NIT: 'NIT',
}

/** Passports and foreign ids carry letters; the rest are only digits. */
export const documentAllowsLetters = (type) => ['PA', 'CE', 'PPT'].includes(type)
