# Installation Runbook for CLI Agents

Install `dsh-codex-connect-plus` into one requested DeepSeek Harness profile without changing its current default model, search route, global configuration, or OAuth state.

## Safety requirements

- Never read, print, copy, move, or modify `~/.codex/auth.json`.
- Never print or inspect `$DSH_HOME/.openai-codex-auth.json`; `doctor` may inspect pathname metadata only.
- Never add OAuth URLs, codes, tokens, account identifiers, or generated profile state to Git.
- Preserve every unrelated profile dependency and patch row.
- Do not start login unless the user explicitly asks to authenticate.

## Install and validate

1. Check `dsh --version` or `dsh --help`. From a Harness checkout use `pnpm dsh`.
2. Install the immutable GitHub tag (the package is not yet published to npm):

   ```sh
   dsh plugin --profile web add 'github:stoneface10/dsh-codex-connect-plus#v0.1.0-alpha.2'
   ```

   Alternatively, download the `.tgz` attached to the matching GitHub prerelease and install that local path. Verify its published SHA-256 before installation.

3. Run `dsh --profile web --dump-config` and require exactly one `llm-openai-codex` row loading `dsh-codex-connect-plus`.
4. Confirm the effective `agent-default-model` and `web.searchProvider` values are unchanged from before installation.
5. Run secret-free diagnostics:

   ```sh
   dsh plugin --profile web exec dsh-codex-connect-plus doctor
   ```

6. If the user explicitly requests login, open **Settings → Plugins → Plugin configuration → Codex Connect Plus**, or check `status` and then use `login` or `login --device-code`. OAuth approval belongs to the user.

## Optional configuration

Use **Settings → Plugins → Plugin configuration → Codex Connect Plus** for staged Save/Discard edits. The package row supports `enableSearch` and `enableImageTool` (both default `false`) plus `enableImageGeneration` (default `true`). Enabling search registers a provider but does not select it; selecting `web.searchProvider: openai-codex` is a second explicit profile change. Setting `agent-default-model` to `openai-codex` is also a separate explicit change.

Apply only requested choices and preserve unrelated keys:

```yaml
- id: llm-openai-codex
  config:
    enableSearch: true
    enableImageTool: false
    searchMode: live

- id: web
  config:
    searchProvider: openai-codex

- id: agent-default-model
  config:
    provider: openai-codex
    model: gpt-5.6-sol
```

Do not add the last two rows unless the user separately requested those routing changes.

## Conflict handling

`openai-codex` can have only one adapter. If startup reports a collision, inspect the effective config and remove only the old `dsh-codex` bundle or manual `openai-codex` provider row after confirming it is the conflicting owner. Do not delete auth files or unrelated providers.

## Update and removal

```sh
dsh plugin --profile web update dsh-codex-connect-plus@alpha
dsh plugin --profile web remove dsh-codex-connect-plus
```

Use an exact npm version when a reproducible update is required; use a GitHub tag only as the npm-unavailable fallback.

Removal of the package and removal of its separate OAuth file are different actions. Run `dsh plugin --profile web exec dsh-codex-connect-plus logout` only with explicit credential-deletion authorization.

## Completion report

Report the profile, installed version, effective default model, effective search route, enabled optional capabilities, signed-in/signed-out state only if checked, and Web client detection. Never report OAuth URLs, codes, token timestamps, account ids, or auth-file contents.
