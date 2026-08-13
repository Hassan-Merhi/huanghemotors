(() => {
  const internalNames = ['Website Photo · Homepage Hero','Website Photo · Heritage Large','Website Photo · Heritage Side','Website Photo · Dealership Showroom'];
  const modelList = document.querySelector('[data-model-list]');
  const sidebar = document.querySelector('.sidebar');
  const editor = document.querySelector('[data-editor]');
  const workspace = document.querySelector('.workspace');
  const header = document.querySelector('.workspace-header');
  const addButton = document.querySelector('[data-new-model]');
  if (!modelList || !sidebar || !editor || !workspace || !header) return;

  document.body.classList.add('admin-ux-ready');

  function hideInternalModels() {
    modelList.querySelectorAll('.model-item').forEach((button) => {
      if (internalNames.some((name) => button.textContent.includes(name))) {
        button.hidden = true;
        button.dataset.internalModel = 'true';
      }
    });
  }
  hideInternalModels();
  new MutationObserver(hideInternalModels).observe(modelList, { childList: true });

  const nav = document.createElement('nav');
  nav.className = 'admin-primary-nav';
  const links = [
    ['index.html','Motorcycles','Models, details & photos'],
    ['content.html','Website content','Homepage text & website images'],
    ['operations.html','Leads & integrations','Inquiries, WhatsApp & Moto Track'],
    ['../index.html','Open website ↗','View the public site'],
  ];
  links.forEach(([href,title,subtitle], index) => {
    const link = document.createElement('a');
    link.href = href;
    if (index === 0) link.className = 'active';
    if (index === 3) { link.target = '_blank'; link.rel = 'noopener'; }
    const strong = document.createElement('strong'); strong.textContent = title;
    const small = document.createElement('small'); small.textContent = subtitle;
    link.append(strong, small); nav.append(link);
  });
  sidebar.querySelector('.sidebar-brand')?.after(nav);

  const section = document.createElement('section');
  section.className = 'sidebar-section';
  const heading = document.createElement('div');
  heading.className = 'sidebar-section-heading';
  const label = document.createElement('span'); label.textContent = 'MOTORCYCLES';
  const hint = document.createElement('small'); hint.textContent = 'Only catalogue models appear here';
  heading.append(label, hint); section.append(heading);
  if (addButton) section.append(addButton);
  section.append(modelList); nav.after(section);

  const footer = document.querySelector('.sidebar-footer');
  footer?.querySelectorAll('a').forEach((link) => link.remove());

  const tabs = document.createElement('nav');
  tabs.className = 'editor-tabs';
  tabs.hidden = true;
  [['details','Details'],['specs','Specifications'],['photos','Photos']].forEach(([key,title], index) => {
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.uxTab = key;
    if (index === 0) button.className = 'active';
    const number = document.createElement('span'); number.textContent = String(index + 1);
    button.append(number, document.createTextNode(` ${title}`)); tabs.append(button);
  });
  header.after(tabs);

  const panels = editor.querySelectorAll('.editor-grid > .panel');
  const details = panels[0]; const specs = panels[1]; const photos = editor.querySelector('.media-panel');
  const danger = editor.querySelector('[data-danger-zone]');
  const internalSlug = new URLSearchParams(location.search).get('model') || '';
  const internalPhotoMode = internalSlug.startsWith('site-');

  function setSection(sectionName) {
    workspace.dataset.uxSection = sectionName;
    if (details) details.hidden = sectionName !== 'details';
    if (specs) specs.hidden = sectionName !== 'specs';
    if (photos) photos.hidden = sectionName !== 'photos';
    tabs.querySelectorAll('[data-ux-tab]').forEach((button) => button.classList.toggle('active', button.dataset.uxTab === sectionName));
    danger?.classList.toggle('ux-section-hidden', sectionName !== 'details');
  }
  tabs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-ux-tab]');
    if (button && !button.hidden) setSection(button.dataset.uxTab);
  });

  function syncEditor() {
    tabs.hidden = editor.hidden;
    if (editor.hidden) return;
    if (internalPhotoMode) {
      tabs.querySelectorAll('[data-ux-tab]').forEach((button) => { button.hidden = button.dataset.uxTab !== 'photos'; });
      setSection('photos');
    }
  }
  new MutationObserver(syncEditor).observe(editor, { attributes: true, attributeFilter: ['hidden'] });
  modelList.addEventListener('click', (event) => {
    const button = event.target.closest('.model-item');
    if (button && button.dataset.internalModel !== 'true') setTimeout(() => setSection('details'), 0);
  });
  addButton?.addEventListener('click', () => setTimeout(() => setSection('details'), 0));
  syncEditor();
  if (!internalPhotoMode) setSection('details');
})();
