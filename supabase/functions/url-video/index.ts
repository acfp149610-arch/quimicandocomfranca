import { createClient } from 'npm:@supabase/supabase-js@2';
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 try{
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,token=req.headers.get('Authorization')?.replace('Bearer ','');if(!token)return json({error:'Faça login.'},401);
  const auth=createClient(url,anon);const {data:{user},error:authError}=await auth.auth.getUser(token);if(authError||!user)return json({error:'Sessão inválida.'},401);
  const {lesson_id}=await req.json();if(!lesson_id)return json({error:'Aula não informada.'},400);
  const db=createClient(url,service);const {data:lesson,error}=await db.from('lessons').select('id,course_id,video_path,active').eq('id',lesson_id).eq('active',true).single();if(error||!lesson)return json({error:'Aula não encontrada.'},404);
  const {data:admin}=await db.from('admins').select('user_id').eq('user_id',user.id).maybeSingle();const {data:enrollment}=await db.from('enrollments').select('course_id').eq('user_id',user.id).eq('course_id',lesson.course_id).maybeSingle();if(!admin&&!enrollment)return json({error:'Este curso não está liberado para sua conta.'},403);
  const {data:signed,error:signedError}=await db.storage.from('videos-cursos').createSignedUrl(lesson.video_path,3600,{download:false});if(signedError)throw signedError;return json({url:signed.signedUrl,expires_in:3600});
 }catch(e){return json({error:e.message||'Erro ao liberar vídeo.'},500)}
});
