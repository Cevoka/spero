// JESSE chat-proxy Edge Function
// Not: Supabase altyapısı JWT'yi zaten doğrular; koda ulaşan istek geçerli demektir.

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

function decodeJWT(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(payload)
  } catch { return null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Giris yapmaniz gerekiyor.' }, 401)
  }

  // JWT altyapı tarafından doğrulandı; payload'dan user_id al
  const token = authHeader.slice(7)
  const payload = decodeJWT(token)
  if (!payload?.sub) {
    return json({ error: 'Gecersiz oturum.' }, 401)
  }

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicKey) return json({ error: 'Sunucu yapilandirma hatasi.' }, 500)

  let body: {
    messages?: Array<{ role: string; content: string }>
    system?: string
    model?: string
    max_tokens?: number
  }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Gecersiz istek.' }, 400)
  }

  const { messages, system, model = 'claude-sonnet-4-6', max_tokens = 1024 } = body
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: 'Mesaj listesi bos.' }, 400)
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
