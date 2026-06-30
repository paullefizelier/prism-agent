<script setup lang="ts">
// Iframe-embedded chat (widget). Bare full-height layout, no site chrome.
// History lives behind a header button that opens a slideover.
definePageMeta({ layout: "embed" });
</script>

<template>
  <SurfChat embedded />
</template>
