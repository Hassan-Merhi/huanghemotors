(() => {
  const page = document.body.dataset.page || 'home';
  const lang = () => localStorage.getItem('huanghe-language') === 'fr' ? 'fr' : 'en';
  const availability = {
    en: { in_stock: 'In stock', low_stock: 'Low stock', out_of_stock: 'Out of stock', coming_soon: 'Coming soon', inquire: 'Ask the Lubumbashi dealer for current availability' },
    fr: { in_stock: 'En stock', low_stock: 'Stock limité', out_of_stock: 'Rupture de stock', coming_soon: 'Bientôt disponible', inquire: 'Demandez la disponibilité actuelle à la concession de Lubumbashi' },
  };
  const pending = { en: 'Dealer confirmation required', fr: 'Confirmation de la concession requise' };
  let modelCache = null;

  async function getJson(url) {
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error('CMS unavailable');
    return response.json();
  }

  async function hydrateProduct(slug) {
    try {
      const { model } = await getJson(`/api/public/models/${encodeURIComponent(slug)}`);
      modelCache = model;
      applyProduct(model);
    } catch {
      // Static Wave 2 content remains the safe fallback when the CMS API is not deployed.
    }
  }

  function applyProduct(model) {
    if (!model) return;
    const currentLang = lang();
    const title = document.querySelector('.product-copy h1');
    const lead = document.querySelector('.product-lead');
    const status = document.querySelector('.product-status strong');
    if (title) title.textContent = model.name;
    if (lead) lead.textContent = currentLang === 'fr' ? model.description_fr || model.description_en : model.description_en || model.description_fr;
    if (status) status.textContent = availability[currentLang][model.availability] || availability[currentLang].inquire;
    applySpecs(model, currentLang);
    applyGallery(model, currentLang);
  }

  function applySpecs(model, currentLang) {
    const values = [model.spec_engine, model.spec_transmission, model.spec_brakes, model.spec_fuel, model.spec_colors, model.spec_price];
    const rows = [...document.querySelectorAll('.spec-row strong')];
    rows.forEach((node, index) => {
      const value = values[index];
      if (value) node.textContent = value;
      else if (index === values.length - 1) node.textContent = currentLang === 'fr' ? 'Demander à la concession' : 'Ask the dealer';
      else node.textContent = pending[currentLang];
    });
  }

  function applyGallery(model, currentLang) {
    if (!Array.isArray(model.images) || !model.images.length) return;
    const stage = document.querySelector('.product-stage');
    if (!stage) return;
    stage.classList.add('cms-gallery');
    stage.replaceChildren();
    const main = document.createElement('img');
    const sorted = [...model.images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);
    main.className = 'cms-main-photo';
    main.src = sorted[0].url;
    main.alt = currentLang === 'fr' ? sorted[0].alt_fr || sorted[0].alt_en || model.name : sorted[0].alt_en || sorted[0].alt_fr || model.name;
    stage.append(main);
    if (sorted.length > 1) {
      const thumbs = document.createElement('div');
      thumbs.className = 'cms-thumbs';
      sorted.forEach((image, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = index === 0 ? 'active' : '';
        const img = document.createElement('img');
        img.src = image.url;
        img.alt = '';
        button.append(img);
        button.addEventListener('click', () => {
          main.src = image.url;
          main.alt = currentLang === 'fr' ? image.alt_fr || image.alt_en || model.name : image.alt_en || image.alt_fr || model.name;
          [...thumbs.children].forEach((item) => item.classList.toggle('active', item === button));
        });
        thumbs.append(button);
      });
      stage.append(thumbs);
    }
  }

  function createHomeCard(model) {
    const grid = document.querySelector('.model-grid');
    if (!grid) return null;
    const article = document.createElement('article');
    article.className = `model-card model-card-${String(model.slug).replace(/[^a-z0-9-]/g, '')}`;
    article.innerHTML = `<div class="model-media placeholder-bike"><div class="placeholder-glow"></div><span class="model-monogram">${escapeText(model.name).slice(0,1)}</span></div><div class="model-content"><div class="model-topline"><span>Lubumbashi range</span><span class="status-dot"></span></div><h3></h3><p></p><div class="model-actions"><a href="motorcycle.html?model=${encodeURIComponent(model.slug)}">View motorcycle</a><span aria-hidden="true">↗</span></div></div>`;
    grid.append(article);
    return article;
  }

  function escapeText(value) {
    return String(value || '').replace(/[<>&"']/g, '');
  }

  async function hydrateHomepage() {
    try {
      const { models } = await getJson('/api/public/models');
      for (const model of models) {
        const slug = String(model.slug || '').toLowerCase();
        let card = document.querySelector(`.model-card-${CSS.escape(slug)}`);
        if (!card) card = createHomeCard(model);
        if (card) applyHomeCard(card, model);
      }
    } catch {
      // Static catalogue remains visible if CMS infrastructure is not yet configured.
    }
  }

  function applyHomeCard(card, model) {
    const currentLang = lang();
    const title = card.querySelector('h3');
    const copy = card.querySelector('.model-content p');
    const status = card.querySelector('.model-topline span:first-child');
    const media = card.querySelector('.model-media');
    if (title) title.textContent = model.name;
    if (copy) copy.textContent = currentLang === 'fr' ? model.description_fr || model.description_en : model.description_en || model.description_fr;
    if (status) status.textContent = availability[currentLang][model.availability] || availability[currentLang].inquire;
    if (media && model.images?.length) {
      const primary = [...model.images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0];
      media.replaceChildren();
      media.classList.add('cms-card-photo');
      const img = document.createElement('img');
      img.src = primary.url;
      img.alt = currentLang === 'fr' ? primary.alt_fr || primary.alt_en || model.name : primary.alt_en || primary.alt_fr || model.name;
      media.append(img);
    }
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-lang]')) return;
    setTimeout(() => {
      if (modelCache) applyProduct(modelCache);
      if (page === 'home' || page === 'index') hydrateHomepage();
    }, 0);
  });

  if (page === 'eagle' || page === 'super') hydrateProduct(page);
  if (page === 'motorcycle') {
    const slug = new URLSearchParams(location.search).get('model') || '';
    if (slug) hydrateProduct(slug);
  }
  if (page === 'home' || page === 'index') hydrateHomepage();
})();
