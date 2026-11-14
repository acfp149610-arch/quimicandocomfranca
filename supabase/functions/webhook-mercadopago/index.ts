import { createClient } from 'npm:@supabase/supabase-js@2';
function hex(buffer:ArrayBuffer){return [...new Uint8Array(buffer)].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function hmac(secret:string,message:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message)))}
Deno.serve(async(req)=>{
 if(req.method!=='POST')return new Response('ok');
 try{
  const secret=Deno.env.get('MP_WEBHOOK_SECRET');if(!secret)return new Response('Webhook secret não configurado.',{status:500});
  const url=new URL(req.url),dataId=(url.searchParams.get('data.id')||url.searchParams.get('id')||'').toLowerCase(),signature=req.headers.get('x-signature')||'',requestId=req.headers.get('x-request-id')||'';
  const parts=Object.fromEntries(signature.split(',').map(x=>x.trim().split('=')) as [string,string][]);const ts=parts.ts,provided=parts.v1;
  if(!dataId||!ts||!provided||!requestId)return new Response('Assinatura ausente.',{status:401});
  const manifest=`id:${dataId};request-id:${requestId};ts:${ts};`;const expected=await hmac(secret,manifest);
  if(expected!==provided)return new Response('Assinatura inválida.',{status:401});
  const paymentToken=Deno.env.get('MP_ACCESS_TOKEN')!;const paymentResponse=await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`,{headers:{Authorization:`Bearer ${paymentToken}`}});const payment=await paymentResponse.json();if(!paymentResponse.ok)return new Response('Não foi possível consultar o pagamento.',{status:502});
  if(payment.status!=='approved')return new Response('Pagamento ainda não aprovado.',{status:200});
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);const purchaseId=payment.external_reference;if(!purchaseId)return new Response('Compra não identificada.',{status:400});
  const {data:purchase,error}=await db.from('purchases').select('*').eq('id',purchaseId).single();if(error||!purchase)return new Response('Compra não encontrada.',{status:404});
  if(Number(payment.transaction_amount)!==Number(purchase.amount)||payment.currency_id!=='BRL')return new Response('Valor ou moeda divergente.',{status:400});
  if(purchase.status==='paid')return new Response('Pagamento já processado.',{status:200});
  const {error:updateError}=await db.from('purchases').update({status:'paid',mp_payment_id:String(payment.id),paid_at:new Date().toISOString()}).eq('id',purchase.id);if(updateError)throw updateError;
  const {error:enrollError}=await db.from('enrollments').upsert({user_id:purchase.user_id,course_id:purchase.course_id,purchase_id:purchase.id},{onConflict:'user_id,course_id'});if(enrollError)throw enrollError;
  return new Response('Pagamento confirmado e curso liberado.',{status:200});
 }catch(e){console.error(e);return new Response('Erro interno.',{status:500})}
});
