# Security Policy

## Reporting

Do not open a public issue containing OAuth tokens, account identifiers, private prompts, generated private images, SSH material, or `.env` contents. Contact the repository owner privately and include only redacted diagnostics.

## Credential model

Codex Connect Plus stores OAuth credentials under the DSH home using the inherited owner-only credential store. It does not read `~/.codex/auth.json`, copy refresh tokens into project files, or implement a separate refresh endpoint. Provider-native refresh runs through pi-ai under the credential store lock.

## Codex Images boundary

The image feature calls fixed HTTPS Codex application endpoints. The interface is not claimed to be a public or supported OpenAI Platform API and may change. Requests reject redirects, enforce time and byte limits, verify decoded image signatures, and avoid automatic retries after ambiguous failures.

## Before publishing

- Run `pnpm run check`.
- Inspect `npm pack --dry-run`.
- Scan the complete Git history for credentials and generated output.
- Perform image smoke tests only with an explicitly authorized account.
- Never attach OAuth files, logs containing headers, or private generated images to a public issue.
