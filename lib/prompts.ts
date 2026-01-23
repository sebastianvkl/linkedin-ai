export type ToneType = 'professional' | 'friendly' | 'casual'


export type QuickActionType =
  | 'reply'
  | 'follow_up'
  | 'schedule_meeting'
  | 'outreach'
  | 'custom'

export interface UserProfile {
  name: string | null
  headline: string | null
  profileUrl: string | null
  company: string | null
  jobDescription?: string | null
}

export interface PromptContext {
  tone: ToneType
  currentUser: UserProfile | null
  recipient: UserProfile | null
  conversationHistory: string
  conversationSummary: string
  lastMessageSender: 'self' | 'other' | null
  lastMessageTime: string | null
  isActiveConversation: boolean
  userContext: string | null
  customInstructions: string | null
  actionType: QuickActionType
  customPrompt: string | null
  companyNews: string | null
  personActivity: string | null
  meetingLink: string | null
}

const TONE_DESCRIPTIONS: Record<ToneType, string> = {
  professional: 'formal and business-appropriate, using proper grammar and professional language',
  friendly: 'warm and personable while still being appropriate for professional networking',
  casual: 'relaxed and conversational, like messaging a colleague you know well'
}

// Analyze time gap and provide context
function analyzeTimeGap(lastMessageTime: string | null): string | null {
  if (!lastMessageTime) return null

  const timeStr = lastMessageTime.toLowerCase()

  // Parse time ago patterns
  const minutesMatch = timeStr.match(/(\d+)\s*m(?:in)?(?:ute)?s?\s*ago/)
  const hoursMatch = timeStr.match(/(\d+)\s*h(?:our)?s?\s*ago/)
  const daysMatch = timeStr.match(/(\d+)\s*d(?:ay)?s?\s*ago/)
  const weeksMatch = timeStr.match(/(?:about\s+)?(\d+)\s*weeks?\s*ago/)
  const monthsMatch = timeStr.match(/(\d+)\s*months?\s*ago/)

  // Handle "X months ago" format directly - these are significant gaps
  if (monthsMatch) {
    const months = parseInt(monthsMatch[1])
    if (months >= 3) {
      return `3+ months have passed - If they mentioned being busy/having a project, reference it as likely completed ("Hope the project went well!") and ask if now is a better time to connect.`
    } else if (months >= 2) {
      return `About ${months} months have passed - Acknowledge the time gap naturally and ask if timing is better now. If they mentioned a project/busy period, reference it positively.`
    } else {
      return '1-2 months have passed - Mention the time gap briefly and check if timing is better now.'
    }
  }

  // Handle "X weeks ago" format
  if (weeksMatch) {
    const weeks = parseInt(weeksMatch[1])
    if (weeks >= 4) {
      return 'About a month has passed - Acknowledge the time and ask if timing is better now.'
    } else if (weeks >= 2) {
      return null // 2-3 weeks - not long enough to make a big deal about
    } else {
      return null // ~1 week - no special handling needed
    }
  }

  // Recent messages - no special time context needed
  if (minutesMatch) return null
  if (hoursMatch) return null
  if (daysMatch) {
    const days = parseInt(daysMatch[1])
    if (days < 14) return null // Less than 2 weeks - no special handling
    if (days < 30) return null // 2-4 weeks - borderline, skip for now
    if (days < 60) return '1-2 months have passed - Mention the time gap briefly and check if timing is better now.'
    if (days < 90) return `About ${Math.floor(days / 30)} months have passed - Acknowledge the time gap and ask if timing is better now. If they mentioned a project/busy period, reference it positively.`
    return `3+ months have passed - If they mentioned being busy/having a project, reference it as likely completed ("Hope the project went well!") and ask if now is a better time to connect.`
  }

  // Check for "today", "yesterday", etc - no special handling
  if (timeStr.includes('today') || timeStr.includes('just now')) return null
  if (timeStr.includes('yesterday')) return null

  // Try to parse date formats (e.g., "Oct 15", "Jan 22", "Dec 3")
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const dateMatch = timeStr.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d+)/)

  if (dateMatch) {
    const monthIndex = monthNames.indexOf(dateMatch[1])
    const day = parseInt(dateMatch[2])
    const currentDate = new Date()
    const currentYear = currentDate.getFullYear()

    // Construct the date (assume current year first, then check if it should be previous year)
    let messageDate = new Date(currentYear, monthIndex, day)

    // If the constructed date is in the future, it must be from last year
    if (messageDate > currentDate) {
      messageDate = new Date(currentYear - 1, monthIndex, day)
    }

    const diffMs = currentDate.getTime() - messageDate.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    // Only provide time context for significant gaps (1+ months)
    if (diffDays < 30) {
      return null // Less than a month - no special handling
    } else if (diffDays < 60) {
      return '1-2 months have passed - Mention the time gap briefly and check if timing is better now.'
    } else if (diffDays < 90) {
      return `About ${Math.floor(diffDays / 30)} months have passed - Acknowledge the time gap and ask if timing is better now. If they mentioned a project/busy period, reference it positively.`
    } else {
      return `3+ months have passed - If they mentioned being busy/having a project, reference it as likely completed ("Hope the project went well!") and ask if now is a better time to connect.`
    }
  }

  // If we can't parse it, no special context
  return null
}

