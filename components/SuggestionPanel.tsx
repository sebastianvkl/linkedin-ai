import React, { useState } from 'react'
import { X, ChevronLeft, RefreshCw, Check, Copy, Loader2 } from 'lucide-react'
import { copyToClipboard } from '~lib/messageInsertion'

interface SuggestionPanelProps {
  suggestions: string[]
  loading: boolean
  error: string | null
  onSelect: (suggestion: string) => void
  onClose: () => void
  onRefresh: () => void
  onBack?: () => void
  actionLabel?: string
  isOutreach?: boolean
}

export function SuggestionPanel({
  suggestions,
  loading,
  error,
  onSelect,
  onClose,
  onRefresh,
  onBack,
  actionLabel,
  isOutreach = false
}: SuggestionPanelProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const title = actionLabel
    ? `${actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)} Suggestions`
    : 'AI Suggestions'

  const loadingMessage = isOutreach
    ? 'Researching...'
    : 'Generating...'

  const handleCopy = async (suggestion: string, index: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const success = await copyToClipboard(suggestion)
    if (success) {
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          {onBack && (
            <button onClick={onBack} style={styles.backBtn}>
              <ChevronLeft style={{ width: 16, height: 16 }} />
            </button>
          )}
          <span style={styles.title}>{title}</span>
        </div>
        <div style={styles.headerRight}>
          <button
            onClick={onRefresh}
            disabled={loading}
            style={{
              ...styles.iconBtn,
              opacity: loading ? 0.5 : 1
            }}
            title="Regenerate"
          >
            <RefreshCw
              style={{
                width: 16,
                height: 16,
                animation: loading ? 'spin 1s linear infinite' : 'none'
              }}
            />
          </button>
          <button onClick={onClose} style={styles.iconBtn}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
      </div>

      <div style={styles.content}>
        {loading && (
          <div style={styles.loadingContainer}>
            <Loader2
              style={{
                width: 24,
                height: 24,
                color: '#0a66c2',
                animation: 'spin 1s linear infinite'
              }}
            />
            <span style={styles.loadingText}>{loadingMessage}</span>
          </div>
        )}

        {error && (
          <div style={styles.errorContainer}>
            {error}
          </div>
        )}

        {!loading && !error && suggestions.length > 0 && (
          <div style={styles.suggestionList}>
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                style={styles.suggestionCard}
                onClick={() => onSelect(suggestion)}
              >
                <div style={styles.suggestionHeader}>
                  <span style={styles.suggestionNumber}>{index + 1}</span>
                  <button
                    onClick={(e) => handleCopy(suggestion, index, e)}
                    style={styles.copyBtn}
                    title="Copy to clipboard"
                  >
                    {copiedIndex === index ? (
                      <Check style={{ width: 14, height: 14, color: '#16a34a' }} />
                    ) : (
                      <Copy style={{ width: 14, height: 14 }} />
                    )}
                  </button>
                </div>
                <p style={styles.suggestionText}>{suggestion}</p>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && suggestions.length === 0 && (
          <div style={styles.emptyContainer}>
            Click to generate suggestions.
          </div>
        )}
      </div>

      <div style={styles.hint}>Click a suggestion to insert</div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// Base reset styles to prevent LinkedIn CSS interference
const resetStyles: React.CSSProperties = {
  all: 'initial',
  boxSizing: 'border-box',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  lineHeight: 1.4,
  fontSize: '16px',
  WebkitFontSmoothing: 'antialiased'
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    ...resetStyles,
    position: 'fixed',
    bottom: '80px',
    right: '24px',
    width: '400px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
    zIndex: 2147483647,
    overflow: 'hidden',
    display: 'block',
    pointerEvents: 'auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    background: 'linear-gradient(135deg, #0a66c2 0%, #004182 100%)',
    boxSizing: 'border-box'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  title: {
    fontWeight: 600,
    fontSize: '13px',
    color: '#ffffff',
    margin: 0,
    padding: 0,
    lineHeight: 1.4
  },
  backBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.9)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    lineHeight: 1
  },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.9)',
    cursor: 'pointer',
    padding: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    lineHeight: 1
  },
  content: {
    padding: '10px',
    boxSizing: 'border-box'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    padding: '24px 0',
    color: '#64748b'
  },
  loadingText: {
    fontSize: '13px',
    lineHeight: 1.4
  },
  errorContainer: {
    padding: '10px',
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    borderRadius: '8px',
    fontSize: '12px',
    lineHeight: 1.5,
    boxSizing: 'border-box'
  },
  emptyContainer: {
    padding: '24px 0',
    textAlign: 'center',
    color: '#64748b',
    fontSize: '13px',
    lineHeight: 1.4
  },
  suggestionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  suggestionCard: {
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    padding: '10px 12px',
    border: '1px solid #e2e8f0',
    boxSizing: 'border-box',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  suggestionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px'
  },
  suggestionNumber: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: '#0a66c2',
    color: '#fff',
    fontSize: '11px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1
  },
  copyBtn: {
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    lineHeight: 1
  },
  suggestionText: {
    fontSize: '13px',
    lineHeight: 1.5,
    color: '#1e293b',
    margin: 0,
    boxSizing: 'border-box'
  },
  hint: {
    padding: '8px',
    textAlign: 'center',
    fontSize: '11px',
    color: '#94a3b8',
    borderTop: '1px solid #e2e8f0',
    boxSizing: 'border-box'
  }
}
