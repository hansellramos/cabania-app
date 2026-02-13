<script setup>
import { RouterLink } from 'vue-router'

import { logo } from '@/assets/brand/logo'
import { sygnet } from '@/assets/brand/sygnet'
import { AppSidebarNav } from '@/components/AppSidebarNav.js'
import { useSidebarStore } from '@/stores/sidebar.js'

const sidebar = useSidebarStore()
</script>

<template>
  <CSidebar
    class="border-end"
    colorScheme="dark"
    position="fixed"
    :unfoldable="sidebar.unfoldable"
    :visible="sidebar.visible"
    @visible-change="(value) => sidebar.toggleVisible(value)"
  >
    <CSidebarHeader class="border-bottom">
      <RouterLink custom to="/" v-slot="{ href, navigate }">
        <CSidebarBrand v-bind="$attrs" as="a" :href="href" @click="navigate">
          <!-- Full logo (expanded sidebar) -->
          <div class="cabania-sidebar-logo sidebar-brand-full">
            <span class="cabania-sidebar-logo__icon">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                <path d="M4 20V10.5L12 4l8 6.5V20" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                <path d="M9 20v-6h6v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </span>
            <span class="cabania-sidebar-logo__text">CabanIA</span>
          </div>
          <!-- Narrow logo (collapsed sidebar) -->
          <div class="cabania-sidebar-logo sidebar-brand-narrow">
            <span class="cabania-sidebar-logo__icon">
              <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                <path d="M4 20V10.5L12 4l8 6.5V20" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                <path d="M9 20v-6h6v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </span>
          </div>
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
