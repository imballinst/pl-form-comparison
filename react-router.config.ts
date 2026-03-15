import type { Config } from '@react-router/dev/config'

export default {
  basename: import.meta.env.PROD ? '/pl-form-comparison/' : '/',
  ssr: false,
  prerender: true,
} satisfies Config
