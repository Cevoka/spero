# JESSE — Supabase Backend (Faz 1)

Bu klasör JESSE'in sunucu tarafı bileşenlerini içerir:
- `migrations/` — PostgreSQL şema migrasyonları
- `functions/chat-proxy/` — paid-tier için Anthropic API proxy Edge Function
- `config.toml` — Supabase CLI lokal konfigürasyonu

## Kurulum

### 1. Supabase hesabı ve projesi

1. <https://supabase.com> adresinde ücretsiz hesap oluştur.
2. **New project** ile yeni proje aç:
   - **Name:** `jesse`
   - **Database password:** güçlü bir parola (kaydet — bir daha gösterilmez)
   - **Region:** `Europe (Frankfurt)` (Türkiye'ye en yakın)
3. Proje hazır olunca **Settings → API** sayfasından şunları kopyala:
   - `Project URL` (örn. `https://xxxxx.supabase.co`)
   - `anon / public key` (tarayıcıdan kullanılacak)
   - `service_role key` (gizli, sadece sunucuda — GitHub'a commit edilmez)

### 2. Supabase CLI (yerel geliştirme + deploy için)

```bash
brew install supabase/tap/supabase
supabase login
supabase link --project-ref <PROJECT_REF>
```

`<PROJECT_REF>` değeri Project URL'inin subdomain kısmı (`https://xxxxx.supabase.co` → `xxxxx`).

### 3. Migrasyonu uygula

Seçenek A — **Dashboard ile (hızlı)**:
- Supabase Dashboard → **SQL Editor** → **New query**
- `migrations/20260418000000_initial_schema.sql` içeriğini yapıştır → **Run**

Seçenek B — **CLI ile (önerilen)**:
```bash
cd supabase
supabase db push
```

Doğrulama: Dashboard → **Table Editor** — `profiles`, `conversations`, `messages`, `daily_content` görünmeli.

### 4. Edge Function deploy

Önce Edge Function'ın ihtiyacı olan Anthropic API key'i secret olarak ekle:

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
```

Sonra deploy:

```bash
supabase functions deploy chat-proxy
```

Doğrulama:
```bash
curl -i -X POST https://<PROJECT_REF>.supabase.co/functions/v1/chat-proxy \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}'
```
Beklenen: `401 Unauthorized` (henüz login'li kullanıcı yok — normal).

### 5. Email auth ayarları

Dashboard → **Authentication → Providers → Email**:
- **Enable Email provider:** ON
- **Confirm email:** geliştirme sırasında KAPALI (prod'da AÇ)

## Güvenlik notları

- `service_role key` **hiçbir zaman** client kodda, GitHub'da veya Capacitor bundle'da olmamalı.
- `anon key` public'tir, client'ta kullanılır. Güvenliği RLS policies sağlar.
- Kullanıcılar kendi API key'lerini (`profiles.api_key`) girerse, bu değer RLS sayesinde sadece kendilerine okunabilir. Yine de production'da application-level encryption eklemeyi düşünün (örn. user parolasından türetilmiş bir key ile AES).

## Sonraki faz

Şema + Edge Function deploy olunca Faz 2'ye geçilir: web frontend'inde `js/auth.js`, `js/storage.js`, `js/api.js` Supabase'e bağlanır.
