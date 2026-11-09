// Browser-side calls into the host half's `updraft` Remote service.

const NAMESPACE = 'updraft'

let connection
const waiters = new Set()

export function bindConnection(ctx) {
  ctx.inject(['connection'], c => {
    c.effect(() => {
      connection = c.connection
      for (const w of waiters) w()
      waiters.clear()
      return () => { connection = undefined }
    }, 'dsh-updraft: connection')
  })
}

function ready(signal) {
  if (connection) return Promise.resolve(connection)
  return new Promise((resolve, reject) => {
    const done = () => resolve(connection)
    waiters.add(done)
    signal?.addEventListener('abort', () => { waiters.delete(done); reject(signal.reason) }, { once: true })
  })
}

export async function call(method, args = {}, signal) {
  const conn = await ready(signal)
  const result = await conn.rpc.call('/api', `${NAMESPACE}/${method}`, { args }, signal)
  if (!result?.ok) {
    const error = result?.error
    throw new Error(error?.message ?? error?.code ?? 'unknown error')
  }
  return result.value
}
