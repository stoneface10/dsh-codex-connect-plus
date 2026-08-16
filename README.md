# Codex Connect Plus

English | [中文](docs/README.zh.md)

Connect a user-authorized ChatGPT subscription to DeepSeek Harness for Codex models, optional search and vision, and `gpt-image-2` generation/editing without an OpenAI Platform API key.

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

From npm after a release:

```sh
dsh plugin --profile web add dsh-codex-connect-plus@alpha
```

From a GitHub tag containing committed `lib/` artifacts:

```sh
dsh plugin --profile web add 'github:stoneface10/dsh-codex-connect-plus#v0.1.0-alpha.1'
```

From a downloaded GitHub Release package:

```sh
dsh plugin --profile web add /path/to/dsh-codex-connect-plus-0.1.0-alpha.1.tgz
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

Default capability settings:

```yaml
enableSearch: false
enableImageTool: false
enableImageGeneration: true
```

The package does not take over the profile's default model or global search route.

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

- OAuth credentials remain in the existing owner-only DSH credential store.
- Refresh is performed by the pi-ai Codex provider under the store's lock; the image module never implements a token refresh endpoint.
- Image requests use fixed HTTPS Codex application endpoints and `redirect: error`.
- Tokens, JWTs, base64 image data, and authorization headers are redacted from surfaced provider errors.
- Generated attachment reads are scoped through the owning DSH session.

The Codex Images application backend is not presented as a public or supported OpenAI Platform API. It may change, and availability depends on the user's account, subscription, region, limits, and upstream behavior.

## Development

```sh
pnpm install
pnpm run check
npm pack --dry-run
```

The repository intentionally commits both `src/` and generated `lib/`, matching the upstream distribution model. The npm/Release `.tgz` includes runtime files and documentation, but excludes source, tests, scripts, credentials, logs, and local outputs.

See [RELEASING.md](RELEASING.md) for the Alpha checklist.

## Legal / provenance

`dsh-codex-connect-plus` is a derivative of [dsh-codex-connect](https://github.com/franksong2702/dsh-codex-connect), which in turn includes software derived from [Yan-Zero/dsh-codex](https://github.com/Yan-Zero/dsh-codex).

Image-generation and in-conversation image UI portions include adaptations from [dsh-image2-draw](https://github.com/JuneLearn/dsh-image2-draw) and [codex-gpt-image](https://github.com/ningzimu/codex-gpt-image). Applicable transitive attribution for [dsh-multimodal](https://github.com/MC5lan/dsh-multimodal) is also retained.

See [NOTICE](NOTICE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

OpenAI, ChatGPT, Codex, DeepSeek, and DeepSeek Harness are names or trademarks of their respective owners. This independent project is not affiliated with, endorsed by, or sponsored by those owners.

This project uses an existing user-authorized ChatGPT/Codex OAuth session. It does not claim that the Codex Images backend is a public, official, or supported API.

## License

Apache-2.0. See [LICENSE](LICENSE). Adapted third-party portions remain subject to [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
