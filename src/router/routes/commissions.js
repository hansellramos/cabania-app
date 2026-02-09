export default [
  {
    path: '/business/commissions/agents',
    name: 'CommissionAgentList',
    component: () => import('@/views/commissions/CommissionAgentListView.vue'),
    meta: { breadcrumb: 'Comisionistas' },
  },
  {
    path: '/business/commissions/agents/create',
    name: 'CommissionAgentCreate',
    component: () => import('@/views/commissions/CommissionAgentFormView.vue'),
    meta: { breadcrumb: 'Nuevo Comisionista' },
  },
  {
    path: '/business/commissions/agents/:id/edit',
    name: 'CommissionAgentEdit',
    component: () => import('@/views/commissions/CommissionAgentFormView.vue'),
    props: true,
    meta: { breadcrumb: 'Editar Comisionista' },
  },
  {
    path: '/business/commissions/payments',
    name: 'CommissionPaymentList',
    component: () => import('@/views/commissions/CommissionPaymentListView.vue'),
    meta: { breadcrumb: 'Pagos de Comisiones' },
  },
]
