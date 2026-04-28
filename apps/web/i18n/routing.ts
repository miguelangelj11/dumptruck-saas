import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['en', 'es', 'fr', 'uk', 'ru'],
  defaultLocale: 'en',
  localeDetection: false,
})
