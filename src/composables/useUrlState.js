// Keep filters, tabs and similar view state in the URL query, so a filtered view
// can be linked (by people or the in-app assistant), survives a reload, and the
// back button returns to it.
//
//   const filters = reactive({ status: '', from: '' })
//   useUrlState([
//     urlField(filters, 'status'),
//     urlField(filters, 'from'),
//     urlRef(searchQuery, 'q'),
//     urlTab(activeTab, ['resumen', 'pagos', 'contrato']),
//   ])
//
// Values equal to their default are left out of the URL. Changes use
// router.replace, so typing in a search box does not flood the history.
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

function parse(raw, type) {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value === undefined || value === null) return undefined
  if (type === 'number') {
    const n = Number(value)
    return Number.isFinite(n) ? n : undefined
  }
  if (type === 'boolean') return value === '1' || value === 'true'
  if (type === 'array') return String(value).split(',').filter(Boolean)
  return String(value)
}

function serialize(value, type) {
  if (value === undefined || value === null || value === '') return undefined
  if (type === 'boolean') return value ? '1' : undefined
  if (type === 'array') return Array.isArray(value) && value.length ? value.join(',') : undefined
  return String(value)
}

/** A field of a reactive object (e.g. filters.status) bound to ?param. */
export function urlField(obj, key, { param = key, type = 'string', default: def } = {}) {
  const initial = def !== undefined ? def : obj[key]
  return { param, type, default: initial, get: () => obj[key], set: (v) => { obj[key] = v } }
}

/** A ref (e.g. a search box or a view mode) bound to ?param. */
export function urlRef(ref, param, { type = 'string', default: def } = {}) {
  const initial = def !== undefined ? def : ref.value
  return { param, type, default: initial, get: () => ref.value, set: (v) => { ref.value = v } }
}

/**
 * A numeric tab index bound to ?tab=<name>. Tabs go by name, so links keep
 * working if tabs are reordered.
 */
export function urlTab(indexRef, names, { param = 'tab' } = {}) {
  const initial = indexRef.value
  return {
    param,
    type: 'string',
    default: names[initial],
    get: () => names[indexRef.value],
    set: (v) => {
      const i = names.indexOf(v)
      indexRef.value = i >= 0 ? i : initial
    },
  }
}

/**
 * @param bindings from urlField / urlRef / urlTab
 * @param onRouteChange runs after back/forward changed the state, for views
 *   that load data with the filters (the initial load stays in onMounted).
 */
export function useUrlState(bindings, { onRouteChange } = {}) {
  const route = useRoute()
  const router = useRouter()
  const path = route.path

  // URL -> state. A missing param means the default.
  const read = () => {
    for (const b of bindings) {
      const parsed = parse(route.query[b.param], b.type)
      const next = parsed === undefined ? b.default : parsed
      if (serialize(b.get(), b.type) !== serialize(next, b.type)) b.set(Array.isArray(next) ? [...next] : next)
    }
  }
  read()

  // state -> URL
  watch(
    () => bindings.map(b => serialize(b.get(), b.type)),
    (values) => {
      if (route.path !== path) return
      const query = { ...route.query }
      bindings.forEach((b, i) => {
        if (values[i] === undefined || values[i] === serialize(b.default, b.type)) delete query[b.param]
        else query[b.param] = values[i]
      })
      const same = Object.keys(query).length === Object.keys(route.query).length
        && Object.keys(query).every(k => String(route.query[k]) === String(query[k]))
      if (!same) router.replace({ query })
    },
  )

  // Back/forward within the same view
  watch(() => route.query, () => {
    if (route.path !== path) return
    const before = bindings.map(b => serialize(b.get(), b.type)).join('|')
    read()
    if (onRouteChange && bindings.map(b => serialize(b.get(), b.type)).join('|') !== before) onRouteChange()
  })
}
