import { findElement, findAllElements, SELECTORS } from './selectors'

export interface Message {
  sender: 'self' | 'other'
  senderName: string
  content: string
  timestamp?: string
  relativeTime?: string
  isRecent: boolean
}

export interface UserProfile {
  name: string | null
  headline: string | null
  profileUrl: string | null
  company: string | null
  jobDescription: string | null
}

export interface ConversationContext {
  messages: Message[]
  formattedMessages: string
  currentUser: UserProfile
  recipient: UserProfile
  messageCount: number
  conversationAge: string | null
  lastMessageTime: string | null
  lastMessageSender: 'self' | 'other' | null
  hasUnreadMessages: boolean
  summary: string
}

// Get current user's name from LinkedIn page
function getCurrentUserName(): string | null {
  // Method 1: Try the "Me" dropdown in nav - this is the most reliable
  const mePhoto = document.querySelector('.global-nav__me-photo')
  if (mePhoto) {
    const alt = mePhoto.getAttribute('alt')
    if (alt && alt.length > 2) {
      // Alt is usually "Photo of [Name]" or just the name
      const name = alt.replace(/^photo\s*(of)?\s*/i, '').trim()
      if (name) return name
    }
  }

  // Method 2: Try feed identity module (left sidebar on home)
  const feedIdentity = document.querySelector('.feed-identity-module__actor-meta a')
  if (feedIdentity?.textContent?.trim()) {
    return feedIdentity.textContent.trim()
  }

  // Method 3: Try profile card in sidebar
  const profileCard = document.querySelector('.profile-rail-card__actor-link')
  if (profileCard?.textContent?.trim()) {
    return profileCard.textContent.trim()
  }

  // Method 4: Look for the nav profile button text
  const navProfile = document.querySelector('.global-nav__primary-link-me-menu-trigger img')
  if (navProfile) {
    const alt = navProfile.getAttribute('alt')
    if (alt && alt.length > 2) {
      return alt.replace(/^photo\s*(of)?\s*/i, '').trim()
    }
  }

  // Method 5: Check for any element with data attribute containing user info
  const userElement = document.querySelector('[data-control-name="identity_profile_photo"]')
  if (userElement) {
    const img = userElement.querySelector('img')
    if (img?.alt) {
      return img.alt.replace(/^photo\s*(of)?\s*/i, '').trim()
    }
  }

  return null
}

// Get current user's profile info
function getCurrentUserProfile(): UserProfile {
  let name = getCurrentUserName()

  // Try to get headline
  let headline: string | null = null
  const headlineEl = document.querySelector('.feed-identity-module__headline, .profile-rail-card__headline')
  if (headlineEl?.textContent) {
    headline = headlineEl.textContent.trim()
  }

  return {
    name,
    headline,
    profileUrl: null,
    company: headline?.split(' at ')?.[1]?.trim() || null,
    jobDescription: null
  }
}

// Extract company name from the visible LinkedIn profile page
function extractCompanyFromProfile(): string | null {
  // Look for the Experience section and find the current company
  const companySelectors = [
    // Company name in experience section (usually the first/current one)
    '#experience ~ .pvs-list__outer-container .hoverable-link-text span[aria-hidden="true"]',
    'section:has(#experience) .hoverable-link-text span[aria-hidden="true"]',
    '[id*="experience"] .t-bold span[aria-hidden="true"]',
    // Experience company names
    '.experience-section .pv-entity__secondary-title',
    '[class*="experience"] [class*="company-name"]',
    // New LinkedIn layout
    'section:has(#experience) li .t-bold a span',
    'section:has(#experience) li .t-bold span[aria-hidden="true"]',
    // Try looking for company logos/names near "Present"
    '.pvs-entity--with-path .t-bold span[aria-hidden="true"]'
  ]

  for (const selector of companySelectors) {
    try {
      const elements = document.querySelectorAll(selector)
      for (const el of elements) {
        const text = el.textContent?.trim()
        // Company names are usually short and don't contain certain keywords
        if (text && text.length > 1 && text.length < 100 &&
            !text.includes('Present') && !text.includes('·') &&
            !text.includes('yr') && !text.includes('mo') &&
            !text.match(/^\d/) && !text.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i)) {
          console.log('LinkedIn AI: Found company from profile:', text)
          return text
        }
      }
    } catch (e) {
      // Selector might be invalid
    }
  }

  // Fallback: Look for any element in experience section that looks like a company name
  const experienceSection = document.querySelector('#experience, [id*="experience"]')
  if (experienceSection) {
    const parent = experienceSection.closest('section') || experienceSection.parentElement?.parentElement
    if (parent) {
      // Look for bold text that could be company names
      const boldElements = parent.querySelectorAll('.t-bold span[aria-hidden="true"], strong, b')
      for (const el of boldElements) {
        const text = el.textContent?.trim()
        if (text && text.length > 2 && text.length < 80 &&
            !text.includes('Experience') && !text.includes('Present') &&
            !text.match(/^\d/) && !text.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i)) {
          console.log('LinkedIn AI: Found company from bold text:', text)
          return text
        }
      }
    }
  }

  return null
}

