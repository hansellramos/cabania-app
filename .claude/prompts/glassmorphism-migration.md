# Plan: Migración Glassmorphism Global — Light + Dark Mode

## Contexto

La app tiene un estilo Glassmorphism que funciona correctamente en la página de Login (con soporte light y dark), pero en el resto de la app (DefaultLayout) los estilos son **dark-only**. Han habido 3 intentos fallidos de migrar. El análisis detallado reveló las causas raíz:

1. **Intento 1**: Aplicó estilos dark en `body`/`:root` sin scoping, rompió Login. Usó `!important` en cascada. Revertido completamente.
2. **Intento 2**: Intentó usar `var(--cabania-*)` en `<style scoped>` de Login pero las variables de `:root` no se resolvían a tiempo (Vite CSS ordering). Revertido.
3. **Intento 3** (actual): Scoped a `.wrapper` — funciona para dark mode pero **no tiene light mode**. El `:root` define tokens con valores dark, `body` los aplica globalmente. No hay alternativa light.

**Insight clave**: El Login.vue tiene el patrón correcto — define light defaults y dark overrides en CSS vars locales. La migración global debe replicar esto usando `[data-coreui-theme="dark"]` (el selector que CoreUI ya maneja).

## Arquitectura de Temas CoreUI

### Cómo funciona el tema en CoreUI
- `useColorModes('coreui-free-vue-admin-template-theme')` composable de `@coreui/vue`
- Almacena preferencia en `localStorage['coreui-free-vue-admin-template-theme']`
- Setea atributo `data-coreui-theme` en `<html>` en runtime (light, dark, o auto)
- `coreui.min.css` tiene reglas `[data-coreui-theme="dark"]` para dark mode
- En SCSS: `@include color-mode(dark) { ... }` genera `[data-coreui-theme=dark]` selectors

### Archivos clave del tema
- `src/components/AppHeader.vue` — Único control point del tema (dropdown light/dark/auto)
- `src/main.js` — Importa `coreui.min.css` + `@/assets/style.css`
- `src/styles/style.scss` — **520 líneas** de estilos custom + Glassmorphism
- `src/views/pages/Login.vue` — Implementación dual-theme independiente (scoped CSS)
- `src/stores/theme.js` — Pinia store **NO USADO** (artifact muerto)
- `src/components/AppSidebar.vue` — Tiene `colorScheme="dark"` hardcoded

### Flujo del layout
```
App.vue → router-view
  ├── Login.vue (ruta /login — SIN .wrapper, fuera de DefaultLayout)
  └── DefaultLayout.vue
       ├── AppSidebar (.sidebar)
       └── div.wrapper
            ├── TrialBanner
            ├── AppHeader (.header)
            ├── div.body > CContainer > router-view (vistas de la app)
            └── AppFooter (.footer)
```

## Principios de la Migración

