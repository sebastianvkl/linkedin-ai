import type { PlasmoMessaging } from '@plasmohq/messaging'
import { Storage } from '@plasmohq/storage'
import type { ToneType } from '~lib/prompts'

export interface UserProfile {
  name: string | null
  headline: string | null
  profileUrl: string | null
  company: string | null
  jobDescription?: string | null
}

export interface GenerateOutreachRequest {
  currentUser: UserProfile
  recipient: UserProfile
  customPrompt?: string
}

export interface GenerateOutreachResponse {
  suggestions: string[]
  research?: {
    company: string | null
    person: string | null
  }
  error?: string
}

// Simple rate limiter
const rateLimiter = {
  requests: [] as number[],
  maxRequests: 10,
  windowMs: 60000, // 1 minute

  canMakeRequest(): boolean {
    const now = Date.now()
    this.requests = this.requests.filter(time => now - time < this.windowMs)
    return this.requests.length < this.maxRequests
  },

  recordRequest() {
    this.requests.push(Date.now())
  },

  getTimeUntilReset(): number {
    if (this.requests.length === 0) return 0
    const oldestRequest = Math.min(...this.requests)
    return Math.max(0, this.windowMs - (Date.now() - oldestRequest))
  }
}

// Extract text content from API response (handles thinking blocks)
function extractTextFromResponse(data: any): string {
  let content = ''
  for (const block of data.content || []) {
    if (block.type === 'text') {
      content += block.text + '\n'
    }
    // Skip thinking blocks - they're for internal reasoning
  }
  return content.trim()
}

// Get current month and year for search queries
function getRecentDateRange(): { currentMonth: string; currentYear: number; lastMonth: string; lastYear: number } {
  const now = new Date()
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const currentMonth = months[now.getMonth()]
  const currentYear = now.getFullYear()
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonth = months[lastMonthDate.getMonth()]
  const lastYear = lastMonthDate.getFullYear()
  return { currentMonth, currentYear, lastMonth, lastYear }
}

// Search for recent company news (last 1-3 months)
async function searchRecentCompanyNews(companyName: string, apiKey: string): Promise<string | null> {
  try {
    const { currentMonth, currentYear, lastMonth } = getRecentDateRange()

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        thinking: {
          type: 'enabled',
          budget_tokens: 8000
        },
        tools: [{
          type: 'web_search',
          name: 'web_search',
          max_uses: 10
        }],
        messages: [{
          role: 'user',
          content: `Find the MOST RECENT news about "${companyName}" company from the last 1-3 months (${lastMonth} - ${currentMonth} ${currentYear}).

DO THESE SPECIFIC SEARCHES:
1. Search: "${companyName} news ${currentMonth} ${currentYear}"
2. Search: "${companyName} announcement ${currentYear}"
3. Search: "${companyName} funding OR raised OR investment ${currentYear}"
4. Search: "${companyName} launch OR launched OR release ${currentYear}"
5. Search: "${companyName} partnership OR partner OR acquisition ${currentYear}"
6. Search: "${companyName} hiring OR expansion OR growth ${currentYear}"

For each search, look for NEWS ARTICLES from reputable sources (TechCrunch, Forbes, Bloomberg, Reuters, industry publications, company press releases).

REPORT ONLY:
- **Date** of the news (be specific: "January 15, 2025" not just "recently")
- **Source** (where you found it)
- **What happened** (1-2 sentences)

If you find NO recent news (last 3 months), say "No recent news found" and briefly mention the most recent news you CAN find, even if older.

FORMAT:
📰 RECENT NEWS (Last 1-3 months):
- [Date] [Source]: What happened
- [Date] [Source]: What happened

🕐 OLDER NEWS (if no recent news):
- [Date] [Source]: What happened`
        }]
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Recent news search failed:', response.status, errorText)
      return null
    }

    const data = await response.json()
    return extractTextFromResponse(data) || null
  } catch (e) {
    console.error('Failed to search recent news:', e)
    return null
  }
}

