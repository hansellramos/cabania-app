export default [
  {
    path: '/business/inventory',
    name: 'InventoryList',
    component: () => import('@/views/inventory/InventoryListView.vue'),
    meta: { breadcrumb: 'Inventario', permission: 'inventory:view' },
  },
  {
    path: '/business/inventory/create',
    name: 'InventoryCreate',
    component: () => import('@/views/inventory/InventoryFormView.vue'),
    meta: { breadcrumb: 'Crear Item', permission: 'inventory:view' },
  },
  {
    path: '/business/inventory/:id/edit',
    name: 'InventoryEdit',
    component: () => import('@/views/inventory/InventoryFormView.vue'),
    props: true,
    meta: { breadcrumb: 'Editar Item', permission: 'inventory:view' },
  },
]
