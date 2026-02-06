import type { PlasmoMessaging } from '@plasmohq/messaging'
import { Storage } from '@plasmohq/storage'
import type { ToneType } from '~lib/prompts'

export interface PostContext {
  authorName: string | null
  authorHeadline: string | null
  postContent: string
  postType: 'text' | 'image' | 'video' | 'article' | 'celebration'
}

export interface GenerateCommentRequest {
  post: PostContext
  commentType: 'supportive' | 'insightful' | 'question' | 'congratulate' | 'custom'
  customPrompt?: string
}

export interface GenerateCommentResponse {
  suggestions: string[]
  error?: string
}

// Detect language from text
function detectLanguage(text: string): string {
  if (!text) return 'English'

  const germanPatterns = /\b(und|der|die|das|ist|für|mit|bei|von|auf|nicht|ein|eine|auch|als|nach|werden|oder|haben|sich|wird|sind|wurde|können|mehr|über|zum|zur|hallo|grüße|vielen|dank|bitte|gerne|freuen)\b/gi
  const frenchPatterns = /\b(et|le|la|les|de|du|des|est|pour|avec|dans|sur|pas|un|une|que|qui|nous|vous|sont|cette|peut|plus|être|fait|aussi|bonjour|merci|cordialement)\b/gi
  const spanishPatterns = /\b(el|la|los|las|de|del|en|que|es|para|con|por|un|una|son|está|más|como|pero|sus|sobre|tiene|puede|hola|gracias|buenas)\b/gi
  const dutchPatterns = /\b(de|het|een|van|en|in|is|op|te|voor|met|zijn|dat|wordt|ook|aan|door|naar|maar|bij|uit|om|kan|niet|worden|bedankt|groeten)\b/gi
  const italianPatterns = /\b(il|la|di|che|è|per|un|una|sono|con|non|da|del|della|più|come|anche|questo|questa|essere|ciao|grazie|buongiorno)\b/gi
  const portuguesePatterns = /\b(o|a|os|as|de|da|do|que|é|para|um|uma|com|por|são|está|mais|como|mas|seu|sua|pode|olá|obrigado|obrigada)\b/gi

  const counts = [
    { lang: 'German', count: (text.match(germanPatterns) || []).length },
    { lang: 'French', count: (text.match(frenchPatterns) || []).length },
    { lang: 'Spanish', count: (text.match(spanishPatterns) || []).length },
    { lang: 'Dutch', count: (text.match(dutchPatterns) || []).length },
    { lang: 'Italian', count: (text.match(italianPatterns) || []).length },
    { lang: 'Portuguese', count: (text.match(portuguesePatterns) || []).length }
  ]

  const maxLang = counts.reduce((max, curr) => curr.count > max.count ? curr : max, { lang: 'English', count: 0 })
  return maxLang.count >= 3 ? maxLang.lang : 'English'
}

const COMMENT_TYPE_INSTRUCTIONS: Record<string, string> = {
  supportive: `Generate a casual, supportive one-liner:
- Quick and genuine reaction
- Like texting a friend about something cool they shared`,
  insightful: `Generate a casual one-liner that adds a quick thought:
- Brief perspective or "same here" vibe
- Conversational, not preachy`,
  question: `Generate a casual curious question:
- Quick genuine question, like asking a friend
- Not formal or interview-style`,
  congratulate: `Generate a casual congrats one-liner:
- Quick celebratory reaction
- Like high-fiving a colleague`,
  custom: 'Follow the specific custom instruction provided, but keep it casual and brief.'
}

function buildCommentSystemPrompt(tone: ToneType): string {
  return `You generate casual LinkedIn comment one-liners.

STYLE: Casual, conversational, like texting a work friend. NOT corporate-speak.

RULES:
- Generate exactly 3 options
- ONE LINE ONLY. Max 10-15 words. Seriously, keep it short.
- Sound like a real person, not a LinkedIn influencer
- No emojis (unless the post has them)
- No hashtags
- No "Great post!", "Love this!", "This is so true!" - these are banned
- No "This resonates with me" or "I couldn't agree more" - too formal
- Be specific to what they actually said
- Match their energy - if they're casual, be casual
- IMPORTANT: Match the language of the post. If the post is in German, comment in German. Same for any other language.

GOOD EXAMPLES:
- "ha, learned this the hard way last quarter"
- "the second point is underrated tbh"
- "we ran into the same thing, ended up just rebuilding it"
- "curious how you handled the timeline on this?"

BAD EXAMPLES (don't do these):
- "What a fantastic insight! This really resonates with my experience in the industry."
- "Congratulations on this well-deserved achievement! Your hard work is truly inspiring."
- "Great post! Thanks for sharing your valuable perspective."

OUTPUT: Return ONLY a JSON array: ["comment 1", "comment 2", "comment 3"]`
}

