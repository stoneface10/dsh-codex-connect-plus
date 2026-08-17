# Releasing a Prerelease

Use this checklist for a new `0.1.0-alpha.*` or `0.1.0-beta.*` package release. Released versions are immutable: do not republish, overwrite, or unpublish a version to correct documentation. Publish a new version instead.

1. Start with a clean tree and run `pnpm run check`.
2. Update the version, both README files, `NOTICE`, `THIRD_PARTY_NOTICES.md`, and this release guidance as needed; rebuild so `lib/` carries the version.
3. Inspect `npm pack --dry-run` and require the root `README.md`, the Chinese document under `docs/`, and no localized README beside the root README.
4. Confirm npm 2FA is enabled, then publish with the matching `alpha` or `beta` dist-tag (`publishConfig.tag` prevents a prerelease publish from implicitly changing `latest`).
5. Verify the expected version, tags, and `readmeFilename` with `npm view dsh-codex-connect-plus@beta version dist-tags readmeFilename --json` (replace `beta` when publishing an Alpha), then perform an isolated DSH profile installation using `dsh-codex-connect-plus@<version>`.
6. While no stable release exists, explicitly move `latest` to the verified newest prerelease so the npm package page and default README do not lag: `npm dist-tag add dsh-codex-connect-plus@<version> latest`. After the first stable release, `latest` must point only to stable releases.
7. Create the matching GitHub prerelease and share its notes in the project Discussion and Discord. The GitHub tag remains an npm-unavailable installation fallback.
