'use client'

import Image from 'next/image'

type Props = {
  logoUrl: string | null | undefined
  name: string
  size?: number
  rounded?: 'full' | 'lg'
  bg?: string
  className?: string
}

export default function CompanyAvatar({
  logoUrl,
  name,
  size = 32,
  rounded = 'full',
  bg = 'var(--brand-primary)',
  className = '',
}: Props) {
  // Build initials from first letter of each significant word, max 2 chars
  // e.g. "Atlas Hauling Co." → "AH", "ACME TRUCKING LLC" → "AT"
  const SKIP = new Set(['llc', 'inc', 'corp', 'ltd', 'co', 'the', 'and', '&'])
  const initials = (name || 'CO')
    .split(/\s+/)
    .filter(w => w.length > 0 && !SKIP.has(w.toLowerCase()))
    .map(w => w[0]!.toUpperCase())
    .slice(0, 2)
    .join('') || (name || 'CO').slice(0, 2).toUpperCase()
  const radiusCls = rounded === 'lg' ? 'rounded-lg' : 'rounded-full'

  return (
    <div
      className={`${radiusCls} overflow-hidden flex items-center justify-center shrink-0 font-bold text-white ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34), backgroundColor: logoUrl ? undefined : bg }}
    >
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={`${name} logo`}
          width={size}
          height={size}
          className="object-cover w-full h-full"
        />
      ) : (
        initials
      )}
    </div>
  )
}
