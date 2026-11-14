-- Quimicando com França: estrutura inicial da plataforma
create extension if not exists pgcrypto;

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  price numeric(10,2) not null check (price > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text not null default '',
  video_path text not null,
  position integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id),
  course_title text not null,
  student_email text not null,
  amount numeric(10,2) not null check (amount > 0),
  payment_method text not null check(payment_method in ('pix','credit_card')),
  status text not null default 'pending' check(status in ('pending','paid','rejected','cancelled')),
  mp_preference_id text,
  mp_payment_id text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create table if not exists public.enrollments (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  purchase_id uuid references public.purchases(id),
  created_at timestamptz not null default now(),
  primary key(user_id,course_id)
);
create table if not exists public.lesson_progress (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  primary key(user_id,lesson_id)
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.admins where user_id=auth.uid()); $$;

create or replace view public.my_course_access with (security_invoker=true) as
select c.id as course_id,c.title,c.description,c.price,
  coalesce((select round(100.0*count(*) filter(where lp.completed)/nullif(count(*),0)) from public.lessons l left join public.lesson_progress lp on lp.lesson_id=l.id and lp.user_id=auth.uid() where l.course_id=c.id and l.active),0)::integer as progress_percent
from public.courses c join public.enrollments e on e.course_id=c.id where e.user_id=auth.uid() and c.active=true;

alter table public.admins enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.purchases enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;

drop policy if exists "admins read self" on public.admins;
create policy "admins read self" on public.admins for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists "courses public active" on public.courses;
create policy "courses public active" on public.courses for select to anon,authenticated using(active=true or public.is_admin());
drop policy if exists "admins manage courses" on public.courses;
create policy "admins manage courses" on public.courses for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "lessons visible with enrollment" on public.lessons;
create policy "lessons visible with enrollment" on public.lessons for select to authenticated using(public.is_admin() or (active=true and exists(select 1 from public.enrollments e where e.user_id=auth.uid() and e.course_id=lessons.course_id)));
drop policy if exists "admins manage lessons" on public.lessons;
create policy "admins manage lessons" on public.lessons for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "students read own purchases" on public.purchases;
create policy "students read own purchases" on public.purchases for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists "admins read purchases" on public.purchases;
create policy "admins read purchases" on public.purchases for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "students read own enrollments" on public.enrollments;
create policy "students read own enrollments" on public.enrollments for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists "students read own progress" on public.lesson_progress;
create policy "students read own progress" on public.lesson_progress for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists "students update own progress" on public.lesson_progress;
create policy "students update own progress" on public.lesson_progress for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.lessons l join public.enrollments e on e.course_id=l.course_id where l.id=lesson_id and e.user_id=auth.uid()));
drop policy if exists "students edit own progress" on public.lesson_progress;
create policy "students edit own progress" on public.lesson_progress for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

-- Buckets privados. Vídeos não ficam públicos; o acesso ocorre por URL assinada gerada no servidor.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('videos-cursos','videos-cursos',false,524288000,array['video/mp4','video/webm','video/quicktime'])
on conflict(id) do update set public=false,file_size_limit=524288000,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "admins upload course videos" on storage.objects;
create policy "admins upload course videos" on storage.objects for insert to authenticated with check(bucket_id='videos-cursos' and public.is_admin());
drop policy if exists "admins manage course videos" on storage.objects;
create policy "admins manage course videos" on storage.objects for all to authenticated using(bucket_id='videos-cursos' and public.is_admin()) with check(bucket_id='videos-cursos' and public.is_admin());

-- Depois de criar a conta do proprietário, substitua o e-mail e execute esta instrução:
-- insert into public.admins(user_id) select id from auth.users where email='SEU_EMAIL_ADMIN';
drop policy if exists "admins read all enrollments" on public.enrollments;
create policy "admins read all enrollments" on public.enrollments for select to authenticated using(public.is_admin());
grant select on public.my_course_access to authenticated;