function buildCommentUserPrompt(
  post: PostContext,
  commentType: string,
  customPrompt: string | null,
  userContext: string | null,
  customInstructions: string | null
): string {
  const lines: string[] = []

  lines.push(`=== GENERATE ${commentType.toUpperCase()} COMMENT ===\n`)
  lines.push(COMMENT_TYPE_INSTRUCTIONS[commentType] || COMMENT_TYPE_INSTRUCTIONS.supportive)
  lines.push('')

  if (commentType === 'custom' && customPrompt) {
    lines.push(`CUSTOM INSTRUCTION: ${customPrompt}`)
    lines.push('')
  }

  if (userContext?.trim()) {
    lines.push('=== ABOUT ME (the commenter) ===')
    lines.push(userContext.trim())
    lines.push('')
  }

  // Add custom instructions (reply instructions) - these apply to comments too
  if (customInstructions?.trim()) {
    lines.push('=== MY RULES (always follow these) ===')
    lines.push(customInstructions.trim())
    lines.push('')
  }

  lines.push('=== POST DETAILS ===')
  if (post.authorName) {
    lines.push(`Author: ${post.authorName}`)
  }
  if (post.authorHeadline) {
    lines.push(`Author Role: ${post.authorHeadline}`)
  }
  if (post.postType !== 'text') {
    lines.push(`Post Type: ${post.postType}`)
  }
  lines.push('')
  lines.push('=== POST CONTENT ===')
  lines.push(post.postContent)
  lines.push('')

  // Detect language from post content
  const detectedLanguage = detectLanguage(post.postContent)
  if (detectedLanguage !== 'English') {
    lines.push(`=== LANGUAGE ===`)
    lines.push(`The post is in ${detectedLanguage}. You MUST write ALL comments in ${detectedLanguage}.`)
    lines.push('')
  }

  lines.push(`Generate 3 casual one-liner comments (max 10-15 words each) as a JSON array.${detectedLanguage !== 'English' ? ` Write ALL comments in ${detectedLanguage}.` : ''}`)

  return lines.join('\n')
}

function parseCommentSuggestions(response: string): string[] {
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
    console.error('Failed to parse comment suggestions:', e)
  }

  // Fallback
  const lines = response
    .split('\n')
    .map(line => line.replace(/^\d+[\.\)]\s*/, '').replace(/^["']|["']$/g, '').replace(/^-\s*/, '').trim())
    .filter(line => line.length > 5 && line.length < 300)

  return lines.length >= 1 ? lines.slice(0, 3) : ['Unable to generate comments. Please try again.']
}

const handler: PlasmoMessaging.MessageHandler<GenerateCommentRequest, GenerateCommentResponse> = async (req, res) => {
  const storage = new Storage()

  try {
    const apiKey = await storage.get<string>('claude_api_key')
    if (!apiKey) {
      return res.send({
        suggestions: [],
        error: 'API key not configured. Please set your Claude API key in the extension settings.'
      })
    }

    const tone = (await storage.get<ToneType>('tone')) || 'professional'
    const userContext = await storage.get<string>('user_context')
    const customInstructions = await storage.get<string>('custom_instructions')

    const { post, commentType, customPrompt } = req.body

    if (!post?.postContent) {
      return res.send({
        suggestions: [],
        error: 'Could not extract post content. Please try again.'
      })
    }

    const systemPrompt = buildCommentSystemPrompt(tone)
    const userPrompt = buildCommentUserPrompt(post, commentType, customPrompt || null, userContext || null, customInstructions || null)

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
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return res.send({
        suggestions: [],
        error: errorData.error?.message || `API error: ${response.status}`
      })
    }

    const data = await response.json()
    const content = data.content?.[0]?.text || ''
    const suggestions = parseCommentSuggestions(content)

    return res.send({ suggestions })
  } catch (error) {
    console.error('Generate comment error:', error)
    return res.send({
      suggestions: [],
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    })
  }
}

export default handler
