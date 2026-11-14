-- Materiais PDF: arquivos dos cursos (privados) e biblioteca gratuita (publica)
create table if not exists public.course_pdfs (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text not null default '',
  file_path text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.free_pdfs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  file_path text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.course_pdfs enable row level security;
alter table public.free_pdfs enable row level security;

drop policy if exists "admins manage course pdf metadata" on public.course_pdfs;
create policy "admins manage course pdf metadata" on public.course_pdfs
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "enrolled students read course pdf metadata" on public.course_pdfs;
create policy "enrolled students read course pdf metadata" on public.course_pdfs
for select to authenticated using (
  active = true and exists (
    select 1 from public.enrollments e
    where e.user_id = auth.uid() and e.course_id = course_pdfs.course_id
  )
);

drop policy if exists "public read active free pdf metadata" on public.free_pdfs;
create policy "public read active free pdf metadata" on public.free_pdfs
for select to anon, authenticated using (active = true or public.is_admin());

drop policy if exists "admins manage free pdf metadata" on public.free_pdfs;
create policy "admins manage free pdf metadata" on public.free_pdfs
for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.course_pdfs to authenticated;
grant insert, update, delete on public.course_pdfs to authenticated;
grant select on public.free_pdfs to anon, authenticated;
grant insert, update, delete on public.free_pdfs to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
('pdf-cursos','pdf-cursos',false,52428800,array['application/pdf']),
('pdf-gratuitos','pdf-gratuitos',true,52428800,array['application/pdf'])
on conflict(id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "admins upload course pdfs" on storage.objects;
create policy "admins upload course pdfs" on storage.objects
for insert to authenticated with check (bucket_id='pdf-cursos' and public.is_admin());

drop policy if exists "admins manage course pdf files" on storage.objects;
create policy "admins manage course pdf files" on storage.objects
for all to authenticated using (bucket_id='pdf-cursos' and public.is_admin())
with check (bucket_id='pdf-cursos' and public.is_admin());

drop policy if exists "admins manage free pdf files" on storage.objects;
create policy "admins manage free pdf files" on storage.objects
for all to authenticated using (bucket_id='pdf-gratuitos' and public.is_admin())
with check (bucket_id='pdf-gratuitos' and public.is_admin());

notify pgrst, 'reload schema';
