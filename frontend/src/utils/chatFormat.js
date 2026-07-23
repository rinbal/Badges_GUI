/**
 * Chat content formatting utilities.
 *
 * Cleans and formats message content for display across all chat types:
 * - Support chat (MessageBubble)
 * - Group chat (MessageBubble)
 * - Private DMs (MessageBubble)
 */

/**
 * Strip protocol markers and hidden comments from message content.
 *
 * Some Nostr clients inject markdown hidden comments like:
 *   [//]: # (nip18)
 *   [//]: # (nostr:...)
 *
 * These are protocol metadata, not user content.
 */
export function cleanMessageContent(content) {
  if (!content) return ''

  return content
    // Remove markdown hidden comments: [//]: # (anything)
    .replace(/^\[\/\/\]: # \([^)]*\)\s*/gm, '')
    // Remove nostr: URI prefixes that some clients add as plain text
    .replace(/^nostr:[a-z0-9]+\s*/gm, '')
    // Trim leading/trailing whitespace left after stripping
    .trim()
}

/**
 * Auto-linkify URLs in already-escaped HTML content.
 * Excludes quotes and special chars from URL matching to prevent XSS.
 */
export function linkifyUrls(escapedHtml) {
  return escapedHtml.replace(
    /(https?:\/\/[^\s<"'()]+)/g,
    (url) => {
      const safeHref = encodeURI(decodeURI(url))
      return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" class="msg-link">${url}</a>`
    }
  )
}

/**
 * Escape HTML entities for safe rendering with v-html.
 */
export function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
