document.addEventListener('DOMContentLoaded', async () => {
  const sb = window.supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY);
  const box = document.getElementById('listaPdfs');
  document.getElementById('ano').textContent = new Date().getFullYear();
  const { data, error } = await sb.from('free_pdfs')
    .select('id,title,description,file_path')
    .eq('active', true)
    .order('created_at', { ascending: false });
  box.innerHTML = '';
  if (error) {
    box.textContent = 'Não foi possível carregar os PDFs: ' + error.message;
    return;
  }
  if (!data?.length) {
    box.innerHTML = '<p class="empty">Os materiais gratuitos serão publicados aqui em breve.</p>';
    return;
  }
  data.forEach(pdf => {
    const card = document.createElement('article');
    card.className = 'pdf-public-card';
    const icon = document.createElement('div');
    icon.className = 'pdf-icon';
    icon.textContent = 'PDF';
    const title = document.createElement('h2');
    title.textContent = pdf.title;
    const description = document.createElement('p');
    description.textContent = pdf.description || 'Material gratuito para seus estudos.';
    const link = document.createElement('a');
    link.className = 'btn';
    link.href = `https://${APP_CONFIG.SUPABASE_URL.replace(/^https?:\/\//,'')}/storage/v1/object/public/pdf-gratuitos/${pdf.file_path.split('/').map(encodeURIComponent).join('/')}`;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Baixar PDF';
    card.append(icon, title, description, link);
    box.append(card);
  });
});