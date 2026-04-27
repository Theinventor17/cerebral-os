/**
 * node-pty's binding.gyp requests Spectre-mitigated CRT/libs (MSB8040) which many
 * Windows dev machines lack. Building with Spectre mitigation disabled is acceptable
 * for this local dev dependency; to use official Spectre libs instead, remove this
 * script from postinstall and install the VS "Spectre-mitigated libraries" component.
 */
const fs = require('node:fs')
const path = require('node:path')

const gyp = path.join(__dirname, '..', 'node_modules', 'node-pty', 'binding.gyp')
if (!fs.existsSync(gyp)) {
  process.exit(0)
}
let s = fs.readFileSync(gyp, 'utf8')
if (!s.includes("'SpectreMitigation': 'Spectre'")) {
  process.exit(0)
}
s = s.replace(/'SpectreMitigation': 'Spectre'/, "'SpectreMitigation': 'false'")
fs.writeFileSync(gyp, s)
console.log('[postinstall] node-pty: set SpectreMitigation to false in binding.gyp')