// Research a company using web search with extended thinking
async function researchCompany(companyName: string, apiKey: string, userContext: string | null): Promise<string | null> {
  try {
    // Build context about what the user does to make research more targeted
    const userContextSection = userContext
      ? `\n\nCONTEXT: I work at a company that ${userContext}. Find information that would help me understand if/how we could help them.`
      : ''

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        thinking: {
          type: 'enabled',
          budget_tokens: 10000
        },
        tools: [{
          type: 'web_search',
          name: 'web_search',
          max_uses: 8
        }],
        messages: [{
          role: 'user',
          content: `Research "${companyName}" company. I need specific, actionable information to craft a personalized cold outreach message.${userContextSection}

SEARCH STRATEGY - Do multiple searches:
1. Search: "${companyName} company products services" - understand what they do
2. Search: "${companyName} news 2024 2025" - find recent announcements
3. Search: "${companyName} challenges problems" - find pain points
4. Search: "${companyName} hiring jobs" - understand growth areas and needs
5. Search: "${companyName} competitors" - understand their market

EXTRACT AND REPORT:
1. **What They Do**: Core products/services in plain language
2. **Recent News** (last 6 months): Funding, launches, partnerships, acquisitions, leadership changes
3. **Pain Points & Challenges**: What problems might they be facing? (scaling, hiring, tech debt, competition, etc.)
4. **Growth Areas**: Where are they investing? What roles are they hiring for?
5. **Tech Stack** (if relevant): What technologies do they use?
6. **Conversation Hooks**: Specific recent events or achievements I could reference

Be SPECIFIC. Don't give generic statements. I need concrete details I can reference in my outreach.`
        }]
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Company research failed:', response.status, errorText)
      return null
    }

    const data = await response.json()
    return extractTextFromResponse(data) || null
  } catch (e) {
    console.error('Failed to research company:', e)
    return null
  }
}

// Research a person using web search with extended thinking
async function researchPerson(name: string, headline: string | null, company: string | null, jobDescription: string | null, apiKey: string): Promise<string | null> {
  try {
    const personContext = [
      name,
      headline ? `(${headline})` : '',
      company ? `at ${company}` : ''
    ].filter(Boolean).join(' ')

    const jobContext = jobDescription
      ? `\n\nJOB DESCRIPTION (from LinkedIn profile):\n${jobDescription}\n\n⚠️ NOTE: This job description may be from a PAST position, not their current role. Their headline is "${headline || 'unknown'}". Only reference this description if it clearly matches their current role in the headline. If it seems to be from a past job, ignore it.`
      : ''

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        thinking: {
          type: 'enabled',
          budget_tokens: 10000
        },
        tools: [{
          type: 'web_search',
          name: 'web_search',
          max_uses: 8
        }],
        messages: [{
          role: 'user',
          content: `Research ${personContext}. I need specific information to write a personalized cold outreach message.${jobContext}

SEARCH STRATEGY - Do multiple targeted searches:
1. Search: "${name} LinkedIn" - find their profile and recent posts
2. Search: "${name} ${company || ''}" - find mentions with their company
3. Search: "${name} podcast OR interview OR conference OR speaking" - find thought leadership
4. Search: "${name} article OR blog OR post" - find content they've created

EXTRACT AND REPORT:
1. **Recent LinkedIn Activity**: What have they posted about recently? What topics do they engage with?
2. **Thought Leadership**: Podcasts, conference talks, articles, or interviews they've done
3. **Career Highlights**: Notable achievements, awards, promotions, or career moves
4. **Topics They Care About**: Based on their content, what are they passionate about?
5. **Communication Style**: How do they write? Formal? Casual? Technical? Inspirational?
6. **Specific Hooks**: Concrete things I can reference (a specific post, talk, article, achievement)

IMPORTANT:
- Be SPECIFIC. Give me exact titles of posts, talks, or articles if you find them.
- If you can't find much about this person, say so clearly and suggest what might work as an angle based on their role/headline.
- Don't make things up - only report what you actually find.`
        }]
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Person research failed:', response.status, errorText)
      return null
    }

    const data = await response.json()
    return extractTextFromResponse(data) || null
  } catch (e) {
    console.error('Failed to research person:', e)
    return null
  }
}

