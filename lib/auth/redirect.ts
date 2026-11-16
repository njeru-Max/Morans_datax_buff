const INTERNAL_ORIGIN = 'https://platform.invalid'

export function safeInternalPath(value: unknown, fallback = '/') {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.startsWith('/\\') ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return fallback
  }

  try {
    const url = new URL(value, INTERNAL_ORIGIN)

    if (url.origin !== INTERNAL_ORIGIN) {
      return fallback
    }

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}
