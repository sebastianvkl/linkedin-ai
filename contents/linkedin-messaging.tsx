import type { PlasmoCSConfig, PlasmoGetRootContainer } from 'plasmo'
import { sendToBackground } from '@plasmohq/messaging'
import { useEffect, useState, useCallback } from 'react'
import { SuggestionPanel } from '~components/SuggestionPanel'
import { TriggerButton } from '~components/TriggerButton'
import { QuickActions, type QuickActionType } from '~components/QuickActions'
import { getConversationContext } from '~lib/messageExtractor'
import { insertReply, isInputAvailable } from '~lib/messageInsertion'
import { isMessagingPage } from '~lib/selectors'
import type { GenerateReplyRequest, GenerateReplyResponse } from '~background/messages/generate-reply'
import type { GenerateOutreachRequest, GenerateOutreachResponse } from '~background/messages/generate-outreach'

export const config: PlasmoCSConfig = {
  matches: ['https://www.linkedin.com/messaging/*', 'https://www.linkedin.com/*'],
  all_frames: true,
  match_about_blank: true
}

// Create a custom root container directly on the body to avoid LinkedIn's CSS interference
export const getRootContainer: PlasmoGetRootContainer = () => {
  const container = document.createElement('div')
  container.id = 'linkedin-ai-messaging-root'
  container.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    pointer-events: none !important;
    z-index: 2147483647 !important;
    font-size: 16px !important;
    transform: none !important;
    zoom: 1 !important;
  `
  document.body.appendChild(container)
  return container
}

type ViewState = 'hidden' | 'actions' | 'suggestions'

function LinkedInAIOverlay() {
  const [isVisible, setIsVisible] = useState(false)
  const [viewState, setViewState] = useState<ViewState>('hidden')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [currentAction, setCurrentAction] = useState<QuickActionType>('reply')
  const [isNewConversation, setIsNewConversation] = useState(false)

  // Check if we're on a messaging page (but NOT if comment box is open on feed)
  useEffect(() => {
    const checkPage = () => {
      // Don't show messaging UI if a comment box is visible on the feed
      const isCommentBoxOpen = !!(
        document.querySelector('.comments-comment-box') ||
        document.querySelector('.comments-comment-texteditor') ||
        document.querySelector('.comments-comments-list') ||
        document.querySelector('[data-placeholder="Add a comment…"]')
      )

      // Only on feed/profile pages, the comment box takes priority
      const isFeedPage = window.location.pathname.startsWith('/feed') ||
                         window.location.pathname.startsWith('/in/') ||
                         window.location.pathname.startsWith('/posts/')

      if (isFeedPage && isCommentBoxOpen) {
        setIsVisible(false)
        return
      }

      const shouldShow = isMessagingPage() && isInputAvailable()
      setIsVisible(shouldShow)
    }

    // Initial check
    checkPage()

    // Watch for URL changes and DOM mutations
    const observer = new MutationObserver(() => {
      checkPage()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    // Also listen for URL changes
    const handleUrlChange = () => {
      setTimeout(checkPage, 500) // Small delay for DOM to update
    }

    window.addEventListener('popstate', handleUrlChange)
    window.addEventListener('hashchange', handleUrlChange)

    return () => {
      observer.disconnect()
      window.removeEventListener('popstate', handleUrlChange)
      window.removeEventListener('hashchange', handleUrlChange)
    }
  }, [])

  const generateSuggestions = useCallback(async (actionType: QuickActionType, customPrompt?: string) => {
    setLoading(true)
    setError(null)
    setSuggestions([])
    setCurrentAction(actionType)
    setViewState('suggestions')

    try {
      const context = getConversationContext()

      // Check if this is a new conversation (no messages)
      const hasNoMessages = context.messageCount === 0

      // Handle outreach action (for new conversations)
      if (actionType === 'outreach') {
        const response = await sendToBackground<GenerateOutreachRequest, GenerateOutreachResponse>({
          name: 'generate-outreach',
          body: {
            currentUser: context.currentUser,
            recipient: context.recipient,
            customPrompt
          }
        })

        if (response.error) {
          setError(response.error)
        } else {
          setSuggestions(response.suggestions)
        }
        return
      }

      // For other actions, require existing messages
      if (hasNoMessages) {
        setError('No messages found in the conversation. Use Outreach to start a new conversation.')
        return
      }

      // Determine if this is an active conversation (recent messages)
      const isActiveConversation = context.messages.some(m => m.isRecent)

      const response = await sendToBackground<GenerateReplyRequest, GenerateReplyResponse>({
        name: 'generate-reply',
        body: {
          conversationHistory: context.formattedMessages,
          conversationSummary: context.summary,
          currentUser: context.currentUser,
          recipient: context.recipient,
          lastMessageSender: context.lastMessageSender,
          lastMessageTime: context.lastMessageTime,
          isActiveConversation,
          actionType,
          customPrompt
        }
      })

      if (response.error) {
        setError(response.error)
      } else {
        setSuggestions(response.suggestions)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate suggestions')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleTriggerClick = useCallback(() => {
    if (viewState === 'hidden') {
      // Check if this is a new conversation
      const context = getConversationContext()
      setIsNewConversation(context.messageCount === 0)
      setViewState('actions')
    } else {
      setViewState('hidden')
      setSuggestions([])
      setError(null)
    }
  }, [viewState])

  const handleActionSelect = useCallback((action: QuickActionType, customPrompt?: string) => {
    generateSuggestions(action, customPrompt)
  }, [generateSuggestions])

  const handleSelect = useCallback((suggestion: string) => {
    const success = insertReply(suggestion)
    // Always close panel - user can use Copy if insert didn't work
    setViewState('hidden')
    setSuggestions([])
    if (!success) {
      console.warn('Direct insert may have failed, use Copy button as fallback')
    }
  }, [])

  const handleClose = useCallback(() => {
    setViewState('hidden')
    setSuggestions([])
    setError(null)
  }, [])

  const handleBack = useCallback(() => {
    setViewState('actions')
    setSuggestions([])
    setError(null)
  }, [])

  // Keyboard shortcut: Ctrl+Shift+A
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        if (isVisible) {
          handleTriggerClick()
        }
      }
      // Escape to close panel
      if (e.key === 'Escape' && viewState !== 'hidden') {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isVisible, viewState, handleTriggerClick, handleClose])

  if (!isVisible) {
    return null
  }

  return (
    <>
      <TriggerButton
        onClick={handleTriggerClick}
        loading={loading}
        active={viewState !== 'hidden'}
      />

      {viewState === 'actions' && (
        <QuickActions
          onSelect={handleActionSelect}
          onClose={handleClose}
          loading={loading}
          isNewConversation={isNewConversation}
        />
      )}

      {viewState === 'suggestions' && (
        <SuggestionPanel
          suggestions={suggestions}
          loading={loading}
          error={error}
          onSelect={handleSelect}
          onClose={handleClose}
          onRefresh={() => generateSuggestions(currentAction)}
          onBack={handleBack}
          actionLabel={currentAction.replace('_', ' ')}
          isOutreach={currentAction === 'outreach'}
        />
      )}
    </>
  )
}

export default LinkedInAIOverlay