// Detect language from text
function detectLanguage(text: string): string {
  if (!text) return 'English'

  // Common patterns for different languages
  const germanPatterns = /\b(und|der|die|das|ist|für|mit|bei|von|auf|nicht|ein|eine|auch|als|nach|werden|oder|haben|sich|wird|sind|wurde|können|mehr|über|zum|zur)\b/gi
  const frenchPatterns = /\b(et|le|la|les|de|du|des|est|pour|avec|dans|sur|pas|un|une|que|qui|nous|vous|sont|cette|peut|plus|être|fait|aussi)\b/gi
  const spanishPatterns = /\b(el|la|los|las|de|del|en|que|es|para|con|por|un|una|son|está|más|como|pero|sus|sobre|tiene|puede|hace|este|esta)\b/gi
  const dutchPatterns = /\b(de|het|een|van|en|in|is|op|te|voor|met|zijn|dat|wordt|ook|aan|door|naar|maar|bij|uit|om|kan|niet|worden)\b/gi
  const italianPatterns = /\b(il|la|di|che|è|per|un|una|sono|con|non|da|del|della|più|come|anche|questo|questa|essere|fatto|può|suoi|sua)\b/gi
  const portuguesePatterns = /\b(o|a|os|as|de|da|do|que|é|para|um|uma|com|por|são|está|mais|como|mas|seu|sua|pode|também|sobre|este|esta)\b/gi

  const germanCount = (text.match(germanPatterns) || []).length
  const frenchCount = (text.match(frenchPatterns) || []).length
  const spanishCount = (text.match(spanishPatterns) || []).length
  const dutchCount = (text.match(dutchPatterns) || []).length
  const italianCount = (text.match(italianPatterns) || []).length
  const portugueseCount = (text.match(portuguesePatterns) || []).length

  const counts = [
    { lang: 'German', count: germanCount },
    { lang: 'French', count: frenchCount },
    { lang: 'Spanish', count: spanishCount },
    { lang: 'Dutch', count: dutchCount },
    { lang: 'Italian', count: italianCount },
    { lang: 'Portuguese', count: portugueseCount }
  ]

  const maxLang = counts.reduce((max, curr) => curr.count > max.count ? curr : max, { lang: 'English', count: 0 })

  // Only return non-English if we have strong signal (at least 3 matches)
  if (maxLang.count >= 3) {
    return maxLang.lang
  }

  return 'English'
}

