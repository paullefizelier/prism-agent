<script setup lang="ts">
import { ref, watchEffect } from 'vue'

const supabase = useSupabaseClient()
const user = useSupabaseUser()

definePageMeta({ layout: 'embed' })

const email = ref('')
const password = ref('')
const errorMsg = ref('')
const loading = ref(false)

// Already signed in → go to the dashboard.
watchEffect(() => {
  if (user.value) navigateTo('/admin')
})

async function login() {
  loading.value = true
  errorMsg.value = ''
  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value
  })
  loading.value = false
  if (error) errorMsg.value = error.message
  else navigateTo('/admin')
}
</script>

<template>
  <UContainer class="py-16 max-w-sm">
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon
            name="i-lucide-waves"
            class="size-5 text-primary"
          />
          <h1 class="font-semibold">
            {{ $t("login.title") }}
          </h1>
        </div>
      </template>

      <form
        class="space-y-4"
        @submit.prevent="login"
      >
        <UFormField :label="$t('login.email')">
          <UInput
            v-model="email"
            type="email"
            autocomplete="email"
            required
            class="w-full"
          />
        </UFormField>
        <UFormField :label="$t('login.password')">
          <UInput
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            class="w-full"
          />
        </UFormField>

        <UAlert
          v-if="errorMsg"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :description="errorMsg"
        />

        <UButton
          type="submit"
          :label="$t('login.submit')"
          :loading="loading"
          block
        />
      </form>
    </UCard>
  </UContainer>
</template>