1. **`:root`** define tokens **light** (nuevos defaults) — Glassmorphism sobre fondo claro
2. **`[data-coreui-theme="dark"]`** redefine tokens a valores dark (los actuales)
3. **`.wrapper`** scoping se mantiene — Login nunca se afecta
4. **Modals/dropdowns** usan variables (no hardcoded `#0f172a`)
5. **Sidebar** se hace theme-aware (remove `colorScheme="dark"`)
6. **Cero `!important` nuevos** — solo mantener los 6 existentes donde CoreUI utilities lo requieren

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/styles/style.scss` | Refactorizar tokens `:root` + dark overrides, fix hardcoded colors |
| `src/components/AppSidebar.vue` | Remover `colorScheme="dark"` (1 línea) |

**NO se toca**: Login.vue, DefaultLayout.vue, AppHeader.vue, main.js, vistas individuales.

## Paso 1: Bifurcar tokens `:root` en light + dark

### Tokens Light (nuevos defaults en `:root`)

Reemplazar las líneas 13-58 de `style.scss`:

```scss
:root {
  // Backgrounds
  --cabania-bg: #f1f5f9;
  --cabania-card-bg: rgba(255, 255, 255, 0.65);
  --cabania-input-bg: rgba(255, 255, 255, 0.6);
  --cabania-hover-bg: rgba(0, 0, 0, 0.03);
  --cabania-active-bg: rgba(16, 185, 129, 0.08);
  --cabania-surface-bg: rgba(255, 255, 255, 0.85);  // NEW: modals, dropdowns

  // Borders
  --cabania-border: rgba(0, 0, 0, 0.08);
  --cabania-border-subtle: rgba(0, 0, 0, 0.05);
  --cabania-active-border: rgba(16, 185, 129, 0.15);
  --cabania-focus-border: rgba(14, 165, 233, 0.4);

  // Text
  --cabania-text: #0f172a;
  --cabania-text-secondary: #475569;
  --cabania-text-muted: #64748b;
  --cabania-text-dim: #94a3b8;

  // Accent colors (ligeramente más oscuros para fondo claro)
  --cabania-emerald: #059669;
  --cabania-sky: #0284c7;
  --cabania-gradient: linear-gradient(135deg, #10b981, #0ea5e9);

  // Accent with opacity
  --cabania-emerald-glow: rgba(16, 185, 129, 0.1);
  --cabania-emerald-glow-subtle: rgba(16, 185, 129, 0.05);
  --cabania-sky-glow: rgba(14, 165, 233, 0.1);

  // Danger
  --cabania-danger-border: rgba(239, 68, 68, 0.2);
  --cabania-danger-bg: rgba(239, 68, 68, 0.06);
  --cabania-danger-text: #dc2626;

  // Shadows (lighter for light bg)
  --cabania-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.08);
  --cabania-shadow-sm: 0 2px 8px rgba(16, 185, 129, 0.1);
  --cabania-shadow-md: 0 4px 12px rgba(16, 185, 129, 0.1);

  // Radii (sin cambio)
  --cabania-radius-sm: 0.5rem;
  --cabania-radius: 0.75rem;
  --cabania-radius-lg: 1rem;
  --cabania-radius-xl: 1.5rem;
}
```

### Tokens Dark (agregar NUEVO bloque después del `:root`)

Agregar inmediatamente después del bloque `:root` usando CoreUI's mixin:

```scss
@include color-mode(dark) {
  :root {
    --cabania-bg: #020617;
    --cabania-card-bg: rgba(255, 255, 255, 0.05);
    --cabania-input-bg: rgba(2, 6, 23, 0.4);
    --cabania-hover-bg: rgba(255, 255, 255, 0.05);
    --cabania-active-bg: rgba(16, 185, 129, 0.15);
    --cabania-surface-bg: #0f172a;

    --cabania-border: rgba(255, 255, 255, 0.15);
    --cabania-border-subtle: rgba(255, 255, 255, 0.1);
    --cabania-active-border: rgba(16, 185, 129, 0.25);
    --cabania-focus-border: rgba(14, 165, 233, 0.5);

    --cabania-text: #f1f5f9;
    --cabania-text-secondary: #cbd5e1;
    --cabania-text-muted: #94a3b8;
    --cabania-text-dim: #64748b;

    --cabania-emerald: #10b981;
    --cabania-sky: #0ea5e9;

    --cabania-emerald-glow: rgba(16, 185, 129, 0.2);
    --cabania-emerald-glow-subtle: rgba(16, 185, 129, 0.1);
    --cabania-sky-glow: rgba(14, 165, 233, 0.2);

    --cabania-danger-border: rgba(239, 68, 68, 0.3);
    --cabania-danger-bg: rgba(239, 68, 68, 0.1);
    --cabania-danger-text: #fca5a5;

    --cabania-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
    --cabania-shadow-sm: 0 2px 8px rgba(16, 185, 129, 0.15);
    --cabania-shadow-md: 0 4px 12px rgba(16, 185, 129, 0.15);
  }
}
```

## Paso 2: Fix hardcoded dark colors en overrides

Reemplazar los 2 valores `#0f172a` hardcoded en los bloques de modals y dropdowns:

```scss
// Antes (línea ~279):
.modal-content { background-color: #0f172a; ... }

// Después:
.modal-content { background-color: var(--cabania-surface-bg); ... }

// Antes (línea ~264):
.wrapper .dropdown-menu { --cui-dropdown-bg: #0f172a; ... }

// Después:
.wrapper .dropdown-menu { --cui-dropdown-bg: var(--cabania-surface-bg); ... }
```

## Paso 3: Eliminar bloque `@include color-mode(dark)` viejo (L115-123)

El bloque actual en líneas 115-123 overridea body bg con `var(--cui-dark-bg-subtle)`. Esto conflicta con nuestro sistema. **Eliminarlo completo**:

```scss
// ELIMINAR este bloque completo (líneas 115-123 de style.scss):
@include color-mode(dark) {
  body { background-color: var(--cui-dark-bg-subtle); }
  .footer { --cui-footer-bg: var(--cui-body-bg); }
}
```

El footer dark ya está cubierto por `.wrapper .footer` (L194-198). Y el body dark bg viene de nuestro nuevo token `--cabania-bg` que cambia a `#020617` en dark mode.

## Paso 4: Verificar `body` y `.wrapper` rules (sin cambio)

