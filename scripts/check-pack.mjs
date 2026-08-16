import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, posix } from 'node:path'
import { spawnSync } from 'node:child_process'
import { gunzipSync } from 'node:zlib'

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

function packedEntries(tgz) {
  const tar = gunzipSync(tgz)
  const entries = new Map()
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every(byte => byte === 0)) break
    const readField = (start, length) => header.subarray(start, start + length).toString('utf8').replace(/\0.*$/u, '')
    const name = readField(0, 100)
    const prefix = readField(345, 155)
    const sizeText = readField(124, 12).trim()
    const size = sizeText === '' ? 0 : Number.parseInt(sizeText, 8)
    if (!Number.isSafeInteger(size) || size < 0) throw new Error(`invalid tar size for ${name}`)
    const path = prefix === '' ? name : `${prefix}/${name}`
    if (path.startsWith('package/')) {
      entries.set(path.slice('package/'.length), tar.subarray(offset + 512, offset + 512 + size))
    }
    offset += 512 + Math.ceil(size / 512) * 512
  }
  return entries
}

const destination = await mkdtemp(join(tmpdir(), 'dsh-codex-connect-plus-pack-'))
try {
  const packArgs = ['pack', '--ignore-scripts', '--pack-destination', destination]
  const command = process.platform === 'win32' ? process.execPath : 'npm'
  const args = process.platform === 'win32'
    ? [join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'), ...packArgs]
    : packArgs
  const result = spawnSync(command, args, {
    cwd: new URL('..', import.meta.url),
    stdio: 'inherit',
  })
  if (result.error !== undefined) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
  const archives = (await readdir(destination)).filter(name => name.endsWith('.tgz'))
  if (archives.length !== 1) throw new Error(`expected one packed archive, found ${archives.length}`)
  const entries = packedEntries(await readFile(join(destination, archives[0])))
  const names = [...entries.keys()]
  const required = [
    'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md', 'README.md', 'docs/README.zh.md',
    'INSTALL.md', 'CHANGELOG.md', 'package.json', 'cordis.patch.yml',
    'lib/index.js', 'lib/client.js', 'lib/bin.js',
  ]
  for (const name of required) {
    if (!names.includes(name)) throw new Error(`packed artifact is missing ${name}`)
  }
  const forbidden = names.filter(name => /(^|\/)(?:\.env(?:\.|$)|\.git|node_modules|tests?|scripts?|src)(?:\/|$)|auth\.json$|credential|token/iu.test(name))
  if (forbidden.length > 0) throw new Error(`packed artifact contains forbidden files: ${forbidden.join(', ')}`)

  const manifest = JSON.parse(Buffer.from(entries.get('package.json')).toString('utf8'))
  if (manifest.version !== packageJson.version) throw new Error('packed manifest version differs from the source manifest')
  for (const doc of ['README.md', 'docs/README.zh.md', 'INSTALL.md', 'CHANGELOG.md']) {
    if (!Buffer.from(entries.get(doc)).toString('utf8').includes(packageJson.version)) {
      throw new Error(`packed ${doc} does not mention version ${packageJson.version}`)
    }
  }
  for (const [name, bytes] of entries) {
    if (!name.startsWith('lib/') || !name.endsWith('.js')) continue
    const source = Buffer.from(bytes).toString('utf8')
    const imports = [
      ...source.matchAll(/(?:from\s*|import\s*)["'](\.[^"']+)["']/gu),
    ].map(match => match[1])
    for (const specifier of imports) {
      const target = posix.normalize(posix.join(posix.dirname(name), specifier))
      if (!entries.has(target)) throw new Error(`${name} imports missing packed file ${target}`)
    }
  }
  process.stdout.write(`validated ${names.length} packed files\n`)
} finally {
  await rm(destination, { recursive: true, force: true })
}