// Extract job description from the visible LinkedIn profile page
function extractJobDescriptionFromProfile(): string | null {
  // Look for the Experience section on the profile page
  const experienceSection = document.querySelector('#experience, [id*="experience"], section.experience')

  // Try multiple selectors for finding the current job description
  const jobDescriptionSelectors = [
    // Main profile page experience section
    '.experience-section .pv-entity__description',
    '[class*="experience"] [class*="description"]',
    '.pv-profile-section__card-item-v2 .pv-entity__extra-details',
    // New LinkedIn layout
    '[data-field="experience_description"]',
    '.pvs-list__item--line-separated [class*="display-flex"] [class*="visually-hidden"] + span',
    // Experience items with descriptions
    'section:has(#experience) li [class*="inline-show-more-text"]',
    'section:has(#experience) li .pvs-list__outer-container [aria-hidden="true"] span',
    // Try to find any experience description
    '[class*="experience"] ul li .t-14.t-normal',
    '[class*="experience"] ul li span[aria-hidden="true"]',
    // Generic profile description areas
    '.pv-shared-text-with-see-more span[aria-hidden="true"]'
  ]

  for (const selector of jobDescriptionSelectors) {
    try {
      const elements = document.querySelectorAll(selector)
      for (const el of elements) {
        const text = el.textContent?.trim()
        if (text && text.length > 50 && text.length < 3000) {
          // Likely a job description - return the first substantial one (current job)
          console.log('LinkedIn AI: Found job description:', text.substring(0, 100) + '...')
          return text
        }
      }
    } catch (e) {
      // Selector might be invalid, continue
    }
  }

  // Fallback: Look for any text that looks like a job description in the experience area
  const experienceContainer = document.querySelector('[id*="experience"], .experience-section, section:has([id*="experience"])')
  if (experienceContainer) {
    // Find all text content within experience section that's substantial
    const allText = experienceContainer.querySelectorAll('span, p, div')
    for (const el of allText) {
      const text = el.textContent?.trim()
      // Job descriptions are usually longer and contain action words
      if (text && text.length > 100 && text.length < 2000 &&
          (text.includes('Lead') || text.includes('Manage') || text.includes('Develop') ||
           text.includes('Support') || text.includes('Drive') || text.includes('Build') ||
           text.includes('Create') || text.includes('Responsible'))) {
        console.log('LinkedIn AI: Found job description (fallback):', text.substring(0, 100) + '...')
        return text
      }
    }
  }

  return null
}

// Try to infer current user from conversation by finding sender who is NOT the recipient
function inferCurrentUserFromConversation(recipientName: string | null): string | null {
  if (!recipientName) return null

  const threadContainer = findElement('messageThread')
  if (!threadContainer) return null

  // Look for all sender names in the conversation
  const senderNames = new Set<string>()

  // Check message groups
  const groups = threadContainer.querySelectorAll('.msg-s-message-group, [class*="msg-s-message-group"]')
  for (const group of groups) {
    const senderEl = group.querySelector('.msg-s-message-group__name, [class*="msg-s-message-group__name"], .msg-s-message-group__profile-link')
    if (senderEl?.textContent?.trim()) {
      senderNames.add(senderEl.textContent.trim())
    }
  }

  // Check individual message senders
  const senderEls = threadContainer.querySelectorAll('.msg-s-event-listitem__profile-link, [class*="profile-link"]')
  for (const el of senderEls) {
    if (el.textContent?.trim()) {
      senderNames.add(el.textContent.trim())
    }
  }

  // Find a sender who is NOT the recipient - that's likely the current user
  const recipientLower = recipientName.toLowerCase()
  for (const sender of senderNames) {
    const senderLower = sender.toLowerCase()
    // If this sender doesn't match the recipient, it's likely the current user
    if (!senderLower.includes(recipientLower) && !recipientLower.includes(senderLower)) {
      // Extra check: make sure it's not just a partial match
      const senderFirst = senderLower.split(/\s+/)[0]
      const recipientFirst = recipientLower.split(/\s+/)[0]
      if (senderFirst !== recipientFirst) {
        return sender
      }
    }
  }

  return null
}

