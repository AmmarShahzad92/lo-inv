import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function createNoopQueryBuilder() {
  const result = { data: null, error: { message: 'Supabase not configured' } }
  const qb = new Proxy({}, {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve) => Promise.resolve(result).then(resolve)
      }
      if (prop === 'catch') {
        return (reject) => Promise.resolve(result).catch(reject)
      }
      if (prop === 'finally') {
        return (onFinally) => Promise.resolve(result).finally(onFinally)
      }
      return () => qb
    },
  })
  return qb
}

function createNoopChannel() {
  const channel = {
    on() { return channel },
    subscribe() { return channel },
    unsubscribe() { return Promise.resolve('ok') },
  }
  return channel
}

function createNoopClient() {
  return {
    from() { return createNoopQueryBuilder() },
    channel() { return createNoopChannel() },
    removeChannel() { return Promise.resolve('ok') },
    removeAllChannels() { return Promise.resolve('ok') },
  }
}

export function createClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    // Return a no-op client when env vars are unavailable.
    return createNoopClient()
  }
  return createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
}
