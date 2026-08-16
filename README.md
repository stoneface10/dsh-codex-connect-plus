# Codex Connect Plus

[![Release](https://img.shields.io/github/v/release/stoneface10/dsh-codex-connect-plus?include_prereleases&label=release)](https://github.com/stoneface10/dsh-codex-connect-plus/releases)
[![License](https://img.shields.io/github/license/stoneface10/dsh-codex-connect-plus)](LICENSE)

English | [中文](docs/README.zh.md)

<p align="center">
  <img src="docs/assets/hero.jpg" alt="Codex Connect Plus — ChatGPT subscription to Codex models and gpt-image-2 without an OpenAI Platform API key" width="100%">
</p>

> **Use your ChatGPT/Codex subscription inside DeepSeek Harness for Codex models and `gpt-image-2` generation/editing—without an OpenAI Platform API key.**

Sign in once with ChatGPT OAuth. Codex model requests use the signed-in account's subscription capacity; image generation/editing uses the same OAuth session and remains subject to account availability, region, limits, and upstream policy.

### What you get

- **Codex models in the normal DSH model picker** — no separate CLI workflow.
- **`gpt-image-2` generation and editing** — create images from prompts or edit 1–8 local references, with inline previews and local output files.
- **No OpenAI Platform API key or pay-as-you-go API billing setup** — authorization comes from your user-approved ChatGPT/Codex OAuth session.
- **Quota-conscious defaults** — automatic model retries default to `0`, and image requests are never silently retried.

<p align="center">
  <img src="docs/assets/demo-codex-image-and-models.png" alt="Real DeepSeek Harness UI showing Codex model selection and gpt-image-2 image generation" width="920">
</p>
<p align="center"><sub>Real DSH UI: select a Codex model and generate an attached image with <code>gpt-image-2</code> in the same conversation.</sub></p>

> Community derivative. Not affiliated with or endorsed by OpenAI, DeepSeek, or the upstream Codex Connect maintainers.

## Features

- ChatGPT/Codex OAuth login and provider-native automatic refresh.
- OpenAI Codex model catalog through Harness's normal LLM service.
- Optional standalone Codex search provider.
- Optional `view_image` tool for vision-capable models.
- `codex_image_generate` for 1-4 `gpt-image-2` outputs.
- `codex_image_edit` for 1-8 local PNG/JPEG/WebP references and an optional mask.
- Durable DSH attachments, session-authorized replay, inline preview, and local files under `outputs/codex-image`.
- Fixed upstream origins, no redirects, bounded inputs/responses, cancellation, timeout, strict image signatures, and redacted provider errors.

## Install

The package is not yet published to npm. Install the immutable GitHub tag containing committed `lib/` artifacts:

```sh
dsh plugin --profile web add 'github:stoneface10/dsh-codex-connect-plus#v0.1.0-alpha.3'
```

From a downloaded GitHub Release package:

```sh
dsh plugin --profile web add /path/to/dsh-codex-connect-plus-0.1.0-alpha.3.tgz
```

For local development:

```sh
dsh plugin --profile web add link:/absolute/path/to/dsh-codex-connect-plus
```

Do not install `dsh-codex-connect`, `dsh-codex-image-connect`, and this combined package in the same profile: they own the same provider and tool names.

## Configure

Open **Settings → Plugins → Plugin configuration → Codex Connect Plus**.

1. Sign in with ChatGPT.
2. Keep or change optional capability toggles.
3. Save profile settings.

Default capability and quota-safety settings:

```yaml
modelMaxRetries: 0
enableSearch: false
enableImageTool: false
enableImageGeneration: true
```

The package does not take over the profile's default model or global search route. `modelMaxRetries: 0` avoids silently repeating a full subscription-backed request after a transient failure; users may deliberately select one or two retries in Plugin configuration when reliability matters more than quota conservation. Image generation/editing remains non-retrying because the provider may already have processed a timed-out request.

## Image tools

Example requests:

```text
Use codex_image_generate to create a high-quality portrait travel poster.
```

```text
Use codex_image_edit with refs ["photo.png"] to replace the background.
```

Generated files resolve from the current DSH session cwd and are stored under:

```text
outputs/codex-image/
```

Reference images are limited to 4 MB each and 8 images per edit request. Generation can take several minutes. A timeout or transport failure is not retried automatically because the upstream may already have processed the request.

## Security and API status

- OAuth credentials remain in DSH's dedicated credential file. On POSIX systems the plugin checks owner-only permissions; do not copy, commit, or disclose this file.
- Refresh is performed by the pi-ai Codex provider through the locked credential store; the image module neither stores nor refreshes refresh tokens itself.
- Image requests use fixed HTTPS ChatGPT/Codex application endpoints and reject HTTP redirects.
- Before provider-controlled errors are surfaced, their length is bounded and recognized Bearer tokens, JWTs, authorization/token fields, `b64_json`, and image data URLs are redacted.
- Generated attachment reads are authorized through the owning DSH session; the plugin exposes no public attachment-reading route.

Codex Images uses an unpublished, changeable ChatGPT/Codex application backend, not a public or supported OpenAI Platform API. The feature may stop working after upstream changes; availability depends on the user's account permissions, subscription, region, limits, and upstream policy. Users are responsible for complying with applicable service terms.

## Development

```sh
pnpm install
pnpm run check
npm pack --dry-run
```

The repository intentionally commits both `src/` and generated `lib/`, matching the upstream distribution model. The npm/Release `.tgz` includes runtime files and documentation, but excludes source, tests, scripts, credentials, logs, and local outputs.

See the [Token/quota optimization report (中文)](docs/USAGE-QUOTA-OPTIMIZATION.zh.md) for retry, cache, compaction, and subagent guidance. See [RELEASING.md](RELEASING.md) for the Alpha checklist.

## Legal / provenance

`dsh-codex-connect-plus` is a derivative of [dsh-codex-connect](https://github.com/franksong2702/dsh-codex-connect), which in turn includes software derived from [Yan-Zero/dsh-codex](https://github.com/Yan-Zero/dsh-codex).

Image-generation and in-conversation image UI portions include adaptations from [dsh-image2-draw](https://github.com/JuneLearn/dsh-image2-draw) and [codex-gpt-image](https://github.com/ningzimu/codex-gpt-image). Applicable transitive attribution for [dsh-multimodal](https://github.com/MC5lan/dsh-multimodal) is also retained.

See [NOTICE](NOTICE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

OpenAI, ChatGPT, Codex, DeepSeek, and DeepSeek Harness are names or trademarks of their respective owners. This independent project is not affiliated with, endorsed by, or sponsored by those owners.

This project uses an existing user-authorized ChatGPT/Codex OAuth session. It does not claim that the Codex Images backend is a public, official, or supported API.

## License

Apache-2.0. See [LICENSE](LICENSE). Adapted third-party portions remain subject to [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