// Get recipient's profile info from conversation
function getRecipientProfile(): UserProfile {
  let name: string | null = null
  let headline: string | null = null
  let profileUrl: string | null = null
  let company: string | null = null

  // CRITICAL: Use the message input as an anchor to find the correct compose modal
  // This prevents matching elements from profile pages visible in the background
  const messageInput = document.querySelector(
    '.msg-form__contenteditable, ' +
    '[contenteditable="true"][role="textbox"], ' +
    '.msg-form__message-texteditor [contenteditable]'
  )

  // Find the compose modal by traversing up from the message input
  const composeModal = messageInput?.closest(
    '.msg-overlay-conversation-bubble, ' +
    '.msg-convo-wrapper, ' +
    '[class*="msg-overlay-conversation-bubble"], ' +
    '[class*="msg-overlay-bubble"]'
  ) || messageInput?.closest('[class*="msg-"]')?.parentElement?.closest('[class*="msg-"]')

  if (composeModal) {
    console.log('LinkedIn AI: Found compose modal, searching for recipient info...')

    // Method 1: Look for the blue pill with recipient name (most reliable for new message)
    const allElements = composeModal.querySelectorAll('*')
    for (const el of allElements) {
      const classes = el.className?.toString() || ''

      // Look for pill/badge with the recipient name
      if (classes.includes('pill') && !classes.includes('nav') && !classes.includes('tab')) {
        const text = el.textContent?.trim() || ''
        // Clean and validate
        const cleanedText = text.replace(/[×✕✖]/g, '').trim()
        if (cleanedText.length > 2 && cleanedText.length < 100 && !['Posts', 'About', 'Activity'].includes(cleanedText)) {
          name = cleanedText
          console.log('LinkedIn AI: Found name from pill:', name)
          break
        }
      }
    }

    // Method 2: Look for entity lockup pattern (card with photo, name, headline)
    for (const el of allElements) {
      const classes = el.className?.toString() || ''

      if (classes.includes('lockup') || classes.includes('entity')) {
        // Look for title (name)
        const titleEl = el.querySelector('[class*="title"]')
        if (titleEl?.textContent?.trim() && !name) {
          let extractedName = titleEl.textContent.trim()
          // Clean connection degree
          extractedName = extractedName.replace(/\s*·\s*(1st|2nd|3rd|\d+).*$/, '').trim()
          if (extractedName.length > 2 && extractedName.length < 100) {
            name = extractedName
            console.log('LinkedIn AI: Found name from lockup:', name)
          }
        }

        // Look for subtitle (headline)
        const subtitleEl = el.querySelector('[class*="subtitle"]')
        if (subtitleEl?.textContent?.trim() && !headline) {
          headline = subtitleEl.textContent.trim()
          console.log('LinkedIn AI: Found headline from lockup:', headline)
        }

        // Look for profile link
        const linkEl = el.querySelector('a[href*="/in/"]') as HTMLAnchorElement
        if (linkEl?.href && !profileUrl) {
          profileUrl = linkEl.href
        }

        if (name && headline) break
      }
    }

    // Method 3: Scan all links for profile URLs and names
    if (!name) {
      const links = composeModal.querySelectorAll('a[href*="/in/"]') as NodeListOf<HTMLAnchorElement>
      for (const link of links) {
        if (link.textContent?.trim()) {
          const linkText = link.textContent.trim()
          if (linkText.length > 2 && linkText.length < 100 && !['View', 'See', 'Posts'].includes(linkText)) {
            name = linkText.replace(/\s*·\s*(1st|2nd|3rd|\d+).*$/, '').trim()
            profileUrl = link.href
            console.log('LinkedIn AI: Found name from link:', name)
            break
          }
        }
      }
    }

    // Method 4: Look for any h2/h3 headers that might contain the name
    if (!name) {
      const headers = composeModal.querySelectorAll('h2, h3')
      for (const header of headers) {
        const text = header.textContent?.trim() || ''
        if (text.length > 2 && text.length < 100 && text !== 'New message' && !['Posts', 'About'].includes(text)) {
          name = text.replace(/\s*·\s*(1st|2nd|3rd|\d+).*$/, '').trim()
          console.log('LinkedIn AI: Found name from header:', name)
          break
        }
      }
    }

    // Method 5: Look for headline in paragraph or span with specific text patterns
    if (!headline) {
      const textElements = composeModal.querySelectorAll('p, span')
      for (const el of textElements) {
        const text = el.textContent?.trim() || ''
        // Headlines often contain keywords like "at", job titles, or are of moderate length
        if (text.length > 20 && text.length < 200 && (
          text.includes(' at ') ||
          text.includes('Manager') ||
          text.includes('Director') ||
          text.includes('Engineer') ||
          text.includes('Architect') ||
          text.includes('Founder') ||
          text.includes('CEO') ||
          text.includes('VP')
        )) {
          headline = text
          console.log('LinkedIn AI: Found headline from text pattern:', headline)
          break
        }
      }
    }
  }

  // Fallback: Try existing conversation selectors (for regular messaging page)
  if (!name) {
    const header = findElement('conversationHeader')
    if (header) {
      const nameEl = header.querySelector('a, h2, span')
      if (nameEl?.textContent?.trim()) {
        name = nameEl.textContent.trim()
      }
    }
  }

  if (!profileUrl) {
    for (const selector of SELECTORS.recipientProfileLink) {
      const link = document.querySelector(selector) as HTMLAnchorElement
      if (link?.href) {
        profileUrl = link.href
        if (!name) {
          name = link.textContent?.trim() || null
        }
        break
      }
    }
  }

  if (!headline) {
    for (const selector of SELECTORS.recipientHeadline) {
      const el = document.querySelector(selector)
      if (el?.textContent?.trim()) {
        headline = el.textContent.trim()
        break
      }
    }
  }

  // Extract company from headline
  if (headline) {
    const atMatch = headline.match(/(?:at|@)\s+(.+?)(?:\s*[|•·-]|$)/i)
    if (atMatch) {
      company = atMatch[1].trim()
    }
  }

  // If no company from headline, try to extract from visible profile page
  if (!company) {
    company = extractCompanyFromProfile()
  }

  // Try to extract job description from the visible profile page
  const jobDescription = extractJobDescriptionFromProfile()

  console.log('LinkedIn AI: Recipient profile extracted:', { name, headline, company, profileUrl, hasJobDescription: !!jobDescription })
  return { name, headline, profileUrl, company, jobDescription }
}

