// Reusable markdown renderer for assistant messages, mirroring the official
// Nuxt UI chat template (github.com/nuxt-ui-templates/chat).
// Auto-imported as <ChatComark>. defineComarkComponent comes from @comark/nuxt.
// (No syntax-highlight plugin: this advisor doesn't output code. Add
//  `plugins: [highlight({ languages: [...] })]` here later if ever needed.)
export default defineComarkComponent({
  name: 'ChatComark',
  class: '*:first:mt-0 *:last:mb-0'
})
