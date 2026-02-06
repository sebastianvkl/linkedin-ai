import React from 'react'
import { Sparkles, X, Loader2 } from 'lucide-react'

interface TriggerButtonProps {
  onClick: () => void
  loading?: boolean
  active?: boolean
}

export function TriggerButton({ onClick, loading = false, active = false }: TriggerButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        ...styles.button,
        background: active
          ? '#004182'
          : 'linear-gradient(135deg, #0a66c2 0%, #004182 100%)',
        transform: active ? 'scale(1.05)' : 'scale(1)'
      }}
      title="AI Reply Assistant (Ctrl+Shift+A)"
    >
      {loading ? (
        <Loader2 style={styles.icon} className="animate-spin" />
      ) : active ? (
        <X style={styles.icon} />
      ) : (
        <Sparkles style={styles.icon} />
      )}
    </button>
  )
}

const styles: Record<string, React.CSSProperties> = {
  button: {
    all: 'initial',
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    color: '#ffffff',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(10, 102, 194, 0.4)',
    zIndex: 2147483647,
    transition: 'all 0.15s ease',
    boxSizing: 'border-box',
    pointerEvents: 'auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  icon: {
    width: '22px',
    height: '22px',
    pointerEvents: 'none'
  }
}
