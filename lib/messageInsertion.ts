import { findElement, queryShadowSelector } from './selectors'

// Insert text into LinkedIn's message input field
export function insertReply(text: string): boolean {
  const input = findElement('messageInput') as HTMLElement | null

  if (!input) {
    console.error('LinkedIn AI: Message input not found')
    return false
  }

  try {
    // Focus the input
    input.focus()

    // For contenteditable elements
    if (input.getAttribute('contenteditable') === 'true') {
      // Method 1: Try using execCommand (still works in most browsers for contenteditable)

      // Select all existing content
      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(input)
      selection?.removeAllRanges()
      selection?.addRange(range)

      // Try insertText command
      const inserted = document.execCommand('insertText', false, text)

      if (inserted) {
        // Dispatch events to notify LinkedIn
        dispatchInputEvents(input, text)
        return true
      }

      // Method 2: Fallback - directly set content and simulate paste
      input.textContent = text

      // Place cursor at end
      range.selectNodeContents(input)
      range.collapse(false)
      selection?.removeAllRanges()
      selection?.addRange(range)

      dispatchInputEvents(input, text)
      return true
    }

    // For regular inputs
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
      input.value = text
      dispatchInputEvents(input, text)
      return true
    }

    return false
  } catch (e) {
    console.error('Insert failed:', e)
    return false
  }
}

function dispatchInputEvents(element: HTMLElement, text: string): void {
  // Create and dispatch multiple events to ensure LinkedIn picks up the change

  // Input event
  const inputEvent = new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertText',
    data: text
  })
  element.dispatchEvent(inputEvent)

  // Also try a simpler input event
  element.dispatchEvent(new Event('input', { bubbles: true }))

  // Change event
  element.dispatchEvent(new Event('change', { bubbles: true }))

  // Keyup to trigger any key-based handlers
  element.dispatchEvent(new KeyboardEvent('keyup', {
    bubbles: true,
    key: 'a'
  }))
}

// Copy to clipboard - guaranteed to work
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (e) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    return success
  }
}

// Check if the message input is available or a conversation is open
export function isInputAvailable(): boolean {
  // Check for message input
  if (findElement('messageInput') !== null) return true

  // Check for conversation header (existing conversation)
  if (findElement('conversationHeader') !== null) return true

  // Check for new message recipient pill (compose window)
  if (findElement('newMessageRecipient') !== null) return true

  // Check for messaging overlay/container
  if (findElement('messagingContainer') !== null) return true

  return false
}