// Sanitize message content
function sanitizeContent(content: string): string {
  let sanitized = content.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]')
  sanitized = sanitized.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[PHONE]')
  sanitized = sanitized.replace(/https?:\/\/[^\s]+/g, '[LINK]')
  return sanitized.trim()
}

// Parse timestamp
function parseTimestamp(timestampText: string): { relative: string; isRecent: boolean } {
  const text = timestampText.toLowerCase().trim()

  if (text.includes('just now') || text.includes('now')) {
    return { relative: 'just now', isRecent: true }
  }

  const minutesMatch = text.match(/(\d+)\s*(?:min|minute|m)\s*(?:ago)?/i)
  if (minutesMatch) {
    const minutes = parseInt(minutesMatch[1])
    return { relative: `${minutes}m ago`, isRecent: minutes < 60 }
  }

  const hoursMatch = text.match(/(\d+)\s*(?:hour|hr|h)\s*(?:ago)?/i)
  if (hoursMatch) {
    const hours = parseInt(hoursMatch[1])
    return { relative: `${hours}h ago`, isRecent: hours < 2 }
  }

  if (text.includes('today') || /^\d{1,2}:\d{2}\s*(am|pm)?$/i.test(text)) {
    return { relative: 'today', isRecent: false }
  }

  if (text.includes('yesterday')) {
    return { relative: 'yesterday', isRecent: false }
  }

  const daysMatch = text.match(/(\d+)\s*(?:day|d)\s*(?:ago)?/i)
  if (daysMatch) {
    return { relative: `${parseInt(daysMatch[1])}d ago`, isRecent: false }
  }

  return { relative: text || 'unknown', isRecent: false }
}

