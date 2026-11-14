# Quimicando com França — plataforma de cursos

Esta versão amplia o site estático existente e adiciona uma área de aluno, catálogo de cursos individuais, checkout Mercado Pago, controle de acesso por matrícula, aulas em vídeo privado e painel administrativo.

## O que já está no projeto

- Site público verde bandeira e amarelo escuro com catálogo dinâmico de cursos.
- Cadastro/login de aluno pelo Supabase Auth (e-mail e senha).
- Área do aluno que lista somente cursos liberados.
- Compra individual de curso com escolha PIX ou cartão no checkout do Mercado Pago.
- Webhook que confirma o pagamento consultando a API do Mercado Pago; somente pagamento `approved`, com valor/moeda conferidos, gera matrícula.
- Vídeos guardados no bucket privado `videos-cursos`; a URL temporária só é emitida depois de verificar matrícula ou administrador.
- Registro de aula concluída após o aluno assistir a pelo menos 90% do vídeo.
- Painel administrativo para cadastrar cursos, enviar vídeos e consultar compras.
- Arquivos antigos preservados em `backup/`.

## Antes de publicar: configuração obrigatória

O ZIP não contém tokens privados. Não coloque `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` nem `SUPABASE_SERVICE_ROLE_KEY` em arquivos `.js`, HTML ou no GitHub.

### 1. Conferir o Supabase

O `config.js` já contém a URL e a chave pública que estavam no projeto enviado. A chave pública pode ser usada no navegador; ela não substitui as políticas RLS.

1. Abra o projeto Supabase já usado pelo site.
2. Entre em **SQL Editor**.
3. Execute em ordem `supabase/migrations/001_plataforma_cursos.sql` e `supabase/migrations/002_materiais_pdf.sql`, copiando cada arquivo no SQL Editor.
4. Em **Authentication → URL Configuration**, configure o Site URL para `https://acfp149610-arch.github.io` e adicione também `https://acfp149610-arch.github.io/**` às Redirect URLs, se necessário.
5. Em **Authentication → Providers → Email**, mantenha Email habilitado. Configure confirmação de e-mail conforme sua preferência.

A migração cria as tabelas novas e o bucket privado de vídeos. Ela não apaga a tabela antiga `contratacoes` nem a função antiga `confirmar-contratacao`.

### 2. Criar sua conta de administrador

1. Publique o site e abra `login.html`.
2. Crie uma conta com o e-mail que será o administrador e confirme o e-mail, caso a confirmação esteja habilitada.
3. No Supabase, abra **SQL Editor** e execute, substituindo pelo seu e-mail:

```sql
insert into public.admins(user_id)
select id from auth.users where email = 'SEU_EMAIL_ADMIN'
on conflict (user_id) do nothing;
```

4. Abra `admin.html` e entre com esse e-mail e senha. Não compartilhe essa conta.

### 3. Configurar o Mercado Pago

É necessário ter uma conta Mercado Pago com credenciais de integração. Para produção, use credenciais de produção; para testes, use credenciais de teste e usuários de teste.

Instale/abra o Supabase CLI e faça login e link do projeto:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
```

Configure as secrets (não use valores fictícios):

```bash
supabase secrets set MP_ACCESS_TOKEN=SEU_ACCESS_TOKEN
supabase secrets set MP_WEBHOOK_SECRET=SEGREDO_DE_ASSINATURA_DO_WEBHOOK
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_KEY
supabase secrets set SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
supabase secrets set SITE_URL=https://acfp149610-arch.github.io
```

Publique as funções:

```bash
supabase functions deploy criar-checkout
supabase functions deploy webhook-mercadopago
supabase functions deploy url-video
supabase functions deploy url-pdf
```

No painel do Mercado Pago, cadastre a URL de webhook:

`https://SEU_PROJECT_REF.supabase.co/functions/v1/webhook-mercadopago`

Habilite notificações de pagamentos e copie o segredo de assinatura para `MP_WEBHOOK_SECRET`. Confirme no painel do Mercado Pago que a assinatura enviada corresponde ao mecanismo de assinatura atual da sua aplicação. Faça primeiro uma compra de teste e confira a linha em `purchases` e a matrícula em `enrollments`.

### 4. Publicar no GitHub Pages

Envie os arquivos da raiz deste ZIP para a raiz do repositório que publica o site. Preserve a pasta `supabase/` no repositório para versionar SQL e funções. O GitHub Pages serve apenas os arquivos estáticos; as funções continuam hospedadas no Supabase.

