/* dsh-codex-connect-plus shared provider-error redaction; Copyright 2026 0751; Apache-2.0, see NOTICE. */

/** Bound and redact untrusted diagnostics before logging or surfacing them. */
export function redactProviderDiagnostic(value: unknown, maxLength = 1000): string {
  return (value instanceof Error ? value.message : String(value))
    .slice(0, Math.max(0, maxLength))
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, '[redacted token]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/giu, 'Bearer [redacted]')
    .replace(/("?(?:access(?:_token)?|refresh(?:_token)?|token|authorization|b64_json|code)"?\s*[:=]\s*")([^"\s]+)/giu, '$1[redacted]')
    .replace(/(\b(?:code|token|refresh_token|access_token|authorization)=)[^&\s]+/giu, '$1[redacted]')
    .replace(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/giu, '[redacted image data]')
}
