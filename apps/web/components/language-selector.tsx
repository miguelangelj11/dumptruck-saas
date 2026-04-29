'use client'

import { useState, useRef, useEffect } from 'react'
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
  const [dropdownPos, setDropdownPos] = useState<{ bottom: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const current = typeof document !== 'undefined'
    ? LANGUAGES.find(l => document.cookie.includes(`NEXT_LOCALE=${l.code}`)) ?? LANGUAGES[0]!
    : LANGUAGES[0]!

  function handleOpen() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const vw = window.innerWidth
      setDropdownPos({
        bottom: window.innerHeight - rect.top + 4,
        left: Math.min(rect.left, vw - 168), // 160px min-width + 8px margin
      })
    }
    setOpen(o => !o)
  }

  // Close on scroll or resize so the dropdown never floats detached on mobile
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

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
        ref={buttonRef}
        onClick={handleOpen}
        className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-white/8"
      >
        <Globe className="h-4 w-4" />
        <span>{current.flag} {current.label}</span>
      </button>

      {open && dropdownPos && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[9999] bg-white rounded-xl border border-gray-200 shadow-xl py-1 min-w-[160px] max-h-[50vh] overflow-y-auto"
            style={{ bottom: dropdownPos.bottom, left: dropdownPos.left }}
          >
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
