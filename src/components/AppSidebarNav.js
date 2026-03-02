import { defineComponent, h, onMounted, ref, resolveComponent, computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { cilExternalLink } from '@coreui/icons'
import { CBadge, CSidebarNav, CNavItem, CNavGroup, CNavTitle } from '@coreui/vue'
import nav from '@/_nav.js'
import { useSettingsStore } from '@/stores/settings.js'
import { useAuth } from '@/composables/useAuth'

import simplebar from 'simplebar-vue'
import 'simplebar-vue/dist/simplebar.min.css'

const devOnlySections = ['Theme', 'Components', 'Extras']

const normalizePath = (path) =>
  decodeURI(path)
    .replace(/#.*$/, '')
    .replace(/(index)?\.(html)$/, '')

const isActiveLink = (route, link) => {
  if (link === undefined) {
    return false
  }

  if (route.hash === link) {
    return true
  }

  const currentPath = normalizePath(route.path)
  const targetPath = normalizePath(link)

  return currentPath === targetPath
}

const isActiveItem = (route, item) => {
  if (isActiveLink(route, item.to)) {
    return true
  }

  if (item.items) {
    return item.items.some((child) => isActiveItem(route, child))
  }

  return false
}

/**
 * Check if user has a permission (supports :own suffix matching).
 * e.g. user has 'accommodations:view:own' → matches required 'accommodations:view'
 */
function userHasPermission(userPerms, requiredPerm) {
  if (!requiredPerm) return true
  if (!userPerms || userPerms.length === 0) return false
  return userPerms.some(p => p === requiredPerm || p.startsWith(requiredPerm + ':'))
}

const AppSidebarNav = defineComponent({
  name: 'AppSidebarNav',
  components: {
    CNavItem,
    CNavGroup,
    CNavTitle,
  },
  setup() {
    const route = useRoute()
    const settingsStore = useSettingsStore()
    const { user } = useAuth()
    const firstRender = ref(true)

    onMounted(() => {
      firstRender.value = false
    })

    const userPermissions = computed(() => user.value?.profile?.permissions || [])
    const isSuperAdmin = computed(() => user.value?.is_super_admin === true)

    const filteredNav = computed(() => {
      if (settingsStore.developmentMode) {
        return nav
      }

      // Super admins see everything (skip permission checks)
      const checkPerms = !isSuperAdmin.value && userPermissions.value.length > 0

      // First pass: filter by devOnly sections and permissions
      let skip = false
      const filtered = nav.filter(item => {
        if (item.devOnly) {
          return false
        }
        if (item.component === 'CNavTitle' && devOnlySections.includes(item.name)) {
          skip = true
          return false
        }
        if (item.component === 'CNavTitle' && !devOnlySections.includes(item.name)) {
          skip = false
        }
        if (skip) return false

        // Permission check (only when user has a restricted profile)
        if (checkPerms && item.permission) {
          return userHasPermission(userPermissions.value, item.permission)
        }

        return true
      })

      // Second pass: remove CNavTitle items that have no visible items after them
      const result = []
      for (let i = 0; i < filtered.length; i++) {
        const item = filtered[i]
        if (item.component === 'CNavTitle') {
          // Check if there's at least one non-title item after this title before the next title
          let hasItems = false
          for (let j = i + 1; j < filtered.length; j++) {
            if (filtered[j].component === 'CNavTitle') break
            hasItems = true
            break
          }
          if (hasItems) result.push(item)
        } else {
          result.push(item)
        }
      }

      return result
    })

    const renderItem = (item) => {
      if (item.items) {
        return h(
          CNavGroup,
          {
            as: 'div',
            compact: true,
            ...(firstRender.value && {
              visible: item.items.some((child) => isActiveItem(route, child)),
            }),
          },
          {
            togglerContent: () => [
              h(resolveComponent('CIcon'), {
                customClassName: 'nav-icon',
                name: item.icon,
              }),
              item.name,
            ],
            default: () => item.items.map((child) => renderItem(child)),
          },
        )
      }

      if (item.href) {
        return h(
          resolveComponent(item.component),
          {
            href: item.href,
            target: '_blank',
            rel: 'noopener noreferrer',
          },
          {
            default: () => [
              item.icon
                ? h(resolveComponent('CIcon'), {
                    customClassName: 'nav-icon',
                    name: item.icon,
                  })
                : h('span', { class: 'nav-icon' }, h('span', { class: 'nav-icon-bullet' })),
              item.name,
              item.external && h(resolveComponent('CIcon'), {
                class: 'ms-2',
                name: 'cil-external-link',
                size: 'sm'
              }),
              item.badge &&
                h(
                  CBadge,
                  {
                    class: 'ms-auto',
                    color: item.badge.color,
                    size: 'sm',
                  },
                  {
                    default: () => item.badge.text,
                  },
                ),
            ],
          },
        )
      }

      return item.to
        ? h(
            RouterLink,
            {
              to: item.to,
              custom: true,
            },
            {
              default: (props) =>
                h(
                  resolveComponent(item.component),
                  {
                    active: props.isActive,
                    as: 'div',
                    href: props.href,
                    onClick: () => props.navigate(),
                  },
                  {
                    default: () => [
                      item.icon
                        ? h(resolveComponent('CIcon'), {
                            customClassName: 'nav-icon',
                            name: item.icon,
                          })
                        : h('span', { class: 'nav-icon' }, h('span', { class: 'nav-icon-bullet' })),
                      item.name,
                      item.badge &&
                        h(
                          CBadge,
                          {
                            class: 'ms-auto',
                            color: item.badge.color,
                            size: 'sm',
                          },
                          {
                            default: () => item.badge.text,
                          },
                        ),
                    ],
                  },
                ),
            },
          )
        : h(
            resolveComponent(item.component),
            {
              as: 'div',
            },
            {
              default: () => item.name,
            },
          )
    }

    return () =>
      h(
        CSidebarNav,
        {
          as: simplebar,
        },
        {
          default: () => filteredNav.value.map((item) => renderItem(item)),
        },
      )
  },
})

export { AppSidebarNav }
