# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this is

`dsh-updraft`: a DeepSeek Harness widget with **Updraft**, a one-button arcade game played in a main panel opened from the sidebar. You steer a paper plane through gaps between stone pillars: Space / ↑ / W / click flaps, gravity pulls down, P / Esc pauses (it also auto-pauses when the window loses focus). It has original art and an original name. Keep it that way, and don't copy the look, name or assets of any existing game.

The best score and play count are saved by the host half in `$DSH_HOME/storages/updraft.json`, with `localStorage` as a fallback in the browser.

## Layout

| File | Role |
|---|---|
| `src/game.js` | Pure game model (physics, pillars, scoring, collisions) on a fixed 400×600 logical field. No DOM, so it is unit-tested. Tuning lives in `CFG`. |
| `src/client.jsx` | Browser half: sidebar entry, panel, canvas renderer, rAF loop, input, scaling to the panel. |
| `src/remote.js` | Client → host RPC (`updraft/state`, `updraft/finish`). |
| `src/host/index.js` | Host half: `updraft` Remote service that stores the best score. |
| `scripts/build.mjs` | esbuild → `lib/client.js`, `lib/index.js` (generated; commit them). |
| `test/*.test.js` | `node --test` for the game model and host service. |

## Commands

```sh
npm install
npm test
npm run build   # regenerates lib/client.js and lib/index.js; commit them
```


<!-- dsh-widget-knowhow:start (managed by the dsh-widget-init skill; re-running it replaces this block) -->
## DSH widget know-how

Learned while building `dsh-spending-insights` (github.com/counterall/dsh-bank-statement-analysis) against the DeepSeek Harness desktop app v0.2.1-rc.2. These are mostly undocumented internals of the app. When something stops working after a DSH update, check it against the installed app (`/Applications/DeepSeek Harness.app/Contents/Resources/runtime/`) before assuming the plugin is wrong. That repo is the working reference implementation for everything below.

### Anatomy of a plugin package

A plugin has two halves, which load from one npm package:

| File | Role |
|---|---|
| `lib/index.js` | **Host half** (Node, runs inside the DSH runtime). `export const name` + `export function apply(ctx)`. Loaded through the row that `cordis.patch.yml` inserts. |
| `lib/client.js` | **Browser half** (Web Client). Loaded because `package.json` → `dsh.client` declares it. |
| `cordis.patch.yml` | Bundle patch: `- insert: [ { id: <pkg-name>, name: <pkg-name> } ]` |
| `src/…` | Sources; `scripts/build.mjs` (esbuild) writes both `lib/` files. |

`package.json` essentials:

```json
{
  "type": "module",
  "main": "lib/index.js",
  "exports": { ".": "./lib/index.js", "./client": "./lib/client.js", "./package.json": "./package.json" },
  "files": ["lib/index.js", "lib/client.js", "cordis.patch.yml"],
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "platform": "web",
      "inject": [
        "@deepseek-ai/dsh-client-connection",
        "@deepseek-ai/dsh-client-ui-layout",
        "@deepseek-ai/dsh-client-ui-sidebar",
        "@deepseek-ai/dsh-client-ui-workspace",
        "@deepseek-ai/dsh-api-workspace-controller"
      ]
    }
  },
  "engines": { "dsh": ">=0.2.1-rc.2" },
  "devDependencies": { "esbuild": "…" }
}
```

`dsh.client.inject` lists the client packages whose services the browser half uses. The list above covers `connection`, `layout`, the sidebar slots, `uiWorkspace` and `workspaces`, so trim it to what the widget needs.

Rules:

- **Commit the generated `lib/client.js` and `lib/index.js`.** Installing from GitHub runs no build step. After any change under `src/`, run `npm run build` and commit the `lib/` output too.
- **Never import `@deepseek-ai/*` packages.** The plugin is installed outside the app's module tree, so they won't resolve. Re-create any metadata you need by hand (see the Remote service section below).
- **React comes from the host.** Keep `react`, `react/jsx-runtime` and `react-dom` external in the client build. Avoid runtime dependencies; `esbuild` should be the only devDependency.

### Build (`scripts/build.mjs`)

- **Client:** build `src/client.jsx` with esbuild using `format: 'cjs'`, `platform: 'browser'`, `jsx: 'automatic'`, with React external. Then wrap the output in the Web Client module format:
  ```js
  window.__ModuleLoader__.load({id:"<pkg-name>",factory:require=>{var module={exports:{}},exports=module.exports;
  /* esbuild output */
  return module.exports}});
  ```
- **Host:** build `src/host/index.js` with `format: 'esm'`, `platform: 'node'`, `target: 'node20'`, bundled. Add a "generated, do not edit" banner.
- **Never minify the host bundle.** The API Gateway reads Remote method parameter names from the function source (see below).

### Browser half: `apply(ctx)` in `src/client.jsx`

