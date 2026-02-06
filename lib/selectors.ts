// LinkedIn DOM selectors with fallbacks for different page versions
// LinkedIn frequently updates their DOM structure, so we use multiple fallback selectors

export const SELECTORS = {
  // Message thread container
  messageThread: [
    '[class*="msg-s-message-list"]',
    '.msg-s-message-list-container',
    '[data-test-id="message-list"]',
    '.msg-thread',
    '.msg-conversations-container__conversations-list'
  ],

  // Individual message item
  messageItem: [
    '.msg-s-message-list__event',
    '[class*="msg-s-event-listitem"]',
    '.msg-s-message-group',
    '[class*="msg-s-message-list-content"]'
  ],

  // Message content text
  messageContent: [
    '.msg-s-event-listitem__body',
    '[class*="msg-s-event-listitem__message-body"]',
    '.msg-s-message-group__content',
    '[class*="msg-s-event-listitem__body"] p',
    '.msg-s-event__content'
  ],

  // Message sender name
  messageSender: [
    '.msg-s-message-group__name',
    '[class*="msg-s-message-group__profile-link"]',
    '.msg-s-event-listitem__profile-link',
    '.msg-s-message-group__meta .msg-s-message-group__name',
    '[class*="msg-s-event-listitem"] [class*="profile-link"]'
  ],

  // Message timestamp
  messageTimestamp: [
    '.msg-s-message-group__timestamp',
    '[class*="msg-s-message-list__time-heading"]',
    '.msg-s-event-listitem__timestamp',
    'time',
    '[class*="timestamp"]',
    '.msg-s-message-group__meta time',
    '[datetime]'
  ],

  // Date separator (e.g., "Today", "Yesterday", "Jan 15")
  dateSeparator: [
    '.msg-s-message-list__time-heading',
    '[class*="time-heading"]',
    '.msg-s-message-list__separator',
    '[class*="date-separator"]'
  ],

  // Self-sent message indicator (usually has different styling or alignment)
  selfMessage: [
    '.msg-s-message-list__event--self-sent',
    '[class*="msg-s-event-listitem--self"]',
    '[class*="self-sent"]',
    '[class*="msg-s-message-group--self"]',
    '[data-sender-type="self"]'
  ],

  // Other person's message indicator
  otherMessage: [
    '.msg-s-message-list__event--other',
    '[class*="msg-s-event-listitem--other"]',
    '[class*="msg-s-message-group--other"]',
    '[data-sender-type="other"]'
  ],

  // Profile picture/avatar (often indicates sender)
  messageAvatar: [
    '.msg-s-message-group__avatar',
    '.msg-s-event-listitem__avatar',
    '[class*="presence-entity"]',
    '.msg-s-message-group__profile-image'
  ],

  // Current user's profile info (to identify self)
  currentUserName: [
    '.feed-identity-module__actor-meta a',
    '.feed-identity-module__member-name',
    '.global-nav__me-content .t-16',
    '[class*="artdeco-entity-lockup__title"]',
    '.profile-rail-card__actor-link'
  ],

  // Current user's photo
  currentUserPhoto: [
    '.global-nav__me-photo',
    '.feed-identity-module__member-photo',
    '[class*="nav-item__profile-member-photo"]',
    '.presence-entity__image'
  ],

  // Recipient profile details in conversation
  recipientProfileLink: [
    '.msg-thread__link-to-profile',
    '.msg-overlay-bubble-header a[href*="/in/"]',
    '.msg-s-message-group__profile-link',
    '[class*="msg-thread"] a[href*="/in/"]'
  ],

  recipientHeadline: [
    '.msg-overlay-bubble-header__subtitle',
    '.msg-s-profile-card__subtitle',
    '.msg-thread__headline'
  ],

  // Message group - messages are often grouped by sender
  messageGroup: [
    '.msg-s-message-group',
    '[class*="msg-s-message-group"]'
  ],

  // Message group sender name
  messageGroupSender: [
    '.msg-s-message-group__name',
    '.msg-s-message-group__profile-link',
    '[class*="msg-s-message-group__name"]'
  ],

  // Individual messages within a group
  messageInGroup: [
    '.msg-s-event-listitem__body',
    '.msg-s-message-group__content .msg-s-event-listitem'
  ],

  // Message input field
  messageInput: [
    '.msg-form__contenteditable',
    '[data-test-id="message-textbox"]',
    '[contenteditable="true"][role="textbox"]',
    '.msg-form__message-texteditor [contenteditable]'
  ],

  // Send button
  sendButton: [
    '.msg-form__send-button',
    '[data-test-id="message-send-button"]',
    'button[type="submit"].msg-form__send-button'
  ],

  // Conversation header (contains recipient name)
  conversationHeader: [
    '.msg-overlay-bubble-header__title',
    '.msg-conversation-card__content',
    '[class*="msg-overlay-bubble-header"]',
    '.msg-thread__link-to-profile',
    '.msg-overlay-bubble-header h2',
    // New message compose popup
    '.msg-compose-form-v2__pill',
    '.msg-connections-typeahead__search-result--selected',
    '[class*="msg-compose"] [class*="pill"]'
  ],

  // New message compose recipient (blue pill with name)
  newMessageRecipient: [
    '.msg-compose-form-v2__pill',
    '.artdeco-pill',
    '[class*="msg-compose"] .artdeco-pill',
    '[class*="compose"] [class*="pill"]',
    '.msg-connections-typeahead__search-result--selected'
  ],

  // New message compose recipient info card
  newMessageRecipientCard: [
    '.msg-compose-drawer-v2__recipient-card',
    '[class*="msg-compose"] [class*="recipient"]',
    '.msg-compose-form-v2__recipient-info',
    '[class*="compose-drawer"] [class*="entity-lockup"]'
  ],

  // Recipient's profile/title info
  recipientInfo: [
    '.msg-overlay-bubble-header__subtitle',
    '.msg-s-profile-card__subtitle',
    '[class*="msg-s-profile-card"] [class*="subtitle"]'
  ],

  // Message form container
  messageForm: [
    '.msg-form',
    '[class*="msg-form__"]',
    '.msg-s-message-list-container + form'
  ],

  // Messaging page container
  messagingContainer: [
    '.msg-overlay-list-bubble',
    '.msg-conversation-listitem',
    '#messaging',
    '.msg-overlay-conversation-bubble',
    '[class*="msg-overlay"]'
  ],

  // Read receipts / seen indicators
  readReceipt: [
    '.msg-s-event-listitem__seen-receipt',
    '[class*="seen-receipt"]',
    '[class*="read-receipt"]'
  ],

  // Typing indicator
  typingIndicator: [
    '.msg-s-message-list__typing-indicator',
    '[class*="typing-indicator"]'
  ]
} as const

