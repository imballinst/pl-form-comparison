import type { Config } from '@react-router/dev/config'

export default {
  basename: '/pl-form-comparison',
  // return a list of URLs to prerender at build time
  async prerender() {
    return ['/', '/compare/between-seasons', '/compare/remaining-matches']
  },
} satisfies Config
