export default [
  {
    path: '/business/pending-tasks',
    name: 'PendingTaskList',
    component: () => import('@/views/pending-tasks/PendingTaskListView.vue'),
    meta: { breadcrumb: 'Tareas Pendientes' },
  },
  {
    path: '/business/pending-tasks/create',
    name: 'PendingTaskCreate',
    component: () => import('@/views/pending-tasks/PendingTaskFormView.vue'),
    meta: { breadcrumb: 'Nueva Tarea' },
  },
  {
    path: '/business/pending-tasks/:id/edit',
    name: 'PendingTaskEdit',
    component: () => import('@/views/pending-tasks/PendingTaskFormView.vue'),
    props: true,
    meta: { breadcrumb: 'Editar Tarea' },
  },
]