## Fluxo de funcionamento

1. O administrador cadastra um curso e seu preço em `admin.html`.
2. O administrador envia os vídeos pelo formulário de aulas. Eles ficam no bucket privado `videos-cursos`.
3. O aluno cria conta, entra e escolhe um curso.
4. O checkout é criado no servidor usando o preço salvo no banco (não o preço enviado pelo navegador).
5. O Mercado Pago notifica o webhook. A função consulta o pagamento diretamente na API, confere status aprovado, valor, moeda e referência da compra.
6. Só então cria a matrícula em `enrollments`.
7. O aluno passa a ver o curso em `aluno.html`. Para assistir, o servidor verifica a matrícula e gera uma URL assinada temporária.

## Limitações e observações importantes

- A integração de pagamentos não fica operacional até configurar as secrets, publicar as Edge Functions e cadastrar o webhook no Mercado Pago.
- O retorno do checkout não libera curso por conta própria; a liberação depende do webhook validado.
- O controle de 90% é uma regra de acompanhamento do player. Nenhum player web consegue provar de forma inviolável que uma pessoa prestou atenção ao vídeo; ele registra a reprodução no navegador.
- O bloqueio reduz o acesso casual, mas não impede gravação de tela ou cópia durante a validade de uma URL assinada. Para DRM avançado e streaming adaptativo, considere Cloudflare Stream ou outro serviço com DRM.
- Upload direto pelo painel aceita MP4, WebM e MOV até 500 MB por vídeo. Para arquivos maiores, use streaming dedicado.
- O catálogo começa vazio: cadastre os cursos e preços reais pelo painel. Nenhum preço fictício foi mantido.
- O código usa os nomes de domínio e projeto presentes no ZIP original. Se o endereço público do GitHub Pages for diferente, ajuste `SITE_URL` nas secrets e `APP_CONFIG.SITE_URL` em `config.js`.

## Arquivos principais

- `index.html`, `style.css`, `catalogo.js`: site público e catálogo.
- `login.html`, `auth.js`: cadastro e login.
- `aluno.html`, `aluno.js`: cursos comprados.
- `checkout.html`, `checkout.js`: escolha de PIX/cartão.
- `curso.html`, `curso.js`: player e progresso.
- `admin.html`, `admin-novo.js`: painel administrativo.
- `supabase/migrations/001_plataforma_cursos.sql` e `002_materiais_pdf.sql`: banco, RLS e buckets de arquivos.
- `pdfs-gratuitos.html`, `pdfs-gratuitos.js`, `pdfs.css`: biblioteca pública de PDFs.
- `supabase/functions/url-pdf/`: liberação temporária de PDFs de cursos após verificar matrícula.
- `supabase/functions/`: funções seguras de checkout, webhook e liberação de vídeo.
- `backup/`: cópia dos arquivos recebidos, sem alterações.


## QUIMICANDO COM FRANÇA — telefone e compradores

1. Publique os arquivos da raiz no GitHub Pages (Settings → Pages → Deploy from a branch → main / root). O site é frontend estático.
2. No projeto Supabase já configurado, execute em ordem as migrations `001_plataforma_cursos.sql`, `002_materiais_pdf.sql` e `003_telefone_alunos.sql` no SQL Editor.
3. O cadastro e o login pedem telefone com DDD. O telefone fica em `profiles` e é copiado para `purchases.student_phone` no momento da compra. O painel administrativo mostra e-mail, telefone, curso, valor e situação da compra.
4. Para autorizar sua conta como administradora, crie primeiro a conta pelo site e execute: `insert into public.admins(user_id) select id from auth.users where email='SEU_EMAIL';`
5. Configure as Edge Functions `criar-checkout` e `webhook-mercadopago` no Supabase, com secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MP_ACCESS_TOKEN` e `SITE_URL`. Nunca coloque a chave secreta do Mercado Pago nem a service role no GitHub Pages ou em `config.js`.
6. Faça deploy das Edge Functions e configure a URL do webhook no painel Mercado Pago. O checkout PIX/cartão já chama a função segura; sem `MP_ACCESS_TOKEN` configurado, o pagamento não será processado.

**Importante:** GitHub Pages hospeda somente os arquivos públicos do site. Login, banco de dados, controle de acesso, vídeos privados e confirmação de pagamento continuam no Supabase/Edge Functions. O telefone é dado pessoal: use-o apenas para contato relacionado à compra e mantenha as políticas de privacidade adequadas.
