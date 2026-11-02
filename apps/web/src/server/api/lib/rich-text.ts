import sanitizeHtml from 'sanitize-html'

// Phase reports and final project reports are HTML from the rich-text editor.
// Everything passes through this allowlist on save, so pages can render it.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'h2',
    'h3',
    'h4',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'mark',
    'sub',
    'sup',
    'blockquote',
    'ul',
    'ol',
    'li',
    'a',
    'hr',
    'code',
    'pre',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
    '*': ['style'],
  },
  allowedStyles: { '*': { 'text-align': [/^(left|right|center|justify)$/] } },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { href: attribs.href ?? '', target: '_blank', rel: 'noopener noreferrer nofollow' },
    }),
  },
}

export function cleanHtml(html: string | null | undefined): string | null {
  if (!html) return null
  const clean = sanitizeHtml(html, OPTIONS).trim()
  // The editor's "empty" document.
  return clean === '' || clean === '<p></p>' ? null : clean
}