// Build the outreach prompt
function buildOutreachPrompt(
  currentUser: UserProfile,
  recipient: UserProfile,
  companyResearch: string | null,
  personResearch: string | null,
  recentNews: string | null,
  userContext: string | null,
  customInstructions: string | null,
  outreachInstructions: string | null,
  customPrompt: string | null,
  tone: ToneType
): string {
  const lines: string[] = []

  // Detect language from recipient's profile
  const profileText = [
    recipient.headline,
    recipient.jobDescription,
    recipient.company
  ].filter(Boolean).join(' ')

  const detectedLanguage = detectLanguage(profileText)

  lines.push('=== GENERATE PERSONALIZED OUTREACH MESSAGE ===')
  lines.push('')
  lines.push(`Generate a personalized cold outreach message for LinkedIn.
This is a FIRST MESSAGE - there is no prior conversation history.

CRITICAL REQUIREMENTS:
1. **Lead with SPECIFIC research** - Reference something concrete: a specific post they wrote, a recent company announcement, a talk they gave, a challenge they might face
2. **Show you did your homework** - Don't say "I saw your profile" - say "Your post about [specific topic] resonated with me because..."
3. **Connect to their world** - Frame your outreach around THEIR priorities and challenges, not yours
4. **Keep it brief** - 2-4 sentences max. No one reads long cold messages.
5. **Soft CTA** - "Would love to exchange ideas" or "Open to a quick chat?" NOT "Let me show you a demo"
6. **Sound human** - Write like a real person, not a sales template

AVOID:
- "I came across your profile" (too generic)
- "I'm reaching out because" (boring opener)
- Long paragraphs about your company
- Multiple questions
- Overly formal language
- Mentioning research you didn't actually do
- Referencing a job description as their CURRENT work if they've moved on (always check if their headline matches the job description - if not, it's likely from a past role!)`)
  lines.push('')

  if (customPrompt) {
    lines.push(`SPECIFIC REQUEST: ${customPrompt}`)
    lines.push('')
  }

  // Current user info
  lines.push('=== ABOUT ME (the person sending the message) ===')
  if (currentUser?.name) lines.push(`Name: ${currentUser.name}`)
  if (currentUser?.headline) lines.push(`Role: ${currentUser.headline}`)
  if (currentUser?.company) lines.push(`Company: ${currentUser.company}`)
  if (userContext?.trim()) lines.push(`Background: ${userContext.trim()}`)
  lines.push('')

  // Recipient info
  lines.push('=== ABOUT THE RECIPIENT ===')
  if (recipient?.name) lines.push(`Name: ${recipient.name}`)
  if (recipient?.headline) lines.push(`Role: ${recipient.headline}`)
  if (recipient?.company) lines.push(`Company: ${recipient.company}`)
  if (recipient?.jobDescription) {
    lines.push('')
    lines.push('**Job Description from LinkedIn profile:**')
    lines.push(recipient.jobDescription)
    lines.push('')
    lines.push(`⚠️ IMPORTANT: This job description may be from a PAST role, not their current position!
   - Their headline says: "${recipient.headline || 'unknown'}"
   - Only reference this job description if it clearly matches their CURRENT role in the headline
   - If the headline mentions a different company/role, this description is likely outdated - DO NOT reference it as their current work
   - When in doubt, focus on their headline and company, not the job description`)
  }
  lines.push('')

  // Recent news (most important for timely outreach!)
  if (recentNews && recipient?.company) {
    lines.push(`=== 🔥 RECENT NEWS: ${recipient.company.toUpperCase()} (LAST 1-3 MONTHS) ===`)
    lines.push(recentNews)
    lines.push('')
    lines.push('⚡ IMPORTANT: If there is recent news above, strongly consider referencing it in your outreach!')
    lines.push('   Recent news is the BEST conversation starter - it shows you did your homework.')
    lines.push('')
  }

  // Research data
  if (personResearch) {
    lines.push(`=== RESEARCH: ${recipient?.name?.toUpperCase() || 'RECIPIENT'} ===`)
    lines.push(personResearch)
    lines.push('')
  }

  if (companyResearch && recipient?.company) {
    lines.push(`=== COMPANY BACKGROUND: ${recipient.company.toUpperCase()} ===`)
    lines.push(companyResearch)
    lines.push('')
  }

  // Outreach-specific instructions (primary for outreach)
  if (outreachInstructions?.trim()) {
    lines.push('=== OUTREACH INSTRUCTIONS (follow carefully) ===')
    lines.push(outreachInstructions.trim())
    lines.push('')
  }

  // General custom instructions (secondary)
  if (customInstructions?.trim()) {
    lines.push('=== ADDITIONAL RULES ===')
    lines.push(customInstructions.trim())
    lines.push('')
  }

  // Tone guidance
  const toneDescriptions: Record<ToneType, string> = {
    professional: 'formal and business-appropriate',
    friendly: 'warm and personable while still professional',
    casual: 'relaxed and conversational'
  }
  lines.push(`TONE: ${toneDescriptions[tone]}`)
  lines.push('')

  // Add language instruction
  if (detectedLanguage !== 'English') {
    lines.push(`LANGUAGE: Write the message in ${detectedLanguage} - the recipient's profile is in ${detectedLanguage}.`)
    lines.push('')
  }

  lines.push(`Generate 3 different outreach message options as a JSON array: ["Option 1", "Option 2", "Option 3"]

Each option MUST take a different angle:
- **Option 1**: Lead with something about THEM personally (their post, talk, article, achievement)
- **Option 2**: Lead with something about their COMPANY (recent news, growth, challenges)
- **Option 3**: Lead with a shared interest, mutual connection, or industry insight

Each message should be 2-4 sentences and feel genuinely personalized based on the research above.${detectedLanguage !== 'English' ? ` Write ALL messages in ${detectedLanguage}.` : ''}`)

  return lines.join('\n')
}