Las reglas en líneas 60-72 ya consumen `var(--cabania-bg)` y `var(--cabania-text)`, así que automáticamente cambiarán con el tema. **No necesitan cambio**:

```scss
// Estas líneas NO se tocan:
body {
  background-color: var(--cabania-bg);  // → #f1f5f9 light, #020617 dark
  color: var(--cabania-text);           // → #0f172a light, #f1f5f9 dark
}

.wrapper {
  // ...
  background-color: var(--cabania-bg);
  color: var(--cabania-text);
}
```

## Paso 5: Hacer sidebar theme-aware

**`src/components/AppSidebar.vue`** línea 15:

```vue
<!-- Antes: -->
<CSidebar class="border-end" colorScheme="dark" position="fixed" ...>

<!-- Después: -->
<CSidebar class="border-end" position="fixed" ...>
```

CoreUI's `colorScheme="dark"` fuerza `data-coreui-color-scheme="dark"` en el sidebar, lo cual override las variables CSS. Al quitarlo, el sidebar respeta las variables `--cabania-*` que ya definimos en `.sidebar` (L360-396 de style.scss).

Las reglas existentes de `.sidebar` consumen `var(--cabania-*)` → automáticamente se adaptan cuando los tokens cambian entre light/dark.

## Paso 6: Glass Stat Cards (Dashboard + Analytics)

Las 13 stat cards usan `bg-success text-white`, `bg-primary text-white`, etc. con fondos sólidos. Se reemplazan con glassmorphism con tinte de color.

### 6a. Nuevas clases SCSS al final de `style.scss`

```scss
// --- Glass stat cards ---
.wrapper .cabania-glass {
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid;
  transition: background-color 0.3s, border-color 0.3s, color 0.3s;

  .cabania-glass__label { opacity: 0.6; }

  // Color variants (light mode defaults)
  &--success  { background-color: rgba(16, 185, 129, 0.08) !important;  border-color: rgba(16, 185, 129, 0.2);  color: #059669; }
  &--danger   { background-color: rgba(239, 68, 68, 0.08) !important;   border-color: rgba(239, 68, 68, 0.2);   color: #dc2626; }
  &--warning  { background-color: rgba(245, 158, 11, 0.08) !important;  border-color: rgba(245, 158, 11, 0.2);  color: #d97706; }
  &--primary  { background-color: rgba(99, 102, 241, 0.08) !important;  border-color: rgba(99, 102, 241, 0.2);  color: #4f46e5; }
  &--info     { background-color: rgba(14, 165, 233, 0.08) !important;  border-color: rgba(14, 165, 233, 0.2);  color: #0284c7; }
  &--secondary { background-color: rgba(100, 116, 139, 0.08) !important; border-color: rgba(100, 116, 139, 0.2); color: #475569; }
  &--dark     { background-color: rgba(30, 41, 59, 0.08) !important;    border-color: rgba(30, 41, 59, 0.2);    color: #1e293b; }
}

@include color-mode(dark) {
  .wrapper .cabania-glass {
    &--success  { background-color: rgba(16, 185, 129, 0.15) !important;  border-color: rgba(16, 185, 129, 0.25);  color: #10b981; }
    &--danger   { background-color: rgba(239, 68, 68, 0.15) !important;   border-color: rgba(239, 68, 68, 0.25);   color: #f87171; }
    &--warning  { background-color: rgba(245, 158, 11, 0.15) !important;  border-color: rgba(245, 158, 11, 0.25);  color: #fbbf24; }
    &--primary  { background-color: rgba(99, 102, 241, 0.15) !important;  border-color: rgba(99, 102, 241, 0.25);  color: #818cf8; }
    &--info     { background-color: rgba(14, 165, 233, 0.15) !important;  border-color: rgba(14, 165, 233, 0.25);  color: #38bdf8; }
    &--secondary { background-color: rgba(100, 116, 139, 0.15) !important; border-color: rgba(100, 116, 139, 0.25); color: #94a3b8; }
    &--dark     { background-color: rgba(30, 41, 59, 0.15) !important;    border-color: rgba(30, 41, 59, 0.25);    color: #cbd5e1; }
  }
}
```

### 6b. Cambios en templates

**Dashboard.vue** — 9 cards:
- `text-white bg-secondary` → `cabania-glass cabania-glass--secondary`
- `text-white bg-dark` → `cabania-glass cabania-glass--dark`
- `text-white bg-info` → `cabania-glass cabania-glass--info` (×2)
- `text-white bg-primary` → `cabania-glass cabania-glass--primary` (×2)
- `text-white bg-warning` → `cabania-glass cabania-glass--warning`
- `text-white bg-success` → `cabania-glass cabania-glass--success` (×2)
- Todos los `text-white-50` → `cabania-glass__label`