// Get LinkedIn's shadow roots (messaging overlay is inside a shadow DOM on non-messaging pages)
export function getLinkedInShadowRoots(): ShadowRoot[] {
  const roots: ShadowRoot[] = []
  const shadowHost = document.querySelector('[data-testid="interop-shadowdom"]')
  if (shadowHost?.shadowRoot) {
    roots.push(shadowHost.shadowRoot)
  }
  return roots
}

// Query selector that also searches LinkedIn's shadow DOMs
export function queryShadowSelector(selector: string, parent?: Document | Element | ShadowRoot): Element | null {
  const root = parent || document
  const result = root.querySelector(selector)
  if (result) return result

  // If searching from document level (no specific parent), also check shadow roots
  if (!parent || parent === document) {
    for (const shadowRoot of getLinkedInShadowRoots()) {
      const shadowResult = shadowRoot.querySelector(selector)
      if (shadowResult) return shadowResult
    }
  }

  return null
}

// Query selector all that also searches LinkedIn's shadow DOMs
export function queryShadowSelectorAll(selector: string, parent?: Document | Element | ShadowRoot): Element[] {
  const root = parent || document
  const results = Array.from(root.querySelectorAll(selector))

  // If searching from document level, also check shadow roots
  if (!parent || parent === document) {
    for (const shadowRoot of getLinkedInShadowRoots()) {
      results.push(...Array.from(shadowRoot.querySelectorAll(selector)))
    }
  }

  return results
}

// Helper function to find element using fallback selectors
export function findElement(selectorKey: keyof typeof SELECTORS, parent: Document | Element = document): Element | null {
  const selectors = SELECTORS[selectorKey]
  for (const selector of selectors) {
    const element = queryShadowSelector(selector, parent)
    if (element) return element
  }
  return null
}

// Helper function to find all elements using fallback selectors
export function findAllElements(selectorKey: keyof typeof SELECTORS, parent: Document | Element = document): Element[] {
  const selectors = SELECTORS[selectorKey]
  for (const selector of selectors) {
    const elements = queryShadowSelectorAll(selector, parent)
    if (elements.length > 0) return elements
  }
  return []
}

// Check if we're on a LinkedIn messaging page
export function isMessagingPage(): boolean {
  // Check URL
  if (window.location.href.includes('/messaging/')) return true

  // Check for messaging overlay container (popup chat) — searches shadow DOM too
  if (findElement('messagingContainer') !== null) return true

  // Check for any open conversation bubble (searches shadow DOM too)
  if (queryShadowSelector('.msg-overlay-conversation-bubble') !== null) return true
  if (queryShadowSelector('.msg-overlay-bubble-header') !== null) return true

  // Check for compose/new message window
  if (queryShadowSelector('.msg-compose-form-v2') !== null) return true
  if (queryShadowSelector('[class*="msg-compose"]') !== null) return true

  return false
}
