// Builds both halves:
// - lib/client.js in the DSH Web Client module format:
//     window.__ModuleLoader__.load({ id: <package name>, factory: require => module.exports })
//   React comes from the host's shared module table (never bundled).
// - lib/index.js, the Node host half, as one self-contained ESM file. Never
//   minified: the API Gateway reads Remote parameter names from method source.
import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(readFileSync(`${root}/package.json`, 'utf8'))

const result = await build({
  entryPoints: [`${root}/src/client.jsx`],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', 'react-dom'],
  minify: process.argv.includes('--minify'),
  write: false,
  legalComments: 'none',
})

const body = result.outputFiles[0].text
const out = `/**
 * ${pkg.name} v${pkg.version} — ${pkg.description}
 */
window.__ModuleLoader__.load({id:${JSON.stringify(pkg.name)},factory:require=>{var module={exports:{}},exports=module.exports;
${body}
return module.exports}});
`
writeFileSync(`${root}/lib/client.js`, out)
console.log(`lib/client.js written (${(out.length / 1024).toFixed(1)} KiB)`)

const host = await build({
  entryPoints: [`${root}/src/host/index.js`],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  minify: false,
  write: false,
  legalComments: 'none',
  banner: { js: `// ${pkg.name} v${pkg.version} host half: generated from src/host by scripts/build.mjs, do not edit.` },
})
writeFileSync(`${root}/lib/index.js`, host.outputFiles[0].text)
console.log(`lib/index.js written (${(host.outputFiles[0].text.length / 1024).toFixed(1)} KiB)`)
