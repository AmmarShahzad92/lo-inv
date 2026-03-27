import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

let client = null

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
  if (!client) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      // Return a no-op client when env vars are unavailable.
      return createNoopClient()
    }
    client = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  }
  return client
}
