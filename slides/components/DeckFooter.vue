<script setup lang="ts">
defineProps<{ page: string; inverse?: boolean }>()
</script>

<template>
  <div class="deck-footer" :class="{ 'deck-footer--inverse': inverse }">
    <span>ANDREA · SMALL CLAIMS, CLEARER NEXT STEPS</span>
    <span>{{ page }}</span>
  </div>
</template>
