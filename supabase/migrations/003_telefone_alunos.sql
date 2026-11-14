-- QUIMICANDO COM FRANÇA: telefone do aluno e identificação de compradores por curso
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.purchases add column if not exists student_phone text not null default '';
alter table public.profiles enable row level security;
drop policy if exists "students manage own profile" on public.profiles;
create policy "students manage own profile" on public.profiles for all to authenticated using(id=auth.uid() or public.is_admin()) with check(id=auth.uid() or public.is_admin());
drop policy if exists "admins read all profiles" on public.profiles;
create policy "admins read all profiles" on public.profiles for select to authenticated using(public.is_admin());
grant select, insert, update on public.profiles to authenticated;
-- Copia nome e telefone do cadastro do Supabase Auth para a tabela consultável pelo painel.
create or replace function public.handle_new_user_profile() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,full_name,phone) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),coalesce(new.raw_user_meta_data->>'phone',''))
 on conflict(id) do update set full_name=excluded.full_name,phone=case when excluded.phone<>'' then excluded.phone else public.profiles.phone end,updated_at=now();
 return new;
end; $$;
drop trigger if exists on_auth_user_profile_created on auth.users;
create trigger on_auth_user_profile_created after insert or update of raw_user_meta_data on auth.users for each row execute procedure public.handle_new_user_profile();
-- Backfill de usuários já cadastrados.
insert into public.profiles(id,full_name,phone) select id,coalesce(raw_user_meta_data->>'full_name',''),coalesce(raw_user_meta_data->>'phone','') from auth.users on conflict(id) do nothing;