// Find date separators in the conversation and return them as an ordered list
function findDateSeparators(threadContainer: Element): Array<{ element: Element; dateText: string; date: Date | null }> {
  const separators: Array<{ element: Element; dateText: string; date: Date | null }> = []

  for (const selector of SELECTORS.dateSeparator) {
    const elements = threadContainer.querySelectorAll(selector)
    for (const el of elements) {
      const text = el.textContent?.trim()
      if (text) {
        const date = parseDateFromSeparator(text)
        separators.push({ element: el, dateText: text, date })
      }
    }
    if (separators.length > 0) break
  }

  return separators
}

// Parse a date from separator text like "OCT 15, 2025", "Today", "Yesterday", "Jan 15"
function parseDateFromSeparator(text: string): Date | null {
  const lowerText = text.toLowerCase().trim()
  const now = new Date()

  if (lowerText === 'today') {
    return now
  }

  if (lowerText === 'yesterday') {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return yesterday
  }

  // Try to parse "Month Day, Year" format (e.g., "Oct 15, 2025" or "OCT 15, 2025")
  const fullDateMatch = text.match(/([a-z]+)\s+(\d{1,2}),?\s*(\d{4})/i)
  if (fullDateMatch) {
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    const monthIndex = monthNames.indexOf(fullDateMatch[1].toLowerCase().slice(0, 3))
    if (monthIndex !== -1) {
      return new Date(parseInt(fullDateMatch[3]), monthIndex, parseInt(fullDateMatch[2]))
    }
  }

  // Try to parse "Month Day" format without year (e.g., "Oct 15", "Jan 22")
  const shortDateMatch = text.match(/([a-z]+)\s+(\d{1,2})/i)
  if (shortDateMatch) {
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    const monthIndex = monthNames.indexOf(shortDateMatch[1].toLowerCase().slice(0, 3))
    if (monthIndex !== -1) {
      const year = now.getFullYear()
      let date = new Date(year, monthIndex, parseInt(shortDateMatch[2]))
      // If the date is in the future, it's probably from last year
      if (date > now) {
        date = new Date(year - 1, monthIndex, parseInt(shortDateMatch[2]))
      }
      return date
    }
  }

  return null
}

// Calculate relative time string from a date
function calculateRelativeTime(date: Date): { relative: string; isRecent: boolean } {
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  let relative: string
  let isRecent = false

  if (diffMins < 1) {
    relative = 'just now'
    isRecent = true
  } else if (diffMins < 60) {
    relative = `${diffMins}m ago`
    isRecent = true
  } else if (diffHours < 24) {
    relative = `${diffHours}h ago`
    isRecent = diffHours < 2
  } else if (diffDays === 1) {
    relative = 'yesterday'
  } else if (diffDays < 7) {
    relative = `${diffDays}d ago`
  } else if (diffDays < 30) {
    relative = `${diffDays}d ago`
  } else if (diffDays < 60) {
    relative = `about ${Math.floor(diffDays / 7)} weeks ago`
  } else {
    // Include month and approximate time for older messages to help with follow-up context
    const months = Math.floor(diffDays / 30)
    relative = `${months} month${months > 1 ? 's' : ''} ago (${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`
  }

  return { relative, isRecent }
}

// Extract timestamp from element, with optional date context from separator
function extractTimestamp(element: Element, dateContext?: Date | null): { timestamp: string; relative: string; isRecent: boolean } | null {
  for (const selector of SELECTORS.messageTimestamp) {
    const el = element.querySelector(selector)
    if (el) {
      const datetime = el.getAttribute('datetime')
      if (datetime) {
        const date = new Date(datetime)
        const { relative, isRecent } = calculateRelativeTime(date)
        return { timestamp: datetime, relative, isRecent }
      }

      const text = el.textContent?.trim()
      if (text) {
        // If we have date context and the text looks like just a time (e.g., "5:05 PM")
        if (dateContext && /^\d{1,2}:\d{2}\s*(am|pm)?$/i.test(text)) {
          const { relative, isRecent } = calculateRelativeTime(dateContext)
          return { timestamp: dateContext.toISOString(), relative, isRecent }
        }
        const parsed = parseTimestamp(text)
        return { timestamp: text, ...parsed }
      }
    }
  }

  // If no timestamp found but we have date context, use that
  if (dateContext) {
    const { relative, isRecent } = calculateRelativeTime(dateContext)
    return { timestamp: dateContext.toISOString(), relative, isRecent }
  }

  return null
}

