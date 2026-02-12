<script setup>
import { RouterLink } from 'vue-router'

import { AppSidebarNav } from '@/components/AppSidebarNav.js'
import { useSidebarStore } from '@/stores/sidebar.js'

const sidebar = useSidebarStore()
</script>

<template>
  <CSidebar
    class="border-end cabania-sidebar"
    colorScheme="dark"
    position="fixed"
    :unfoldable="sidebar.unfoldable"
    :visible="sidebar.visible"
    @visible-change="(value) => sidebar.toggleVisible(value)"
  >
    <CSidebarHeader class="border-bottom cabania-sidebar__header">
      <RouterLink custom to="/" v-slot="{ href, navigate }">
        <CSidebarBrand v-bind="$attrs" as="a" :href="href" @click="navigate" class="cabania-sidebar__brand">
          <!-- Full logo -->
          <span class="cabania-sidebar__logo sidebar-brand-full">
            <span class="cabania-sidebar__logo-icon">
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                <path d="M4 20V10.5L12 4l8 6.5V20" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                <path d="M9 20v-6h6v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </span>
            <span class="cabania-sidebar__logo-text">CabanIA</span>
          </span>
          <!-- Narrow/collapsed logo (icon only) -->
          <span class="cabania-sidebar__logo-narrow sidebar-brand-narrow">
            <span class="cabania-sidebar__logo-icon">
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                <path d="M4 20V10.5L12 4l8 6.5V20" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                <path d="M9 20v-6h6v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </span>
          </span>
        </CSidebarBrand>
      </RouterLink>
      <CCloseButton class="d-lg-none" dark @click="sidebar.toggleVisible()" />
    </CSidebarHeader>
    <AppSidebarNav />
    <CSidebarFooter class="border-top d-none d-lg-flex">
      <CSidebarToggler @click="sidebar.toggleUnfoldable()" />
    </CSidebarFooter>
  </CSidebar>
</template>