- **Sidebar row and main panel:**
  ```js
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID }, Page))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist', id: PANEL_ID, order: 20, label: () => '名称',
  }, Icon))   // Icon: 20×20 SVG drawn in currentColor
  ```
- **Styles:** inject a `<style>` element inside `ctx.effect(() => { …; return () => el.remove() }, 'label')`.
  - Prefix every class with a short widget prefix.
  - Use the theme tokens with fallbacks, for example:
    - `--dsw-alias-bg-base`, `--dsw-alias-bg-layer-1`;
    - `--dsw-alias-label-primary`, `--dsw-alias-label-secondary`, `--dsw-alias-label-tertiary`;
    - `--dsw-alias-border-l1`, `--dsw-alias-border-l2`;
    - `--dsw-alias-interactive-bg-hover`, `--dsw-alias-interactive-bg-active`;
    - `--dsw-alias-brand-primary`. This one is near-black, not a colour, so define your own accent if you want colour.
  - Dark mode is `body[data-ds-dark-theme] .root { color-scheme: dark; … }`.
  - Give the page root `height: 100%; overflow: auto`.
  - Pad the page header by `var(--dsh-frame-leading-clearance, 0px)` so it clears the window controls when the sidebar is collapsed.
- **Optional services:** `ctx.inject(['connection'], c => { c.effect(() => { use(c.connection); return () => cleanup() }, 'label') })`.
  - Services come and go. Keep module-level references, set them inside the effect and clear them in the cleanup.
  - Expose them to React with `useSyncExternalStore`.
- **Calling your host half:** use `c.connection.rpc.call('/api', '<namespace>/<method>', { args: { …named } }, signal)`.
  - It resolves `{ ok: true, value }` or `{ ok: false, error }`.
  - An `invocation-unavailable` or not-found error means the host half isn't loaded. Tell the user to restart DSH.
- **Opening a chat from the widget:**
  ```js
  ctx.layout.selectPanel(null)   // FIRST: back to the Conversation; selecting a panel aborts pending navigation
  ctx.uiWorkspace.startSession(workspaceId, { prompt, clearPreviousDraft: true })  // new/blank session, composer prefilled
  ```
  - This only fills in the composer. There is no public way to send it, so the user presses Enter.
  - Use single `\n` in the prompt, because blank lines show as extra space.
- **Workspaces:** `ctx.workspaces.list` is a snapshot store with `getSnapshot()` and `subscribe(fn)`.
  - Each item has `{ workspaceId, path, title, sessionIds }`.
  - Show the title `'default-workspace'` as `ctx.locale.bind('workspace')('workspace.defaultName')`.
- **Viewer restrictions:** dialogs are not reliable, and there is no native folder picker in the browser. Do folder picking on the host (see below).

### Host half: `apply(ctx)` in `src/host/index.js`

**Remote service (widget → host RPC) without typert codegen.** The API Gateway's source (SRC) dispatch claims endpoints for any Cordis service that has:

1. an own property `typertRemote = Object.freeze({ service: this, serviceKey: NS, namespace: NS })`;
2. on its prototype, the `@Remote` marker:

```js
const REMOTE_METHODS = '@deepseek-ai/dsh-typert-protocol/remote-methods'
Object.defineProperty(MyService.prototype, REMOTE_METHODS, {
  configurable: true,
  value: Object.freeze({ version: 1, methods: Object.freeze(['state', 'save']
    .map(method => Object.freeze({ method, invocation: Object.freeze({ kind: 'direct' }) }))) }),
})
ctx.reflect.provide(NS, service)
```

Rules for Remote methods:

- **Parameter names:** they are parsed from the method source, so keep them plain identifiers (no destructuring or defaults). The client passes `{ args: { name: value } }`.
- **Abort signal:** a trailing `signal` parameter receives the request's abort signal.
- **Return values:** return plain JSON. Return expected failures as `{ ok: false, error }` rather than throwing.

**Agent tools.** Tools registered with `ctx.inject(['tools'], c => c.tools.register(tool))` are available in every chat of the profile:

```js
{
  name: 'thing_query',              // snake_case, prefixed with the widget's domain
  description: '…when to use it, units, date format…',
  parameters: { type: 'object', properties: { … }, required: [ … ] },
  output: { schema: { type: 'object' }, render: (args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
  isConcurrencySafe: () => true,   // read-only tools only
  async execute(args, exec) { return { … } },  // return { error: '…hint for the model…' } instead of throwing
}
```

- **Schema keywords:** only `type`, `oneOf`, `properties`, `required`, `additionalProperties`, `items`, `enum`, `const`, plus `description`, `title`, `default` and `examples` are supported. `pattern`, `minimum`, `maximum` and `format` are rejected, so describe those constraints in the description and validate inside `execute`.
- **Tool results:** when there is no data yet, return a hint telling the model what the user should do in the widget.

