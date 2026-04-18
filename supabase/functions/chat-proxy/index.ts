// JESSE chat-proxy Edge Function
// Auth-gated Anthropic API proxy for paid-tier users.
// Free-tier users call Anthropic directly from the client with their own key.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Missing bearer token' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!supabaseUrl || !supabaseAnon || !anthropicKey) {
    return json({ error: 'Server misconfigured' }, 500)
  }

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401)
  const userId = userData.user.id

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', userId)
    .single()

  if (profileErr) return json({ error: 'Profile not found' }, 403)
  if (profile.tier !== 'paid') return json({ error: 'Paid tier required' }, 403)

  let body: {
    messages?: Array<{ role: string; content: string }>
    system?: string
    model?: string
    max_tokens?: number
  }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { messages, system, model = 'claude-sonnet-4-6', max_tokens = 1024 } = body
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: 'messages array required' }, 400)
  }

  const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens, system, messages }),
  })

  const respBody = await anthropicResp.json().catch(() => ({}))
  return json(respBody, anthropicResp.status)
})
