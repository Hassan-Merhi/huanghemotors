(() => {
  const source = document.getElementById('site-content-data');
  if (!source) return;
  const data = JSON.parse(source.textContent || '{}');
  const lang = () => localStorage.getItem('huanghe-language') === 'fr' ? 'fr' : 'en';
  const apply = () => {
    for (const node of document.querySelectorAll('[data-i18n]')) {
      const values = data.content?.[node.dataset.i18n];
      if (!values) continue;
      const value = lang() === 'fr' ? values.fr || values.en : values.en || values.fr;
      if (value) node.textContent = value;
    }
  };
  document.addEventListener('click', (event) => { if (event.target.closest('[data-lang]')) setTimeout(apply, 0); });
  apply();
})();
