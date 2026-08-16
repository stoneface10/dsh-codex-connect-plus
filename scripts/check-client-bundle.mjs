import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'

const bundle = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
const required = [...bundle.matchAll(/require\("([^"]+)"\)/gu)].map(match => match[1])
const allowed = new Set(['react', 'react/jsx-runtime'])
const forbidden = required.filter(id => !allowed.has(id))

if (!/window\.__ModuleLoader__\.load\(\s*\{\s*id:\s*"dsh-codex-connect-plus"/u.test(bundle)) {
  throw new Error('client bundle does not register the expected DSH module id')
}
if (forbidden.length > 0) {
  throw new Error(`client bundle requires modules outside its verified table: ${[...new Set(forbidden)].join(', ')}`)
}
if (/@deepseek-ai\/dsh-(?:attachment|tools)(?:["'/])/u.test(bundle) || /node:(?:fs|path|http)/u.test(bundle)) {
  throw new Error('client bundle contains a Host-only runtime import')
}
let registration
runInNewContext(bundle, {
  window: { __ModuleLoader__: { load(value) { registration = value } } },
})
if (registration?.id !== 'dsh-codex-connect-plus' || typeof registration.factory !== 'function') {
  throw new Error('client bundle did not register a usable module factory')
}
const observed = []
const exports = registration.factory((id) => {
  observed.push(id)
  if (!allowed.has(id)) throw new Error(`simulated DSH module table rejected ${id}`)
  return {}
})
if (typeof exports?.apply !== 'function') throw new Error('client bundle factory did not export apply()')
if (JSON.stringify(observed) !== JSON.stringify(required)) throw new Error('static and runtime client require inventories differ')
process.stdout.write(`validated client bundle requires: ${required.join(', ')}\n`)
