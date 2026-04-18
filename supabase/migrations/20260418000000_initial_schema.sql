-- JESSE initial schema
-- Tables: profiles, conversations, messages, daily_content
-- RLS: every user sees only their own rows
-- Trigger: auto-create profile row on auth.users insert

-- =========================================================================
-- profiles: extends auth.users with app-specific fields
-- =========================================================================
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text,
    tier text not null default 'free' check (tier in ('free', 'paid')),
    api_key text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on column public.profiles.api_key is
    'User-supplied Anthropic API key for free tier. Paid tier ignores this and uses the server-side key via chat-proxy Edge Function.';

-- =========================================================================
-- conversations
-- =========================================================================
create table public.conversations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text,
    preview text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index conversations_user_updated_idx
    on public.conversations(user_id, updated_at desc);

-- =========================================================================
-- messages
-- =========================================================================
create table public.messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    role text not null check (role in ('user', 'assistant', 'system')),
    content text not null,
    created_at timestamptz not null default now()
);

create index messages_conversation_created_idx
    on public.messages(conversation_id, created_at);

-- =========================================================================
-- daily_content: cached "message of the day" per user per date
-- =========================================================================
create table public.daily_content (
    user_id uuid not null references auth.users(id) on delete cascade,
    date date not null,
    content text not null,
    verses jsonb,
    generated boolean not null default false,
    created_at timestamptz not null default now(),
    primary key (user_id, date)
);

-- =========================================================================
-- RLS: every user can only read/write their own data
-- =========================================================================
alter table public.profiles        enable row level security;
alter table public.conversations   enable row level security;
alter table public.messages        enable row level security;
alter table public.daily_content   enable row level security;

-- profiles
create policy "profiles_select_own" on public.profiles
    for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
    for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
    for insert with check (auth.uid() = id);

-- conversations
create policy "conversations_select_own" on public.conversations
    for select using (auth.uid() = user_id);
create policy "conversations_insert_own" on public.conversations
    for insert with check (auth.uid() = user_id);
create policy "conversations_update_own" on public.conversations
    for update using (auth.uid() = user_id);
create policy "conversations_delete_own" on public.conversations
    for delete using (auth.uid() = user_id);

-- messages (indirect ownership via conversation.user_id)
create policy "messages_select_own" on public.messages
    for select using (
        exists (
            select 1 from public.conversations c
            where c.id = conversation_id and c.user_id = auth.uid()
        )
    );
create policy "messages_insert_own" on public.messages
    for insert with check (
        exists (
            select 1 from public.conversations c
            where c.id = conversation_id and c.user_id = auth.uid()
        )
    );
create policy "messages_delete_own" on public.messages
    for delete using (
        exists (
            select 1 from public.conversations c
            where c.id = conversation_id and c.user_id = auth.uid()
        )
    );

-- daily_content
create policy "daily_select_own" on public.daily_content
    for select using (auth.uid() = user_id);
create policy "daily_insert_own" on public.daily_content
    for insert with check (auth.uid() = user_id);
create policy "daily_update_own" on public.daily_content
    for update using (auth.uid() = user_id);

-- =========================================================================
-- Trigger: auto-create a profile row whenever a new auth user signs up
-- =========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, display_name)
    values (
        new.id,
        coalesce(
            new.raw_user_meta_data->>'display_name',
            split_part(new.email, '@', 1)
        )
    );
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- =========================================================================
-- Trigger: bump updated_at on profiles + conversations
-- =========================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

create trigger profiles_set_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();

create trigger conversations_set_updated_at
    before update on public.conversations
    for each row execute function public.set_updated_at();
