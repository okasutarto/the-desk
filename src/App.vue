<template>
  <div class="min-h-screen flex flex-col">
    <router-view v-slot="{ Component }">
      <transition name="page" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
    <SpeedInsights />
  </div>
</template>

<script setup>
import { useTheme } from "./shared/composables/useTheme";
import { inject } from "@vercel/analytics";
import { SpeedInsights } from "@vercel/speed-insights/vue";
import { getVisits } from "./shared/services/visitsApi";

// Apply the visitor's theme before either experience paints.
useTheme().initTheme();
inject();
// Count the visit whichever page it lands on (the Times Gate shows the same answer)
getVisits().catch(() => {});
</script>
