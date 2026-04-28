'use client'

import { useState } from 'react'
import { Globe } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const LANGUAGES = [
  { code: 'en', label: 'English',    flag: '🇺🇸' },
  { code: 'es', label: 'Español',    flag: '🇪🇸' },
  { code: 'fr', label: 'Français',   flag: '🇫🇷' },
  { code: 'uk', label: 'Українська', flag: '🇺🇦' },
  { code: 'ru', label: 'Русский',    flag: '🇷🇺' },
]

type Props = {
  companyId?: string
}

export default function LanguageSelector({ companyId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const current = typeof document !== 'undefined'
    ? LANGUAGES.find(l => document.cookie.includes(`NEXT_LOCALE=${l.code}`)) ?? LANGUAGES[0]!
    : LANGUAGES[0]!

  async function selectLocale(code: string) {
    document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=31536000; SameSite=Lax`
    setOpen(false)

    if (companyId) {
      const supabase = createClient()
      await supabase.from('companies').update({ preferred_language: code }).eq('id', companyId)
    }

    router.refresh()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-white/8"
      >
        <Globe className="h-4 w-4" />
        <span>{current.flag} {current.label}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 mb-1 z-20 bg-white rounded-xl border border-gray-200 shadow-xl py-1 min-w-[160px]">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => selectLocale(lang.code)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors ${
                  lang.code === current.code ? 'font-semibold text-gray-900' : 'text-gray-600'
                }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
