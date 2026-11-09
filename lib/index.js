// dsh-updraft v0.1.0 host half: generated from src/host by scripts/build.mjs, do not edit.

// src/host/index.js
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
var name = "dsh-updraft";
var SERVICE = "updraft";
var REMOTE_METHODS = "@deepseek-ai/dsh-typert-protocol/remote-methods";
function storePath(env = process.env) {
  const home = env.DSH_HOME?.trim() || join(homedir(), ".dsh");
  return join(home, "storages", "updraft.json");
}
var cleanScore = (v) => Number.isInteger(v) && v >= 0 && v < 1e6 ? v : 0;
async function load(file) {
  try {
    const v = JSON.parse(await readFile(file, "utf8"));
    return { best: cleanScore(v?.best), plays: cleanScore(v?.plays) };
  } catch {
    return { best: 0, plays: 0 };
  }
}
async function save(file, data) {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}
`);
  await rename(tmp, file);
}
var Updraft = class {
  constructor(file) {
    this.file = file;
    this.tail = Promise.resolve();
    this.typertRemote = Object.freeze({ service: this, serviceKey: SERVICE, namespace: SERVICE });
  }
  async state() {
    return load(this.file);
  }
  /** Record a finished run; keeps the higher best. Returns the stored state. */
  async finish(score) {
    if (!Number.isInteger(score) || score < 0) return { ok: false, error: "score must be a non-negative integer" };
    const run = this.tail.then(async () => {
      const cur = await load(this.file);
      const next = { best: Math.max(cur.best, score), plays: cur.plays + 1 };
      await save(this.file, next);
      return next;
    });
    this.tail = run.catch(() => {
    });
    return run;
  }
};
Object.defineProperty(Updraft.prototype, REMOTE_METHODS, {
  configurable: true,
  value: Object.freeze({
    version: 1,
    methods: Object.freeze(["state", "finish"].map((method) => Object.freeze({ method, invocation: Object.freeze({ kind: "direct" }) })))
  })
});
function apply(ctx) {
  ctx.reflect.provide(SERVICE, new Updraft(storePath()));
}
export {
  Updraft,
  apply,
  load,
  name,
  storePath
};
