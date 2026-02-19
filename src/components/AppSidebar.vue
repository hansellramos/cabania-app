<script setup>
import { RouterLink } from 'vue-router'

import { AppSidebarNav } from '@/components/AppSidebarNav.js'
import { useSidebarStore } from '@/stores/sidebar.js'

const sidebar = useSidebarStore()
</script>

<template>
  <CSidebar
    class="border-end"
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
            <img src="/logo.svg" alt="CabanIA" class="cabania-sidebar-logo__icon" />
            <img src="/logo-wordmark.svg" alt="CabanIA" class="cabania-sidebar-logo__wordmark" />
          </div>
          <!-- Narrow logo (collapsed sidebar) -->
          <div class="cabania-sidebar-logo sidebar-brand-narrow">
            <img src="/logo.svg" alt="CabanIA" class="cabania-sidebar-logo__icon" />
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
