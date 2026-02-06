import type { PlasmoCSConfig, PlasmoGetRootContainer } from 'plasmo'
import { sendToBackground } from '@plasmohq/messaging'
import { useEffect, useState, useCallback } from 'react'
import { SuggestionPanel } from '~components/SuggestionPanel'
import { TriggerButton } from '~components/TriggerButton'
import { QuickActions, type QuickActionType } from '~components/QuickActions'
import type { GenerateCommentRequest, GenerateCommentResponse, PostContext } from '~background/messages/generate-comment'

export const config: PlasmoCSConfig = {
  matches: ['https://www.linkedin.com/feed*', 'https://www.linkedin.com/in/*', 'https://www.linkedin.com/posts/*'],
  all_frames: false
}

// Create a custom root container directly on the body to avoid LinkedIn's CSS interference
export const getRootContainer: PlasmoGetRootContainer = () => {
  const container = document.createElement('div')
  container.id = 'linkedin-ai-feed-root'
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

function extractPostContent(): PostContext | null {
  try {
    // Find the focused/active comment box first
    const activeCommentBox = document.activeElement?.closest('.comments-comment-box, .comments-comment-texteditor')

    // Find the parent post container from the active comment box or any visible one
    let postContainer: Element | null = null

    if (activeCommentBox) {
      postContainer = activeCommentBox.closest('.feed-shared-update-v2, .feed-shared-update, [data-urn]')
    }

    // Fallback: find the first visible post with an open comment section
    if (!postContainer) {
      const openCommentSections = document.querySelectorAll('.comments-comments-list, .comments-comment-box')
      for (const section of openCommentSections) {
        const container = section.closest('.feed-shared-update-v2, .feed-shared-update, [data-urn]')
        if (container) {
          postContainer = container
          break
        }
      }
    }

    if (!postContainer) {
      console.log('[LinkedIn AI] Could not find post container')
      return null
    }

    // Extract author name
    const authorNameEl = postContainer.querySelector(
      '.update-components-actor__name span[aria-hidden="true"], ' +
      '.feed-shared-actor__name span[aria-hidden="true"], ' +
      '.update-components-actor__title span[aria-hidden="true"]'
    )
    const authorName = authorNameEl?.textContent?.trim() || null

    // Extract author headline
    const authorHeadlineEl = postContainer.querySelector(
      '.update-components-actor__description, ' +
      '.feed-shared-actor__description, ' +
      '.update-components-actor__subtitle'
    )
    const authorHeadline = authorHeadlineEl?.textContent?.trim() || null

    // Extract post content
    const postContentEl = postContainer.querySelector(
      '.feed-shared-update-v2__description, ' +
      '.feed-shared-text, ' +
      '.update-components-text, ' +
      '.feed-shared-inline-show-more-text, ' +
      '[data-test-id="main-feed-activity-card__commentary"]'
    )

    let postContent = postContentEl?.textContent?.trim() || ''

    // Check for expanded content
    const expandedContent = postContainer.querySelector('.feed-shared-inline-show-more-text--expanded')
    if (expandedContent) {
      postContent = expandedContent.textContent?.trim() || postContent
    }

    // Detect post type
    let postType: PostContext['postType'] = 'text'
    if (postContainer.querySelector('.feed-shared-image, .update-components-image')) {
      postType = 'image'
    } else if (postContainer.querySelector('.feed-shared-linkedin-video, video')) {
      postType = 'video'
    } else if (postContainer.querySelector('.feed-shared-article, .update-components-article')) {
      postType = 'article'
    } else if (postContainer.querySelector('.feed-shared-celebration, [data-celebration]')) {
      postType = 'celebration'
    }

    // Check for celebration header
    const celebrationHeader = postContainer.querySelector('.feed-shared-header, .update-components-header')
    if (celebrationHeader?.textContent?.toLowerCase().includes('celebrating')) {
      postType = 'celebration'
    }

    if (!postContent && postType === 'text') {
      console.log('[LinkedIn AI] Could not extract post content')
      return null
    }

    return {
      authorName,
      authorHeadline,
      postContent: postContent || `[${postType} post]`,
      postType
    }
  } catch (e) {
    console.error('[LinkedIn AI] Error extracting post content:', e)
    return null
  }
}

function insertComment(comment: string): boolean {
  // Find the active comment input
  const input = document.querySelector<HTMLElement>(
    '.comments-comment-box .ql-editor, ' +
    '.comments-comment-texteditor .ql-editor, ' +
    '.comments-comment-box [contenteditable="true"], ' +
    '.comments-comment-box textarea'
  )

  if (input) {
    if (input.tagName === 'TEXTAREA') {
      (input as HTMLTextAreaElement).value = comment
      input.dispatchEvent(new Event('input', { bubbles: true }))
    } else {
      input.innerHTML = `<p>${comment}</p>`
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
    input.focus()
    return true
  }
  return false
}

function isCommentBoxVisible(): boolean {
  // Check for various comment input selectors
  const commentSelectors = [
    '.comments-comment-box',
    '.comments-comment-texteditor',
    '.comments-comment-box__form',
    '.comments-comment-box-comment__text-editor',
    '[data-placeholder="Add a comment…"]',
    '[placeholder="Add a comment..."]',
    '.feed-shared-update-v2 .ql-editor',
    '.comments-comment-list',
    '.comments-comments-list',
    // Comment input in post detail page
    '.comments-comment-box__form-container'
  ]

  for (const selector of commentSelectors) {
    if (document.querySelector(selector)) {
      return true
    }
  }
  return false
}

function LinkedInFeedOverlay() {
  const [isVisible, setIsVisible] = useState(false)
  const [viewState, setViewState] = useState<ViewState>('hidden')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [currentAction, setCurrentAction] = useState<QuickActionType>('comment_supportive')

  // Check if we're on a feed page with a visible comment box
  useEffect(() => {
    const checkPage = () => {
      const isFeedPage = window.location.pathname.startsWith('/feed') ||
                         window.location.pathname.startsWith('/in/') ||
                         window.location.pathname.startsWith('/posts/')
      const hasCommentBox = isCommentBoxVisible()
      setIsVisible(isFeedPage && hasCommentBox)
    }

    checkPage()

    const observer = new MutationObserver(() => {
      checkPage()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    return () => observer.disconnect()
  }, [])

  const generateComments = useCallback(async (actionType: QuickActionType, customPrompt?: string) => {
    setLoading(true)
    setError(null)
    setSuggestions([])
    setCurrentAction(actionType)
    setViewState('suggestions')

    try {
      const post = extractPostContent()
      if (!post) {
        setError('Could not extract post content. Click on a post\'s comment section first.')
        setLoading(false)
        return
      }

      // Map action type to comment type
      let commentType: 'supportive' | 'insightful' | 'question' | 'congratulate' | 'custom' = 'supportive'
      if (actionType === 'comment_insightful') commentType = 'insightful'
      else if (actionType === 'comment_question') commentType = 'question'
      else if (actionType === 'comment_congratulate') commentType = 'congratulate'
      else if (actionType === 'custom') commentType = 'custom'

      const response = await sendToBackground<GenerateCommentRequest, GenerateCommentResponse>({
        name: 'generate-comment',
        body: {
          post,
          commentType,
          customPrompt
        }
      })

      if (response.error) {
        setError(response.error)
      } else {
        setSuggestions(response.suggestions)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate comments')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleTriggerClick = useCallback(() => {
    if (viewState === 'hidden') {
      setViewState('actions')
    } else {
      setViewState('hidden')
      setSuggestions([])
      setError(null)
    }
  }, [viewState])

  const handleActionSelect = useCallback((action: QuickActionType, customPrompt?: string) => {
    generateComments(action, customPrompt)
  }, [generateComments])

  const handleSelect = useCallback((suggestion: string) => {
    const success = insertComment(suggestion)
    setViewState('hidden')
    setSuggestions([])
    if (!success) {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(suggestion)
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

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        if (isVisible) {
          handleTriggerClick()
        }
      }
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
          isCommentMode={true}
        />
      )}

      {viewState === 'suggestions' && (
        <SuggestionPanel
          suggestions={suggestions}
          loading={loading}
          error={error}
          onSelect={handleSelect}
          onClose={handleClose}
          onRefresh={() => generateComments(currentAction)}
          onBack={handleBack}
          actionLabel="comment"
        />
      )}
    </>
  )
}

export default LinkedInFeedOverlay