**AnalyticsView.vue** — 4 cards:
- `text-white bg-success` → `cabania-glass cabania-glass--success`
- `text-white bg-danger` → `cabania-glass cabania-glass--danger`
- `text-white bg-warning` → `cabania-glass cabania-glass--warning`
- `text-white bg-primary` → `cabania-glass cabania-glass--primary`
- Todos los `text-white-50` → `cabania-glass__label`

## Paso 7 (opcional): Sidebar light mode refinement

Si el sidebar en light mode no se ve bien, agregar `backdrop-filter: blur(8px)` al `.sidebar`. Se evalúa durante testing.

## Resumen de todos los cambios

### `style.scss`

| Sección | Líneas | Acción |
|---------|--------|--------|
| `:root` tokens | 13-58 | Reemplazar: dark values → light values + `--cabania-surface-bg` |
| (nuevo bloque) | después de `:root` | Agregar `@include color-mode(dark) { :root { ... } }` |
| `@include color-mode(dark)` viejo | 115-123 | **ELIMINAR** completo |
| `.wrapper .dropdown-menu` bg | ~264 | `#0f172a` → `var(--cabania-surface-bg)` |
| `.modal-content` bg | ~279 | `#0f172a` → `var(--cabania-surface-bg)` |
| (nuevo al final) | — | `.cabania-glass` + variantes light/dark |

### Otros archivos

| Archivo | Cambio |
|---------|--------|
| `AppSidebar.vue` L15 | Remover `colorScheme="dark"` |
| `Dashboard.vue` | 9 cards: clases → `cabania-glass--*` + labels |
| `AnalyticsView.vue` | 4 cards: clases → `cabania-glass--*` + labels |

**Total**: ~120 líneas en style.scss + 1 línea AppSidebar + ~26 cambios de clase en templates.

## ¿Por qué esto NO va a fallar?

1. **Login está aislada**: Scoped styles + `.wrapper` scoping = Login nunca se afecta
2. **CoreUI no se pelea**: Usamos su propio `@include color-mode(dark)` mixin, no selectores custom
3. **Cambio mínimo**: Solo movemos tokens de lugar y agregamos light defaults. Las ~300 líneas de overrides de `.wrapper` NO se tocan
4. **Variables se resuelven en cascade**: `:root` → `[data-coreui-theme=dark] :root` override. Todos los `var()` consumen automáticamente el valor correcto
5. **Sin `!important` nuevos**: Los 6 existentes se mantienen, no se agregan más
6. **Incremental**: Se puede testear después de cada paso

## Diferencia con los intentos fallidos

| Aspecto | Intento 1 (fallido) | Intento 2 (fallido) | Intento 3 (parcial) | Este plan |
|---------|--------------------|--------------------|--------------------|-----------|
| Scope de overrides | `body`, bare selectors | `:root` solo | `.wrapper` scoped | `.wrapper` scoped |
| Login isolation | Ninguna | var() en scoped CSS falló | Login fuera de .wrapper | Login fuera de .wrapper |
| CoreUI integration | Peleó con !important | N/A | Usó --cui-* variables | Usa --cui-* + color-mode() mixin |
| Light/dark support | Solo dark | Solo dark tokens | Solo dark | **Ambos** |
| !important count | 12+ | 0 | ~6 | ~6 (sin nuevos) |

## Verificación

1. **Build local**: `npm run dev` — verificar que compila sin errores SCSS
2. **Light mode**: Navegar por Dashboard, formularios, tablas — verificar glassmorphism light
3. **Dark mode**: Toggle a dark — verificar que se mantiene el look actual exacto
4. **Login**: Verificar que Login light y dark siguen exactamente igual (no se tocó)
5. **Sidebar**: Verificar que cambia correctamente entre light y dark
6. **Modals**: Abrir un modal en ambos temas — verificar backgrounds
7. **Theme toggle**: Alternar rápido entre light/dark/auto — sin parpadeo, transición suave

## Componentes CoreUI usados en la app (referencia)

88 tipos de componentes únicos usados. Los más relevantes para tema:
- CCard, CTable, CForm*, CModal, CDropdown, CNav, CPagination, CBadge
- CWidgetStats*, CChart* (charts usan colores hardcoded en JS — fuera de scope)
- CSidebar (el único que necesita cambio de prop)

## Archivos con scoped styles (34 archivos)

Ninguno debería necesitar cambios porque:
- Usan clases CoreUI que se adaptan via CSS variables
- Los pocos que tienen colores inline usan `var(--cui-*)` correctamente
- Login.vue tiene su propio sistema aislado `--cl-*`