const TONE_GUIDELINES: Record<ToneType, string[]> = {
  professional: [
    'Use complete sentences with proper punctuation',
    'Avoid contractions when possible',
    'Be respectful and courteous',
    'Focus on value and professionalism'
  ],
  friendly: [
    'Use a warm, approachable tone',
    'Contractions are fine',
    'Show genuine interest',
    'Be personable but professional'
  ],
  casual: [
    'Keep it conversational',
    'Short, punchy sentences are okay',
    'Feel free to use light humor if appropriate',
    'Match their energy level'
  ]
}

const ACTION_INSTRUCTIONS: Record<QuickActionType, string> = {
  reply: 'Generate a natural, contextual reply to continue the conversation.',
  follow_up: `Generate a follow-up message. CRITICAL: Check the TIME CONTEXT below!
- If significant time has passed (weeks/months), DO NOT respond to their last message as if it just happened
- Instead, ACKNOWLEDGE the time gap and check if NOW is a better time
- If they previously mentioned being busy/having a project/deadline, reference it as likely COMPLETED now
- Example: If 3 months ago they said "busy with a project", write "Hope the project went well! Is now a better time to connect?"
- DO NOT write responses like "No problem, I understand you're busy" - that ship has sailed months ago!`,
  schedule_meeting: `Generate messages to propose a meeting/call:
- Suggest a call or meeting to discuss further
- Offer flexibility on timing
- Be specific but not presumptuous`,
  outreach: `Generate a personalized cold outreach message:
- This is a FIRST MESSAGE - there is no prior conversation
- Use the RESEARCH DATA provided to personalize the message
- Reference something specific and recent about them or their company (from the research)
- Don't be generic - mention specific achievements, posts, company news, or shared interests
- Keep it brief (2-4 sentences) - no one reads long cold messages
- Have a clear but soft call-to-action (e.g., "Would love to connect" or "Open to a quick chat?")
- DO NOT be salesy or pushy
- DO NOT use templates like "I came across your profile" - be specific about what caught your attention
- Focus on providing value or genuine interest, not asking for things`,
  custom: 'Follow the specific custom instruction provided.'
}

export function buildSystemPrompt(tone: ToneType): string {
  return `You are a LinkedIn messaging assistant generating contextually appropriate replies.

TONE: ${TONE_DESCRIPTIONS[tone]}

GUIDELINES:
${TONE_GUIDELINES[tone].map(g => `- ${g}`).join('\n')}

MESSAGE FORMAT IN CONVERSATION:
- [Name]: means that person sent the message
- The user you're helping is identified as the person asking for suggestions
- Generate replies FOR the user to send

RULES:
- Generate exactly 3 different reply options
- Each should feel natural and human-written
- Be concise (1-3 sentences typically)
- No emojis unless the conversation uses them
- No excessive punctuation or enthusiasm
- If they asked a question, at least one reply should answer it
- Vary approaches: direct answer, add value, move conversation forward

LANGUAGE DETECTION (CRITICAL):
- First, identify what language the OTHER person (recipient) is writing in
- Reply in THE SAME LANGUAGE they are using
- If they write in German, reply in German. French → French. Spanish → Spanish. etc.
- Only consider the recipient's messages, not the user's messages
- If the conversation is in English, reply in English
- Do NOT assume language from names - a person named "Flávia" writing in English should get English replies

OUTPUT: Return ONLY a JSON array of 3 strings:
["Reply 1", "Reply 2", "Reply 3"]`
}

