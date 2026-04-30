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
  bg = '#2d7a4f',
  className = '',
}: Props) {
  const initials = (name || 'CO').slice(0, 2).toUpperCase()
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
