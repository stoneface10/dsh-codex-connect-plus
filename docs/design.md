# Codex Connect Plus: Alpha design

## Ownership and composition

The package registers `openai-codex` through Harness's public `LlmRuntime` and `PiAiAdapter` surfaces. The main model path is not a one-shot subagent: it remains the normal Harness agent loop, preserving native tool approvals, permission policy, streaming, attachment resolution, reasoning replay, session persistence, compaction, and recovery.

The bundle patch inserts only `llm-openai-codex`. It never writes `agent-default-model` or `web.searchProvider`. `enableSearch` and `enableImageTool` default to `false`; `enableImageGeneration` defaults to `true`. Optional service injections are not registered while disabled, and an image-capability activation failure does not prevent the Codex model adapter from loading.

The Host registers `llm-openai-codex` as the plugin-owned settings namespace and declares `OpenAI Codex` in the LLM configurable-provider directory. The browser binds that namespace through Harness's settings-scope transport and renders account, quota, Save/Discard capability controls in the existing Plugin configuration card. Revision-fenced field writes preserve unrelated settings. Committed changes reconcile search and image registrations live; the default-model and global-search namespaces are never written.

## OAuth persistence

The plugin uses `$DSH_HOME/.openai-codex-auth.json`, separate from Codex CLI/Desktop state. The file format is strict and versioned. POSIX reads reject group/world-accessible files. Parent directories and files are created with owner-only modes, writes are atomic, and refresh mutations use the Harness cross-process file lock. Callers receive cloned credentials.

The settings routes and CLI reuse the existing OAuth path and route names for migration compatibility. Only an explicit login operation emits an authorization URL or code. Browser requests must come from a loopback peer with a loopback Host and, when supplied, an exact loopback HTTP(S) Origin. A login challenge accepts only credential-free HTTPS URLs and fails closed after 30 seconds or when the provider finishes without a URL; logout and disposal cancel pending waiters. Status responses are redacted. Doctor uses `lstat` metadata and never opens the document.

## Search and images

When `enableSearch: true`, the plugin registers its standalone search provider and secret-free request event. Harness still requires explicit `web.searchProvider: openai-codex` when multiple providers exist. Search responses are mapped to Harness text and citation records.

When `enableImageTool: true`, `view_image` is registered only after tools, filesystem, and attachment services are available. Local files remain bounded by the Harness filesystem surface. Remote images allow only credential-free public HTTP(S): all DNS answers must be public unicast, each redirect is revalidated, and each socket is pinned to the validated address to close DNS-rebinding gaps. The tool also checks bounded bytes, accepted media signatures, and current-model image support before saving a Harness attachment.

User-uploaded and tool-produced images follow the normal `PiAiAdapter` attachment path independently of `view_image`. The Codex profile gives Harness explicit aggregate payload, pixel, and encoded-byte budgets so attachment preprocessing succeeds before the provider request is assembled.

When `enableImageGeneration: true`, the plugin registers `codex_image_generate` and `codex_image_edit`. Both use the same provider-native OAuth runtime as the model adapter. Requests target fixed HTTPS Codex application endpoints, reject redirects, propagate cancellation, enforce a ten-minute timeout and byte limits, and never retry ambiguous failures. Outputs are written under the session cwd, persisted to Harness attachments before the tool result lands, and replayed through the owning session's authorized attachment API.

## Conflicts and diagnostics

Before registration the plugin checks current provider ids. An existing `openai-codex` adapter produces a focused message naming the likely legacy-bundle or manual-provider cause. The boot-free CLI `doctor` reports package/runtime version, OAuth path metadata, capability defaults, and safe conflict guidance without returning auth content.

## Compatibility boundary

The Beta pins Harness `0.1.1-rc.2` development dependencies and uses its current pi-ai auth and image-request APIs; supported Node.js is `^22.19.0 || >=24.0.0`. It pins `@earendil-works/pi-ai` `0.82.1`. Backend eligibility, quotas, models, and protocol details remain controlled upstream. Tests use temporary OAuth documents and mocked network responses; CI does not perform real authentication.