export function buildUserPrompt(context: PromptContext): string {
  const {
    currentUser,
    recipient,
    conversationHistory,
    conversationSummary,
    lastMessageSender,
    lastMessageTime,
    isActiveConversation,
    userContext,
    customInstructions,
    actionType,
    customPrompt,
    companyNews,
    personActivity,
    meetingLink
  } = context

  const lines: string[] = []

  lines.push(`=== GENERATE ${actionType.toUpperCase().replace('_', ' ')} SUGGESTIONS ===\n`)
  lines.push(ACTION_INSTRUCTIONS[actionType])
  lines.push('')

  // Custom prompt for custom action
  if (actionType === 'custom' && customPrompt) {
    lines.push(`USER'S SPECIFIC REQUEST: ${customPrompt}`)
    lines.push('')
  }

  // Current user info
  lines.push('=== ABOUT ME (the person you\'re writing for) ===')
  if (currentUser?.name) {
    lines.push(`Name: ${currentUser.name}`)
  }
  if (currentUser?.headline) {
    lines.push(`Role: ${currentUser.headline}`)
  }
  if (currentUser?.company) {
    lines.push(`Company: ${currentUser.company}`)
  }
  if (userContext?.trim()) {
    lines.push(`Additional context: ${userContext.trim()}`)
  }
  lines.push('')

  // Recipient info
  lines.push('=== ABOUT THE RECIPIENT ===')
  if (recipient?.name) {
    lines.push(`Name: ${recipient.name}`)
  }
  if (recipient?.headline) {
    lines.push(`Role: ${recipient.headline}`)
  }
  if (recipient?.company) {
    lines.push(`Company: ${recipient.company}`)
  }
  lines.push('')

  // Company news if available
  if (companyNews && recipient?.company) {
    lines.push(`=== 🔥 RECENT NEWS: ${recipient.company.toUpperCase()} ===`)
    lines.push(companyNews)
    lines.push('')
    lines.push('💡 TIP: If relevant to the conversation, referencing recent news shows you\'re informed and engaged.')
    lines.push('')
  }

  // Person's recent activity/posts if available
  if (personActivity && recipient?.name) {
    lines.push(`=== ${recipient.name.toUpperCase()}'S RECENT ACTIVITY ===`)
    lines.push(personActivity)
    lines.push('')
    lines.push('💡 TIP: Reference their posts/activity if it naturally fits - it creates connection.')
    lines.push('')
  }

  // Custom instructions
  if (customInstructions?.trim()) {
    lines.push('=== MY RULES (always follow) ===')
    lines.push(customInstructions.trim())
    lines.push('')
  }

  // Meeting link for schedule_meeting action
  if (actionType === 'schedule_meeting' && meetingLink?.trim()) {
    lines.push('=== MY SCHEDULING LINK ===')
    lines.push(`Include this link when proposing a meeting: ${meetingLink.trim()}`)
    lines.push('Naturally incorporate the link into the message (e.g., "Here\'s my calendar: [link]" or "Feel free to grab a time: [link]")')
    lines.push('')
  }

  // Conversation state
  lines.push('=== CONVERSATION STATE ===')
  lines.push(conversationSummary)
  if (lastMessageSender && lastMessageTime) {
    console.log('[LinkedIn AI Debug] Last message time:', lastMessageTime)
    console.log('[LinkedIn AI Debug] Action type:', actionType)

    if (lastMessageSender === 'other') {
      lines.push(`→ ${recipient?.name || 'They'} messaged ${lastMessageTime}. Awaiting my reply.`)

      // For follow-ups, add time gap context only if significant time has passed
      if (actionType === 'follow_up') {
        const timeGapContext = analyzeTimeGap(lastMessageTime)
        if (timeGapContext) {
          lines.push(`→ TIME CONTEXT: ${timeGapContext}`)
        }
      }
    } else {
      lines.push(`→ I sent the last message ${lastMessageTime}.`)
      if (!isActiveConversation) {
        lines.push('→ Conversation has been quiet.')
      }

      // For follow-ups on our own messages
      if (actionType === 'follow_up') {
        const timeGapContext = analyzeTimeGap(lastMessageTime)
        if (timeGapContext) {
          lines.push(`→ TIME CONTEXT: ${timeGapContext}`)
        }
        lines.push('→ Re-engage without sounding pushy.')
      }
    }
  }
  lines.push('')

  // Conversation history
  lines.push('=== CONVERSATION HISTORY ===')
  lines.push(conversationHistory)
  lines.push('')

  lines.push('Generate 3 reply options as a JSON array. Match the language the recipient is using.')

  return lines.join('\n')
}

export function parseReplySuggestions(response: string): string[] {
  try {
    const jsonMatch = response.match(/\[[\s\S]*?\]/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed
          .filter(item => typeof item === 'string' && item.trim().length > 0)
          .map(item => item.trim())
        if (valid.length >= 1) {
          return valid.slice(0, 3)
        }
      }
    }
  } catch (e) {
    console.error('Failed to parse suggestions:', e)
  }

  // Fallback
  const lines = response
    .split('\n')
    .map(line => line.replace(/^\d+[\.\)]\s*/, '').replace(/^["']|["']$/g, '').replace(/^-\s*/, '').trim())
    .filter(line => line.length > 10 && line.length < 500)

  return lines.length >= 1 ? lines.slice(0, 3) : ['Unable to generate suggestions. Please try again.']
}
