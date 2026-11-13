// The two languages must cover the same strings, and the default follows the browser.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LANGS, STRINGS, defaultLang } from '../web/i18n.js?v=dev'

/** The shape of a string table: nested keys, and each function's arity. */
const shape = o => Object.fromEntries(Object.entries(o).map(([k, v]) =>
  [k, typeof v === 'object' ? shape(v) : typeof v === 'function' ? `fn/${v.length}` : typeof v]))

test('English first, then Simplified Chinese', () => {
  assert.deepEqual(LANGS, ['en', 'zh'])
  for (const l of LANGS) assert.ok(STRINGS[l], l)
})

test('every language has exactly the English strings, none empty', () => {
  for (const l of LANGS) {
    assert.deepEqual(shape(STRINGS[l]), shape(STRINGS.en), `${l} matches en`)
    const walk = o => Object.values(o).forEach(v => typeof v === 'object' ? walk(v) : typeof v === 'string' && assert.ok(v.trim(), `${l}: empty string`))
    walk(STRINGS[l])
  }
})

test('the Chinese strings are in Chinese', () => {
  for (const k of ['settings', 'sound', 'theme', 'language', 'done', 'paused', 'grounded']) {
    assert.match(STRINGS.zh[k], /[一-鿿]/, k)
  }
  assert.equal(STRINGS.zh.langName, '简体中文')
  assert.equal(STRINGS.en.langName, 'English')
})

test('the default language follows the browser: Chinese for zh-*, else English', () => {
  assert.equal(defaultLang(['zh-CN', 'en']), 'zh')
  assert.equal(defaultLang(['zh']), 'zh')
  assert.equal(defaultLang(['fi-FI', 'zh-CN']), 'zh') // first supported one wins
  assert.equal(defaultLang(['en-GB', 'zh-CN']), 'en')
  assert.equal(defaultLang(['fi-FI']), 'en')
  assert.equal(defaultLang([]), 'en')
  assert.equal(defaultLang(undefined), 'en')
})