**Folder picker.** `ctx.inject(['directoryPicker'], c => …)` gives `c.directoryPicker.capability()`.
- It returns `{ kind: 'native', pick(signal) }` or `{ kind: 'browse', … }`. There is no `pick` directly on the service.
- On macOS, when the capability isn't native, fall back to:
  ```js
  execFile('osascript', ['-e', 'tell application (path to frontmost application as text) to return POSIX path of (choose folder with prompt "…")'], { signal }, cb)
  // error -128 / "User canceled" → cancelled; strip the trailing "/"
  ```
  Keep it a single AppleScript expression, because multi-line `-e` scripts broke. Check script changes with `osacompile`.
- Always offer a typed-path fallback that expands `~` and requires an absolute path to an existing folder.

**Persistence.**
- Store state in `$DSH_HOME/storages/<widget>.json` (default `~/.dsh/storages`). All profiles on the machine share it.
- Write atomically (temp file + rename), and run writes one at a time through a promise chain, because the widget and the agent tools can write concurrently.
- Validate and sanitise on load.

**Network.** Node `fetch` works on the host. Do outside HTTP calls there, with `AbortSignal.timeout`, a fallback provider and a last-good cached value.

**File decoding.** Banks and Chinese apps export ISO-8859-1 or GBK files.
- Honour an XML prolog `encoding`.
- Otherwise try `new TextDecoder('utf-8', { fatal: true })` and fall back to `TextDecoder('gb18030')`.

### Install and the dev loop

- **CLI:** `DSH="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"`. It is not on PATH by default.
- **Desktop app (profile `desktop`):**
  - Link the working copy with `"$DSH" plugin --profile desktop add link:$PWD`.
  - After each `npm run build`, restart DeepSeek Harness. Linking means no re-install is needed.
  - Users install with `add github:<owner>/<repo>`, optionally with `#<sha>`, and uninstall with `remove <pkg-name>`.
- **Throwaway web profile for automated checks:**
  1. Create it once with `"$DSH" <p> --from-default-profile web --no-open --port 0`. This prints `http://127.0.0.1:<port>/?token=…`.
  2. Stop it.
  3. Run `"$DSH" plugin --profile <p> add link:$PWD`.
  4. From then on, start it with `"$DSH" <p> --no-open --port 0`.
  - `--from-default-profile` **resets the profile and drops its plugins**, so only use it on the first run.
  - Delete the profile afterwards with `rm -rf ~/.dsh/profiles/<p>`.
  - Don't run `dsh web --help` or `dsh headless --help`: they create profiles named `web` and `headless`.
- **The dev profile shares `~/.dsh/storages` and `~/.dsh/sessions` with the real app.**
  - Test chats show up in the user's sidebar, so archive them with the `workspace/archiveSession` RPC (`{ request: { sessionId } }`).
  - Saved settings are the user's real settings, so restore anything you changed.
- **No working LLM key in dev profiles**, so real agent replies can't be tested there.
  - Test tools by calling `execute` on a fake ctx in unit tests.
  - Leave an end-to-end chat check to the user in the desktop app.
- **Calling RPC by hand:** `GET /connect?token=…` sets a cookie. Then `POST /api/<namespace>/<method>` with `{ type: 'client-request', rpcId, method, payload: { args } }`.
- **Browser automation:** use `puppeteer-core` with the system Chrome (`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`).
  - Click "Continue" to dismiss the preview modal.
  - Open the panel by clicking the sidebar label `span`.
  - Use DOM `.click()` inside `page.evaluate`, because sticky headers intercept real clicks.
  - Set React inputs with the native `HTMLInputElement.prototype` value setter followed by an `input` event.
  - Collect `pageerror` events.

### Testing

- Use `node --test test/*.test.js`.
- Keep a pure data layer (no React, DOM or fs) and unit-test it.
- Test the host half with a fake ctx:
  ```js
  const provided = {}, injected = {}
  const ctx = { reflect: { provide: (n, v) => { provided[n] = v } },
    inject: (deps, fn) => { injected[deps.join(',')] = fn }, effect: fn => fn() }
  apply(ctx); injected.tools({ tools: { register: t => tools.push(t) } })
  ```
- Point `DSH_HOME` at a temp dir in tests.
- Make external effects (fetch, osascript) injectable so tests never hit the network or open dialogs.
- Assert that the Remote marker lists the expected methods, and that `method.toString()` still starts with the expected parameter list. That guards against a minifying or refactoring build.

### Shell gotchas (zsh on macOS)

- `echo ====` is an error, because `=word` triggers filename expansion.
- `${URL%%/?*}` globs. Use `sed` on URLs instead.
- There is no `timeout` command. Use a polling loop with `perl -e 'select(undef,undef,undef,0.5)'`.
<!-- dsh-widget-knowhow:end -->
