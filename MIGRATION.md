# Migrating to `dsh-codex-connect-plus`

The combined package keeps the compatibility identifiers used by its upstream model plugin:

- provider: `openai-codex`
- OAuth file: `.openai-codex-auth.json`
- Cordis row: `llm-openai-codex`
- browser OAuth routes: unchanged

It also owns `view_image`, `codex_image_generate`, and `codex_image_edit` when the corresponding capabilities are enabled. Do not keep a legacy Codex provider or standalone Codex Images package active in the same profile.

## From `dsh-codex-connect` plus `dsh-codex-image-connect`

1. Record the effective default model, global search provider, and `llm-openai-codex` config. Do not read or copy any OAuth file.
2. Remove both old packages from the selected profile.
3. Add `dsh-codex-connect-plus`.
4. Keep exactly one `llm-openai-codex` row loading `dsh-codex-connect-plus`.
5. Set `enableSearch`, `enableImageTool`, and `enableImageGeneration` explicitly if the defaults do not match the desired behavior.
6. Run `--dump-config`, then `dsh plugin --profile <profile> exec dsh-codex-connect-plus doctor`.
7. Do not run OAuth again when `status` already reports signed in.

## From `dsh-codex`

Follow the same package swap, removing the legacy bundle before installing Plus. Search and `view_image` remain disabled by default; `gpt-image-2` generation/editing is enabled by default. Preserve the previous default-model and search routes only when the user wants those routes to remain selected.

## Rollback

Reverse the package swap and restore the recorded configuration. Package removal and credential deletion are separate actions: do not delete, copy, or move `.openai-codex-auth.json` during migration or rollback.

If Harness reports a duplicate `openai-codex` adapter or duplicate image tool name, an old package or manual row is still active. Resolve that conflicting row instead of changing credentials.
