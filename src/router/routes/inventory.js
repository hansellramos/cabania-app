export default [
  {
    path: '/business/inventory',
    name: 'InventoryList',
    component: () => import('@/views/inventory/InventoryListView.vue'),
    meta: { breadcrumb: 'Inventario' },
  },
  {
    path: '/business/inventory/create',
    name: 'InventoryCreate',
    component: () => import('@/views/inventory/InventoryFormView.vue'),
    meta: { breadcrumb: 'Crear Item' },
  },
  {
    path: '/business/inventory/:id/edit',
    name: 'InventoryEdit',
    component: () => import('@/views/inventory/InventoryFormView.vue'),
    props: true,
    meta: { breadcrumb: 'Editar Item' },
  },
]