// Check if sender name matches current user
function isSenderCurrentUser(senderName: string | null, currentUserName: string | null, recipientName: string | null): boolean {
  if (!senderName) return false

  const sender = senderName.toLowerCase().trim()

  // If we have both current user and recipient names, use them for comparison
  if (currentUserName) {
    const current = currentUserName.toLowerCase().trim()

    // Direct match with current user
    if (sender === current) return true

    // First name match with current user
    const senderParts = sender.split(/\s+/)
    const currentParts = current.split(/\s+/)
    if (senderParts[0] === currentParts[0] && senderParts[0].length > 2) return true

    // Contains match
    if (sender.includes(current) || current.includes(sender)) return true
  }

  // If sender matches recipient, it's NOT the current user
  if (recipientName) {
    const recipient = recipientName.toLowerCase().trim()

    if (sender === recipient) return false

    const senderParts = sender.split(/\s+/)
    const recipientParts = recipient.split(/\s+/)
    if (senderParts[0] === recipientParts[0] && senderParts[0].length > 2) return false

    if (sender.includes(recipient) || recipient.includes(sender)) return false
  }

  // If we have current user name and sender doesn't match recipient, it might be current user
  if (currentUserName && recipientName) {
    return true // If it's not the recipient, assume it's the current user
  }

  return false
}

// Find the nearest preceding date separator for an element
function findDateContextForElement(element: Element, dateSeparators: Array<{ element: Element; date: Date | null }>): Date | null {
  if (dateSeparators.length === 0) return null

  // Get element's position in the document
  const elementRect = element.getBoundingClientRect()

  // Find the last date separator that appears before this element
  let bestDate: Date | null = null
  for (const sep of dateSeparators) {
    const sepRect = sep.element.getBoundingClientRect()
    // If separator is above/before the element, it's a candidate
    if (sepRect.top <= elementRect.top && sep.date) {
      bestDate = sep.date
    }
  }

  return bestDate
}

// Extract messages using message groups (more accurate)
export function extractMessages(): Message[] {
  const messages: Message[] = []
  const recipient = getRecipientProfile()
  let currentUser = getCurrentUserProfile()

  // If we couldn't get current user name from nav, infer from conversation
  if (!currentUser.name) {
    const inferredName = inferCurrentUserFromConversation(recipient.name)
    if (inferredName) {
      currentUser = { ...currentUser, name: inferredName }
    }
  }

  const threadContainer = findElement('messageThread')
  if (!threadContainer) {
    console.log('LinkedIn AI: Message thread not found')
    return messages
  }

  // Find all date separators in the conversation
  const dateSeparators = findDateSeparators(threadContainer)
  console.log('LinkedIn AI: Found date separators:', dateSeparators.map(s => ({ text: s.dateText, date: s.date?.toISOString() })))

  // Try to find message groups first (more reliable for sender identification)
  const messageGroups = findAllElements('messageGroup', threadContainer)

  if (messageGroups.length > 0) {
    for (const group of messageGroups) {
      // Get sender name for this group
      let senderName: string | null = null
      for (const selector of SELECTORS.messageGroupSender) {
        const senderEl = group.querySelector(selector)
        if (senderEl?.textContent?.trim()) {
          senderName = senderEl.textContent.trim()
          break
        }
      }

      // Determine if this is from self
      const isSelf = isSenderCurrentUser(senderName, currentUser.name, recipient.name)
      const displayName = isSelf ? (currentUser.name || 'Me') : (senderName || recipient.name || 'Them')

      // Find date context for this message group
      const dateContext = findDateContextForElement(group, dateSeparators)

      // Get all messages in this group
      const messageContents = group.querySelectorAll('.msg-s-event-listitem__body, [class*="msg-s-event-listitem__body"]')

      for (const contentEl of messageContents) {
        const content = contentEl.textContent?.trim()
        if (!content) continue

        const timestampInfo = extractTimestamp(group, dateContext) || extractTimestamp(contentEl.closest('.msg-s-event-listitem') || contentEl, dateContext)

        messages.push({
          sender: isSelf ? 'self' : 'other',
          senderName: displayName,
          content: sanitizeContent(content),
          timestamp: timestampInfo?.timestamp,
          relativeTime: timestampInfo?.relative,
          isRecent: timestampInfo?.isRecent ?? false
        })
      }
    }
  }

  // Fallback: individual message items
  if (messages.length === 0) {
    const messageItems = findAllElements('messageItem', threadContainer)

    for (const item of messageItems) {
      const contentElement = findElement('messageContent', item)
      if (!contentElement) continue

      const content = contentElement.textContent?.trim()
      if (!content) continue

      // Check for self-sent indicators
      const hasSelfClass = SELECTORS.selfMessage.some(selector => {
        try {
          return item.matches(selector) || item.closest(selector) || item.querySelector(selector)
        } catch { return false }
      })

      // Get sender name
      let senderName = findElement('messageSender', item)?.textContent?.trim() || null
      const isSelf = hasSelfClass || isSenderCurrentUser(senderName, currentUser.name, recipient.name)

      const displayName = isSelf ? (currentUser.name || 'Me') : (senderName || recipient.name || 'Them')

      // Find date context for this message
      const dateContext = findDateContextForElement(item, dateSeparators)
      const timestampInfo = extractTimestamp(item, dateContext)

      messages.push({
        sender: isSelf ? 'self' : 'other',
        senderName: displayName,
        content: sanitizeContent(content),
        timestamp: timestampInfo?.timestamp,
        relativeTime: timestampInfo?.relative,
        isRecent: timestampInfo?.isRecent ?? false
      })
    }
  }

  return messages
}

