<script setup lang="ts">
defineProps<{
  label?: string
  description: string
  dark?: boolean
}>()
</script>

<template>
  <div class="shot-frame" :class="{ 'shot-frame--dark': dark }">
    <div class="shot-chrome">
      <span></span><span></span><span></span>
      <div class="shot-address">andrea · guided claim preparation</div>
    </div>
    <div class="shot-content">
      <div class="shot-icon">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.5" />
          <path d="m5.5 16 4-3 3 2 2.5-2 3.5 3" />
        </svg>
      </div>
      <div class="shot-label">{{ label || 'APPLICATION SCREENSHOT' }}</div>
      <p>[PLACEHOLDER: {{ description }}]</p>
    </div>
  </div>
</template>