// Parse response into suggestions
function parseOutreachSuggestions(response: string): string[] {
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
    console.error('Failed to parse outreach suggestions:', e)
  }

  // Fallback
  const lines = response
    .split('\n')
    .map(line => line.replace(/^\d+[\.\)]\s*/, '').replace(/^["']|["']$/g, '').replace(/^-\s*/, '').trim())
    .filter(line => line.length > 10 && line.length < 500)

  return lines.length >= 1 ? lines.slice(0, 3) : ['Unable to generate outreach suggestions. Please try again.']
}

const handler: PlasmoMessaging.MessageHandler<GenerateOutreachRequest, GenerateOutreachResponse> = async (req, res) => {
  const storage = new Storage()

  try {
    // Check rate limit
    if (!rateLimiter.canMakeRequest()) {
      const waitTime = Math.ceil(rateLimiter.getTimeUntilReset() / 1000)
      return res.send({
        suggestions: [],
        error: `Rate limit reached. Please wait ${waitTime} seconds before trying again.`
      })
    }

    // Get API key from storage
    const apiKey = await storage.get<string>('claude_api_key')
    if (!apiKey) {
      return res.send({
        suggestions: [],
        error: 'API key not configured. Please set your Claude API key in the extension popup.'
      })
    }

    // Get user preferences
    const tone = (await storage.get<ToneType>('tone')) || 'professional'
    const userContext = await storage.get<string>('user_context')
    const customInstructions = await storage.get<string>('custom_instructions')
    const outreachInstructions = await storage.get<string>('outreach_instructions')

    const { currentUser, recipient, customPrompt } = req.body

    if (!recipient?.name) {
      return res.send({
        suggestions: [],
        error: 'Could not identify the recipient. Please ensure you have a conversation open.'
      })
    }

    // Perform research in parallel
    let companyResearch: string | null = null
    let personResearch: string | null = null
    let recentNews: string | null = null

    const researchPromises: Promise<void>[] = []

    if (recipient?.company) {
      // General company research
      researchPromises.push(
        researchCompany(recipient.company, apiKey, userContext || null)
          .then(research => { companyResearch = research })
          .catch(() => {})
      )

      // Dedicated recent news search
      researchPromises.push(
        searchRecentCompanyNews(recipient.company, apiKey)
          .then(news => { recentNews = news })
          .catch(() => {})
      )
    }

    if (recipient?.name) {
      researchPromises.push(
        researchPerson(recipient.name, recipient.headline, recipient.company, recipient.jobDescription || null, apiKey)
          .then(research => { personResearch = research })
          .catch(() => {})
      )
    }

    // Wait for research (with timeout - extended for deep thinking)
    await Promise.race([
      Promise.all(researchPromises),
      new Promise(resolve => setTimeout(resolve, 60000)) // 60s timeout for research with extended thinking
    ])

    console.log('LinkedIn AI: Research completed', {
      hasCompanyResearch: !!companyResearch,
      hasPersonResearch: !!personResearch,
      hasRecentNews: !!recentNews
    })

    // Build prompt
    const prompt = buildOutreachPrompt(
      currentUser,
      recipient,
      companyResearch,
      personResearch,
      recentNews,
      userContext || null,
      customInstructions || null,
      outreachInstructions || null,
      customPrompt || null,
      tone
    )

    // Record the request for rate limiting
    rateLimiter.recordRequest()

    // Generate outreach messages with extended thinking
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        thinking: {
          type: 'enabled',
          budget_tokens: 10000
        },
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || `API error: ${response.status}`

      if (response.status === 401) {
        return res.send({
          suggestions: [],
          error: 'Invalid API key. Please check your Claude API key in the extension settings.'
        })
      }

      if (response.status === 429) {
        return res.send({
          suggestions: [],
          error: 'Claude API rate limit reached. Please wait a moment and try again.'
        })
      }

      return res.send({
        suggestions: [],
        error: errorMessage
      })
    }

    const data = await response.json()
    const content = extractTextFromResponse(data)

    const suggestions = parseOutreachSuggestions(content)

    if (suggestions.length === 0 || (suggestions.length === 1 && suggestions[0].includes('Unable to generate'))) {
      return res.send({
        suggestions: [],
        error: 'Could not generate outreach suggestions. Please try again.'
      })
    }

    return res.send({
      suggestions,
      research: {
        company: companyResearch,
        person: personResearch,
        recentNews: recentNews
      }
    })
  } catch (error) {
    console.error('Generate outreach error:', error)

    if (error instanceof TypeError && error.message.includes('fetch')) {
      return res.send({
        suggestions: [],
        error: 'Network error. Please check your internet connection.'
      })
    }

    return res.send({
      suggestions: [],
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    })
  }
}

export default handler
