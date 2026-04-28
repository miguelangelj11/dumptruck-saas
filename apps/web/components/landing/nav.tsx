'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function Nav() {
  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 24px',
      backgroundColor: 'rgba(15, 25, 35, 0.95)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
    }}>

      {/* Left — logo + wordmark */}
      <Link href="/" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        textDecoration: 'none',
        flexShrink: 0,
      }}>
        <Image
          src="/logo.png"
          alt="DumpTruckBoss"
          width={44}
          height={44}
          style={{ objectFit: 'contain', width: '44px', height: '44px' }}
          priority
        />
        <span style={{
          fontWeight: 700,
          fontSize: '18px',
          color: '#ffffff',
          whiteSpace: 'nowrap',
        }}>
          DumpTruckBoss
        </span>
      </Link>

      {/* Center — nav links (desktop only) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '32px',
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
      }} className="hidden md:flex">
        <a href="#features" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '14px' }}>Features</a>
        <a href="#how-it-works" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '14px' }}>How It Works</a>
        <a href="#pricing" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '14px' }}>Pricing</a>
        <a href="#faq" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '14px' }}>FAQ</a>
      </div>

      {/* Right — auth buttons (desktop only) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexShrink: 0,
      }} className="hidden md:flex">
        <Link href="/login" style={{
          color: '#ffffff',
          textDecoration: 'none',
          fontSize: '14px',
        }}>
          Sign in
        </Link>
        <Link href="/signup" style={{
          backgroundColor: '#2d5a3d',
          color: '#ffffff',
          padding: '8px 16px',
          borderRadius: '8px',
          textDecoration: 'none',
          fontSize: '14px',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}>
          Start Free Trial
        </Link>
      </div>

    </nav>
  )
}
