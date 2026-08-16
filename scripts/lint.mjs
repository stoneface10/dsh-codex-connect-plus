import { readFile, stat } from 'node:fs/promises'

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const failures = []

if (packageJson.name !== 'dsh-codex-connect-plus') failures.push('package name must be dsh-codex-connect-plus')
if (!/^0\.1\.0-alpha\.[1-9]\d*(?:\.\d+)?$/u.test(packageJson.version)) failures.push('package version must be a 0.1.0 alpha release')
if (packageJson.publishConfig?.tag !== 'alpha') failures.push('publishConfig.tag must be alpha')
if (packageJson.displayName !== 'Codex Connect Plus') failures.push('displayName mismatch')
if (packageJson.author !== '0751') failures.push('package author must identify the derivative owner')
for (const contributor of [
  'Frank Song (dsh-codex-connect author)',
  'Yan-Zero (original dsh-codex author)',
  'JuneLearn (dsh-image2-draw portions)',
  'ningzimu (codex-gpt-image portions)',
  'MC5lan/dsh-multimodal contributors (attachment and tool-card portions)',
]) {
  if (!Array.isArray(packageJson.contributors) || !packageJson.contributors.includes(contributor)) failures.push(`missing contributor: ${contributor}`)
}
for (const keyword of ['dsh-plugin', 'deepseek-harness', 'openai-codex', 'chatgpt-oauth', 'gpt-image-2']) {
  if (!Array.isArray(packageJson.keywords) || !packageJson.keywords.includes(keyword)) failures.push(`package keywords must include ${keyword}`)
}

const productFiles = [
  'package.json', 'README.md', 'docs/README.zh.md', 'INSTALL.md', 'MIGRATION.md',
  'RELEASING.md', 'SECURITY.md', 'CHANGELOG.md', 'NOTICE', 'THIRD_PARTY_NOTICES.md',
  'LICENSE', 'docs/design.md', 'docs/design.zh.md',
]
for (const filename of productFiles) {
  const text = await readFile(new URL(`../${filename}`, import.meta.url), 'utf8')
  if (/BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|\bsk-[A-Za-z0-9_-]{16,}|refresh_token\s*[=:]\s*[^\s"']+/u.test(text)) {
    failures.push(`${filename} appears to contain secret material`)
  }
}

const modifiedSourceFiles = [
  'src/adapter.ts', 'src/auth-routes.ts', 'src/auth.ts', 'src/bin.ts',
  'src/client/OpenAICodexConfiguration.tsx', 'src/client/index.tsx', 'src/client/locales.ts',
  'src/doctor.ts', 'src/index.ts', 'src/invariant.ts', 'src/search-event.ts', 'src/search.ts',
  'src/settings-contract.ts', 'src/store.ts', 'src/usage.ts', 'src/view-image.ts',
]
for (const filename of modifiedSourceFiles) {
  const text = await readFile(new URL(`../${filename}`, import.meta.url), 'utf8')
  if (!text.includes('Modified from dsh-codex-connect by 0751')) failures.push(`${filename} needs a prominent derivative modification notice`)
}
for (const filename of ['src/images/protocol.ts', 'src/images/tools.ts', 'src/client/CodexImageToolView.tsx']) {
  const text = await readFile(new URL(`../${filename}`, import.meta.url), 'utf8')
  if (!text.includes('Adapted for dsh-codex-connect-plus')) failures.push(`${filename} needs an image-code provenance notice`)
}

const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8')
if (!readme.startsWith('# Codex Connect Plus\n')) failures.push('README opening mismatch')
if (!readme.includes('English | [中文](docs/README.zh.md)')) failures.push('README must link the Chinese guide')
if (!readme.includes('<img src="docs/assets/hero.jpg"')) failures.push('README must display the product hero')
if (!readme.includes('<img src="docs/assets/demo-codex-image-and-models.png"')) failures.push('README must display the real Codex and image-generation demo')
if (!readme.includes(`github:stoneface10/dsh-codex-connect-plus#v${packageJson.version}`)) failures.push('README must pin the current GitHub release tag')
if (!readme.includes('not yet published to npm')) failures.push('README must not advertise an unpublished npm package')
const chinese = await readFile(new URL('../docs/README.zh.md', import.meta.url), 'utf8')
if (!chinese.includes(`github:stoneface10/dsh-codex-connect-plus#v${packageJson.version}`)) failures.push('Chinese README must pin the current GitHub release tag')
if (!chinese.includes('尚未发布到 npm')) failures.push('Chinese README must not advertise an unpublished npm package')
try {
  await stat(new URL('../README.zh.md', import.meta.url))
  failures.push('root README.zh.md must live under docs/README.zh.md')
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}

const notice = await readFile(new URL('../NOTICE', import.meta.url), 'utf8')
const license = await readFile(new URL('../LICENSE', import.meta.url), 'utf8')
for (const owner of ['Copyright 2026 Frank Song', 'Copyright 2026 Yan-Zero', 'Copyright 2026 0751']) {
  if (!notice.includes(owner)) failures.push(`NOTICE must retain ${owner}`)
}
if (!license.includes('Copyright [yyyy] [name of copyright owner]')) failures.push('LICENSE must retain the canonical Apache-2.0 appendix boilerplate')
if (license.includes('Copyright 2026')) failures.push('project-specific copyright notices belong in NOTICE, not the Apache appendix example')
for (const required of ['dsh-image2-draw', 'codex-gpt-image', 'dsh-multimodal']) {
  if (!notice.includes(required)) failures.push(`NOTICE must identify ${required}`)
}

const patch = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
if (!patch.includes('name: dsh-codex-connect-plus')) failures.push('bundle patch must load the derivative package')
if (/^- id: agent-default-model/mu.test(patch) || /searchProvider:\s*openai-codex/u.test(patch)) failures.push('bundle patch must not take over Harness routing')

if (failures.length > 0) {
  for (const failure of failures) process.stderr.write(`lint: ${failure}\n`)
  process.exitCode = 1
}
