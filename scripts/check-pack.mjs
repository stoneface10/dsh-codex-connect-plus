import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { gunzipSync } from 'node:zlib'

function packedPaths(tgz) {
  const tar = gunzipSync(tgz)
  const paths = []
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
    if (path.startsWith('package/')) paths.push(path.slice('package/'.length))
    offset += 512 + Math.ceil(size / 512) * 512
  }
  return paths
}

const destination = await mkdtemp(join(tmpdir(), 'dsh-codex-connect-plus-pack-'))
try {
  const npmCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  const result = spawnSync(process.execPath, [npmCli, 'pack', '--ignore-scripts', '--pack-destination', destination], {
    cwd: new URL('..', import.meta.url),
    stdio: 'inherit',
  })
  if (result.error !== undefined) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
  const archives = (await readdir(destination)).filter(name => name.endsWith('.tgz'))
  if (archives.length !== 1) throw new Error(`expected one packed archive, found ${archives.length}`)
  const names = packedPaths(await readFile(join(destination, archives[0])))
  const required = [
    'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md', 'README.md', 'package.json',
    'cordis.patch.yml', 'lib/index.js', 'lib/client.js', 'lib/bin.js',
  ]
  for (const name of required) {
    if (!names.includes(name)) throw new Error(`packed artifact is missing ${name}`)
  }
  const forbidden = names.filter(name => /(^|\/)(?:\.env(?:\.|$)|\.git|node_modules|tests?|scripts?|src)(?:\/|$)|auth\.json$|credential|token/iu.test(name))
  if (forbidden.length > 0) throw new Error(`packed artifact contains forbidden files: ${forbidden.join(', ')}`)
  process.stdout.write(`validated ${names.length} packed files\n`)
} finally {
  await rm(destination, { recursive: true, force: true })
}
