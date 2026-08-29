import { readFileSync } from 'node:fs'
import type { UserConfig } from 'tsdown'

const PLUGIN_ID = 'dsh-codex-connect-plus'
const PACKAGE_VERSION = (JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }).version
// Must stay aligned with DSH's browser module table. Any other @deepseek-ai
// runtime value import is a Host/client boundary violation and fails the build.
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
] as const

export default [
  {
    entry: {
      index: 'src/index.ts',
      invariant: 'src/invariant.ts',
      bin: 'src/bin.ts',
    },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: true,
    clean: true,
    define: {
      __CODEX_CONNECT_VERSION__: JSON.stringify(PACKAGE_VERSION),
    },
    outputOptions: {
      banner: '/* dsh-codex-connect-plus: modified derivative; Copyright 2026 0751; Apache-2.0, see NOTICE and THIRD_PARTY_NOTICES.md. */',
    },
    deps: {
      neverBundle: [
        '@earendil-works/pi-ai',
        '@deepseek-ai/schemastery',
        '@deepseek-ai/cordis',
        '@deepseek-ai/dsh-agent',
        '@deepseek-ai/dsh-attachment',
        '@deepseek-ai/dsh-fs',
        '@deepseek-ai/dsh-host-webserver',
        '@deepseek-ai/dsh-invariants',
        '@deepseek-ai/dsh-llm',
        '@deepseek-ai/dsh-llm-pi-ai',
        '@deepseek-ai/dsh-session',
        '@deepseek-ai/dsh-settings',
        '@deepseek-ai/dsh-tools',
        '@deepseek-ai/dsh-web',
      ],
    },
  },
  {
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    clean: false,
    deps: {
      neverBundle: [...CLIENT_EXTERNALS],
      // Dependencies outside the frozen browser module table must be bundled.
      alwaysBundle: (id: string) => !CLIENT_EXTERNALS.includes(id as typeof CLIENT_EXTERNALS[number]),
    },
    plugins: [{
      name: 'dsh-client-bundle-purity',
      resolveId(source: string) {
        if (!source.startsWith('@deepseek-ai/')) return null
        if (CLIENT_EXTERNALS.includes(source as typeof CLIENT_EXTERNALS[number])) return null
        throw new Error(
          `client bundle purity: "${source}" is not in the DSH browser module table; `
          + 'runtime cross-plugin and Host-only imports are forbidden (type-only imports are allowed)',
        )
      },
    }],
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      __CODEX_CONNECT_VERSION__: JSON.stringify(PACKAGE_VERSION),
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `/* dsh-codex-connect-plus: modified derivative; Copyright 2026 0751; Apache-2.0, see NOTICE and THIRD_PARTY_NOTICES.md. */\nwindow.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
] satisfies UserConfig[]
