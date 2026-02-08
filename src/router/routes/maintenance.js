export default [
  {
    path: '/business/maintenance',
    name: 'MaintenanceBoard',
    component: () => import('@/views/maintenance/MaintenanceBoardView.vue'),
    meta: { breadcrumb: 'Tablero de Mantenimiento' },
  },
  {
    path: '/business/maintenance/logs',
    name: 'MaintenanceLogsList',
    component: () => import('@/views/maintenance/MaintenanceListView.vue'),
    meta: { breadcrumb: 'Registros de Mantenimiento' },
  },
  {
    path: '/business/maintenance/logs/create',
    name: 'MaintenanceLogCreate',
    component: () => import('@/views/maintenance/MaintenanceFormView.vue'),
    meta: { breadcrumb: 'Nuevo Registro' },
  },
  {
    path: '/business/maintenance/logs/:id',
    name: 'MaintenanceLogDetail',
    component: () => import('@/views/maintenance/MaintenanceDetailView.vue'),
    props: true,
    meta: { breadcrumb: 'Detalle de Registro' },
  },
  {
    path: '/business/maintenance/logs/:id/edit',
    name: 'MaintenanceLogEdit',
    component: () => import('@/views/maintenance/MaintenanceFormView.vue'),
    props: true,
    meta: { breadcrumb: 'Editar Registro' },
  },
]
