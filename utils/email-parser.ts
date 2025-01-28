export function parseEmailBody(html: string | null): string {
  if (!html) return '';
  
  try {
    // Simple sanitization first
    const sanitized = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove styles
      .replace(/<[^>]+>/g, ' ') // Replace tags with spaces
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with spaces
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();

    return sanitized;
  } catch (error) {
    console.error('Error parsing email body:', error);
    return html || '';
  }
}

export function getEmailPreview(html: string | null, maxLength: number = 150): string {
  const parsed = parseEmailBody(html);
  if (!parsed) return '';
  const cleaned = parsed
    .replace(/\s+/g, ' ')
    .replace(/>\s*/g, '') // Remove quoted text markers
    .trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.substring(0, maxLength).trim() + '...';
} 