// Format messages for prompt
export function formatMessagesForPrompt(messages: Message[], currentUser: UserProfile, recipient: UserProfile): string {
  if (messages.length === 0) {
    return 'No messages in conversation yet.'
  }

  const lines: string[] = []
  const myName = currentUser.name || 'ME'
  const theirName = recipient.name || 'THEM'

  // Add header
  lines.push(`[Conversation between ${myName} and ${theirName}]`)
  lines.push('')

  let lastSender: 'self' | 'other' | null = null

  for (const msg of messages.slice(-15)) {
    // Add separator when sender changes
    if (lastSender !== null && lastSender !== msg.sender) {
      lines.push('')
    }

    const senderLabel = msg.sender === 'self' ? `[${myName}]` : `[${theirName}]`
    const time = msg.relativeTime ? ` (${msg.relativeTime})` : ''

    lines.push(`${senderLabel}${time}: ${msg.content}`)
    lastSender = msg.sender
  }

  return lines.join('\n')
}

// Generate conversation summary
function generateSummary(messages: Message[], currentUser: UserProfile, recipient: UserProfile): string {
  if (messages.length === 0) {
    return 'New conversation - no messages yet.'
  }

  const theirName = recipient.name || 'The other person'
  const lastMsg = messages[messages.length - 1]
  const recentMsgs = messages.filter(m => m.isRecent)

  let summary = ''

  if (lastMsg.sender === 'other') {
    summary += `${theirName} sent the last message`
    if (lastMsg.relativeTime) summary += ` (${lastMsg.relativeTime})`
    summary += '. Awaiting your reply. '
  } else {
    summary += `You sent the last message`
    if (lastMsg.relativeTime) summary += ` (${lastMsg.relativeTime})`
    summary += '. '
  }

  const myCount = messages.filter(m => m.sender === 'self').length
  const theirCount = messages.filter(m => m.sender === 'other').length
  summary += `Conversation has ${messages.length} messages (${myCount} from you, ${theirCount} from ${theirName}).`

  if (recentMsgs.length > 0) {
    summary += ' Active conversation.'
  }

  return summary
}

// Get full conversation context
export function getConversationContext(): ConversationContext {
  const recipient = getRecipientProfile()
  let currentUser = getCurrentUserProfile()

  // If we couldn't get current user name, try to infer from conversation
  if (!currentUser.name) {
    const inferredName = inferCurrentUserFromConversation(recipient.name)
    if (inferredName) {
      currentUser = { ...currentUser, name: inferredName }
    }
  }

  const messages = extractMessages()
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null

  // Debug logging
  console.log('LinkedIn AI Context:', {
    currentUser: currentUser.name,
    recipient: recipient.name,
    messageCount: messages.length,
    lastSender: lastMessage?.sender,
    lastSenderName: lastMessage?.senderName
  })

  return {
    messages,
    formattedMessages: formatMessagesForPrompt(messages, currentUser, recipient),
    currentUser,
    recipient,
    messageCount: messages.length,
    conversationAge: messages.length > 0 ? messages[0].relativeTime || null : null,
    lastMessageTime: lastMessage?.relativeTime || null,
    lastMessageSender: lastMessage?.sender || null,
    hasUnreadMessages: lastMessage?.sender === 'other',
    summary: generateSummary(messages, currentUser, recipient)
  }
}
