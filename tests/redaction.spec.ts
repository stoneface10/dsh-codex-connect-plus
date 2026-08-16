import { describe, expect, it } from 'vitest'
import { redactProviderDiagnostic } from '../src/redaction.ts'

describe('provider diagnostic redaction', () => {
  it('bounds and removes common OAuth, bearer, JWT, and image secrets', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature'
    const value = JSON.stringify({
      access_token: 'opaque-access',
      refresh_token: 'opaque-refresh',
      authorization: 'secret-header',
      code: 'oauth-code',
      b64_json: 'QUJDRA==',
      bearer: 'Bearer bearer-secret',
      jwt,
      image: 'data:image/png;base64,AAAA',
    })
    const redacted = redactProviderDiagnostic(value)
    for (const secret of ['opaque-access', 'opaque-refresh', 'secret-header', 'oauth-code', 'QUJDRA==', 'bearer-secret', jwt, 'base64,AAAA']) {
      expect(redacted).not.toContain(secret)
    }
    expect(redactProviderDiagnostic('x'.repeat(2000))).toHaveLength(1000)
  })

  it('redacts query-style credentials', () => {
    const redacted = redactProviderDiagnostic('https://example.invalid/?code=abc&access_token=def')
    expect(redacted).not.toContain('code=abc')
    expect(redacted).not.toContain('access_token=def')
  })
})
