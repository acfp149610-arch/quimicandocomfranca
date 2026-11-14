import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) return json({ error: 'Faça login para acessar este material.' }, 401);

    const auth = createClient(url, anon);
    const { data: { user }, error: authError } = await auth.auth.getUser(token);
    if (authError || !user) return json({ error: 'Sessão inválida.' }, 401);

    const { pdf_id } = await req.json();
    if (!pdf_id) return json({ error: 'PDF não informado.' }, 400);

    const db = createClient(url, service);
    const { data: pdf, error } = await db
      .from('course_pdfs')
      .select('id, course_id, file_path, active')
      .eq('id', pdf_id)
      .eq('active', true)
      .single();

    if (error || !pdf) return json({ error: 'Material não encontrado ou indisponível.' }, 404);

    const { data: admin } = await db
      .from('admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: enrollment } = await db
      .from('enrollments')
      .select('course_id')
      .eq('user_id', user.id)
      .eq('course_id', pdf.course_id)
      .maybeSingle();

    if (!admin && !enrollment) {
      return json({ error: 'Este material é exclusivo para alunos matriculados neste curso.' }, 403);
    }

    const { data: signed, error: signedError } = await db.storage
      .from('pdf-cursos')
      .createSignedUrl(pdf.file_path, 3600, { download: true });

    if (signedError) throw signedError;

    return json({ url: signed.signedUrl, expires_in: 3600 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao liberar PDF.';
    return json({ error: message }, 500);
  }
});
