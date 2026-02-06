import React, { useState } from 'react'
import { X, Send } from 'lucide-react'

export type QuickActionType =
  | 'reply'
  | 'follow_up'
  | 'schedule_meeting'
  | 'outreach'
  | 'custom'
  | 'comment_supportive'
  | 'comment_insightful'
  | 'comment_question'
  | 'comment_congratulate'

interface QuickAction {
  id: QuickActionType
  label: string
  icon: string
  description: string
}

const REPLY_ACTIONS: QuickAction[] = [
  { id: 'reply', label: 'Reply', icon: '💬', description: 'Generate a contextual reply' },
  { id: 'follow_up', label: 'Follow Up', icon: '🔄', description: 'Send a follow-up message' },
  { id: 'outreach', label: 'Outreach', icon: '🎯', description: 'Research & craft personalized message' },
  { id: 'schedule_meeting', label: 'Schedule', icon: '📅', description: 'Propose a meeting or call' }
]

const OUTREACH_ACTIONS: QuickAction[] = [
  { id: 'outreach', label: 'Outreach', icon: '🎯', description: 'Research & craft personalized intro' },
  { id: 'schedule_meeting', label: 'Schedule', icon: '📅', description: 'Propose a meeting or call' }
]

const COMMENT_ACTIONS: QuickAction[] = [
  { id: 'comment_supportive', label: 'Support', icon: '👏', description: 'Encouraging comment' },
  { id: 'comment_insightful', label: 'Insight', icon: '💡', description: 'Add value with perspective' },
  { id: 'comment_question', label: 'Question', icon: '❓', description: 'Ask a thoughtful question' },
  { id: 'comment_congratulate', label: 'Congrats', icon: '🎉', description: 'Celebrate achievement' }
]

interface QuickActionsProps {
  onSelect: (action: QuickActionType, customPrompt?: string) => void
  onClose: () => void
  loading: boolean
  isNewConversation?: boolean
  isCommentMode?: boolean
}

export function QuickActions({ onSelect, onClose, loading, isNewConversation = false, isCommentMode = false }: QuickActionsProps) {
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')

  let actions: QuickAction[]
  let title: string
  let banner: string | null = null

  if (isCommentMode) {
    actions = COMMENT_ACTIONS
    title = 'Generate a comment'
  } else if (isNewConversation) {
    actions = OUTREACH_ACTIONS
    title = 'Start a conversation'
    banner = '🔍 Outreach will research the person & company'
  } else {
    actions = REPLY_ACTIONS
    title = 'What would you like to do?'
  }

  const handleActionClick = (action: QuickActionType) => {
    if (action === 'custom') {
      setShowCustomInput(true)
    } else {
      onSelect(action)
    }
  }

  const handleCustomSubmit = () => {
    if (customPrompt.trim()) {
      onSelect('custom', customPrompt.trim())
      setCustomPrompt('')
      setShowCustomInput(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>{title}</span>
        <button onClick={onClose} style={styles.closeButton}>
          <X style={{ width: 16, height: 16 }} />
        </button>
      </div>

      {banner && <div style={styles.banner}>{banner}</div>}

      {showCustomInput ? (
        <div style={styles.customContainer}>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder={isCommentMode
              ? "E.g., Share my experience with X..."
              : "E.g., Ask about their timeline..."
            }
            style={styles.textarea}
            autoFocus
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleCustomSubmit()
              }
              if (e.key === 'Escape') {
                setShowCustomInput(false)
                setCustomPrompt('')
              }
            }}
          />
          <div style={styles.customActions}>
            <button
              style={styles.cancelBtn}
              onClick={() => {
                setShowCustomInput(false)
                setCustomPrompt('')
              }}
            >
              Cancel
            </button>
            <button
              style={{
                ...styles.submitBtn,
                opacity: customPrompt.trim() && !loading ? 1 : 0.5
              }}
              onClick={handleCustomSubmit}
              disabled={!customPrompt.trim() || loading}
            >
              <Send style={{ width: 12, height: 12, marginRight: 4 }} />
              Generate
            </button>
          </div>
        </div>
      ) : (
        <div style={styles.actionsContainer}>
          <div style={styles.grid}>
            {actions.map((action) => (
              <button
                key={action.id}
                onClick={() => handleActionClick(action.id)}
                disabled={loading}
                style={styles.actionBtn}
                title={action.description}
              >
                <span style={styles.actionIcon}>{action.icon}</span>
                <span style={styles.actionLabel}>{action.label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowCustomInput(true)}
            disabled={loading}
            style={styles.customBtn}
          >
            <span>✏️</span>
            <span>Custom instruction...</span>
          </button>
        </div>
      )}
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
    width: '300px',
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
    padding: '12px 14px',
    background: 'linear-gradient(135deg, #0a66c2 0%, #004182 100%)',
    boxSizing: 'border-box'
  },
  title: {
    fontWeight: 600,
    fontSize: '14px',
    color: '#ffffff',
    margin: 0,
    padding: 0,
    lineHeight: 1.4
  },
  closeButton: {
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
  banner: {
    padding: '8px 12px',
    backgroundColor: '#f0f7ff',
    fontSize: '12px',
    color: '#0a66c2',
    textAlign: 'center',
    borderBottom: '1px solid #e8e8e8',
    boxSizing: 'border-box',
    lineHeight: 1.4
  },
  actionsContainer: {
    padding: '12px',
    boxSizing: 'border-box'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
    boxSizing: 'border-box'
  },
  actionBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '12px 8px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    boxSizing: 'border-box',
    lineHeight: 1.4
  },
  actionIcon: {
    fontSize: '20px',
    lineHeight: 1
  },
  actionLabel: {
    fontSize: '11px',
    fontWeight: 500,
    color: '#475569',
    lineHeight: 1.3
  },
  customBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '10px 12px',
    marginTop: '8px',
    backgroundColor: '#fff',
    border: '1px dashed #cbd5e1',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#64748b',
    boxSizing: 'border-box',
    lineHeight: 1.4
  },
  customContainer: {
    padding: '12px',
    boxSizing: 'border-box'
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '13px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    resize: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    outline: 'none',
    lineHeight: 1.5
  },
  customActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '10px',
    boxSizing: 'border-box'
  },
  cancelBtn: {
    padding: '8px 14px',
    fontSize: '12px',
    backgroundColor: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 500,
    color: '#64748b',
    lineHeight: 1.4
  },
  submitBtn: {
    padding: '8px 14px',
    fontSize: '12px',
    fontWeight: 500,
    color: '#fff',
    backgroundColor: '#0a66c2',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    lineHeight: 1.4
  }
}
