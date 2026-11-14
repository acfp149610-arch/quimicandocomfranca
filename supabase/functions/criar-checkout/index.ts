import { createClient } from 'npm:@supabase/supabase-js@2';
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Método não permitido.'},405);
 try{
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,token=req.headers.get('Authorization')?.replace('Bearer ','');
  if(!token)return json({error:'Faça login para comprar.'},401);
  const authClient=createClient(url,anon);const {data:{user},error:authError}=await authClient.auth.getUser(token);if(authError||!user)return json({error:'Sessão inválida.'},401);
  const {course_id,payment_method}=await req.json();if(!course_id||!['pix','credit_card'].includes(payment_method))return json({error:'Dados da compra inválidos.'},400);
  const db=createClient(url,service);const {data:course,error}=await db.from('courses').select('id,title,description,price,active').eq('id',course_id).eq('active',true).single();if(error||!course)return json({error:'Curso indisponível.'},404);
  const {data:profile}=await db.from('profiles').select('phone').eq('id',user.id).maybeSingle();if(!profile?.phone)return json({error:'Informe seu telefone no cadastro antes de comprar.'},400);
  const {data:already}=await db.from('enrollments').select('course_id').eq('user_id',user.id).eq('course_id',course.id).maybeSingle();if(already)return json({error:'Você já possui acesso a este curso.',url:`${Deno.env.get('SITE_URL')||'https://acfp149610-arch.github.io'}/curso.html?id=${course.id}`},409);
  const {data:purchase,error:insertError}=await db.from('purchases').insert({user_id:user.id,course_id:course.id,course_title:course.title,student_email:user.email,student_phone:profile.phone,amount:course.price,payment_method,status:'pending'}).select('id').single();if(insertError)throw insertError;
  const accessToken=Deno.env.get('MP_ACCESS_TOKEN');if(!accessToken)throw new Error('Falta configurar MP_ACCESS_TOKEN nas secrets do Supabase.');
  const site=Deno.env.get('SITE_URL')||'https://acfp149610-arch.github.io';
  const preference={items:[{id:course.id,title:course.title,description:course.description||course.title,quantity:1,currency_id:'BRL',unit_price:Number(course.price)}],payer:{email:user.email},external_reference:purchase.id,notification_url:`${url}/functions/v1/webhook-mercadopago`,back_urls:{success:`${site}/retorno.html?status=success&compra=${purchase.id}`,pending:`${site}/retorno.html?status=pending&compra=${purchase.id}`,failure:`${site}/retorno.html?status=failure&compra=${purchase.id}`},auto_return:'approved',payment_methods:payment_method==='pix'?{excluded_payment_types:[{id:'credit_card'},{id:'debit_card'},{id:'ticket'}]}:{excluded_payment_types:[{id:'bank_transfer'},{id:'ticket'}]}};
  const mp=await fetch('https://api.mercadopago.com/checkout/preferences',{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify(preference)});const result=await mp.json();if(!mp.ok)throw new Error(result.message||'Mercado Pago não conseguiu criar o checkout.');
  await db.from('purchases').update({mp_preference_id:result.id}).eq('id',purchase.id);
  return json({url:result.init_point,purchase_id:purchase.id});
 }catch(e){return json({error:e.message||'Erro ao criar pagamento.'},500)}
});
