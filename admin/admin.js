const state = { models: [], current: null, creating: false, dirty: false, language: 'en' };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const loginPanel = $('[data-login-panel]');
const dashboard = $('[data-dashboard]');
const editor = $('[data-editor]');
const emptyState = $('[data-empty-state]');
const saveButton = $('[data-save]');
const saveState = $('[data-save-state]');

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && path !== '/api/admin/login') showLogin();
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

async function boot() {
  try {
    await api('/api/admin/session');
    await enterDashboard();
  } catch {
    showLogin();
  }
}

function showLogin() {
  loginPanel.hidden = false;
  dashboard.hidden = true;
}

async function enterDashboard() {
  loginPanel.hidden = true;
  dashboard.hidden = false;
  await loadModels();
}

$('[data-login-form]').addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = $('[data-login-status]');
  status.textContent = 'Signing in…';
  const password = event.currentTarget.password.value;
  try {
    await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
    event.currentTarget.reset();
    status.textContent = '';
    await enterDashboard();
  } catch (error) {
    status.textContent = error.message;
  }
});

$('[data-logout]').addEventListener('click', async () => {
  try { await api('/api/admin/logout', { method: 'POST', body: '{}' }); } catch {}
  showLogin();
});

async function loadModels(selectSlug = state.current?.slug) {
  const { models } = await api('/api/admin/models');
  state.models = models;
  renderModelList();
  if (selectSlug) {
    const model = models.find((item) => item.slug === selectSlug);
    if (model) selectModel(model);
  }
}

function renderModelList() {
  const list = $('[data-model-list]');
  list.replaceChildren();
  for (const model of state.models) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `model-item${state.current?.slug === model.slug && !state.creating ? ' active' : ''}`;
    const label = document.createElement('strong');
    label.textContent = model.name;
    const status = document.createElement('span');
    status.className = model.published ? 'live' : '';
    status.textContent = model.published ? 'Live' : 'Hidden';
    button.append(label, status);
    button.addEventListener('click', () => selectModel(model));
    list.append(button);
  }
}

function selectModel(model) {
  state.current = structuredClone(model);
  state.creating = false;
  state.dirty = false;
  emptyState.hidden = true;
  editor.hidden = false;
  $('[data-editor-title]').textContent = model.name;
  fillEditor(model);
  $('[data-danger-zone]').hidden = model.slug === 'eagle' || model.slug === 'super';
  renderMedia();
  renderModelList();
  updateDirtyState();
}

$('[data-new-model]').addEventListener('click', () => {
  state.current = {
    slug: '', name: '', description_en: '', description_fr: '', availability: 'inquire', published: true,
    spec_engine: '', spec_transmission: '', spec_brakes: '', spec_fuel: '', spec_colors: '', spec_price: '', sort_order: 100, images: [],
  };
  state.creating = true;
  state.dirty = false;
  emptyState.hidden = true;
  editor.hidden = false;
  $('[data-editor-title]').textContent = 'New motorcycle';
  fillEditor(state.current);
  $('[data-danger-zone]').hidden = true;
  renderMedia();
  renderModelList();
  updateDirtyState();
  editor.elements.name.focus();
});

function fillEditor(model) {
  for (const field of ['name','slug','description_en','description_fr','availability','spec_engine','spec_transmission','spec_brakes','spec_fuel','spec_colors','spec_price','sort_order']) {
    if (editor.elements[field]) editor.elements[field].value = model[field] ?? '';
  }
  editor.elements.slug.readOnly = !state.creating;
  editor.elements.published.checked = Boolean(model.published);
}

function collectEditor() {
  const fields = new FormData(editor);
  return {
    slug: String(fields.get('slug') || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    name: String(fields.get('name') || '').trim(),
    description_en: String(fields.get('description_en') || '').trim(),
    description_fr: String(fields.get('description_fr') || '').trim(),
    availability: fields.get('availability') || 'inquire',
    published: editor.elements.published.checked,
    spec_engine: String(fields.get('spec_engine') || '').trim(),
    spec_transmission: String(fields.get('spec_transmission') || '').trim(),
    spec_brakes: String(fields.get('spec_brakes') || '').trim(),
    spec_fuel: String(fields.get('spec_fuel') || '').trim(),
    spec_colors: String(fields.get('spec_colors') || '').trim(),
    spec_price: String(fields.get('spec_price') || '').trim(),
    sort_order: Number(fields.get('sort_order') || 100),
  };
}

editor.addEventListener('input', () => { state.dirty = true; updateDirtyState(); });
editor.addEventListener('change', () => { state.dirty = true; updateDirtyState(); });

function updateDirtyState(message = '') {
  saveButton.disabled = !state.dirty;
  saveState.textContent = message || (state.dirty ? 'Unsaved changes' : 'Saved');
}

saveButton.addEventListener('click', async () => {
  const payload = collectEditor();
  if (!payload.name || !payload.slug) return updateDirtyState('Name and slug are required');
  saveButton.disabled = true;
  saveState.textContent = 'Saving…';
  try {
    const path = state.creating ? '/api/admin/models' : `/api/admin/models/${encodeURIComponent(state.current.slug)}`;
    const method = state.creating ? 'POST' : 'PUT';
    const { model } = await api(path, { method, body: JSON.stringify(payload) });
    state.current = model;
    state.creating = false;
    state.dirty = false;
    $('[data-editor-title]').textContent = model.name;
    await loadModels(model.slug);
    updateDirtyState('Saved');
  } catch (error) {
    state.dirty = true;
    updateDirtyState(error.message);
  }
});

$$('[data-lang-tab]').forEach((button) => button.addEventListener('click', () => {
  state.language = button.dataset.langTab;
  $$('[data-lang-tab]').forEach((item) => item.classList.toggle('active', item === button));
  $$('[data-lang-field]').forEach((field) => { field.hidden = field.dataset.langField !== state.language; });
}));

$('[data-upload]').addEventListener('change', async (event) => {
  if (!state.current?.slug || state.creating) {
    $('[data-upload-status]').textContent = 'Save the motorcycle before uploading photos.';
    event.target.value = '';
    return;
  }
  const files = [...event.target.files];
  event.target.value = '';
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    $('[data-upload-status]').textContent = `Uploading ${index + 1} of ${files.length}: ${file.name}`;
    if (file.size > 6 * 1024 * 1024) {
      $('[data-upload-status]').textContent = `${file.name} is larger than 6 MB.`;
      continue;
    }
    try {
      const dataBase64 = await fileToBase64(file);
      const { model } = await api(`/api/admin/models/${encodeURIComponent(state.current.slug)}/images`, {
        method: 'POST',
        body: JSON.stringify({ type: file.type, dataBase64, alt_en: `${state.current.name} motorcycle`, alt_fr: `Moto ${state.current.name}` }),
      });
      state.current = model;
      renderMedia();
    } catch (error) {
      $('[data-upload-status]').textContent = error.message;
      return;
    }
  }
  $('[data-upload-status]').textContent = files.length ? 'Upload complete.' : '';
  await loadModels(state.current.slug);
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.readAsDataURL(file);
  });
}

function renderMedia() {
  const grid = $('[data-media-grid]');
  grid.replaceChildren();
  const images = state.current?.images || [];
  if (!images.length) {
    const empty = document.createElement('div');
    empty.className = 'media-empty';
    empty.textContent = state.creating ? 'Save this motorcycle first, then upload its photos.' : 'No photos yet. Upload the real dealer photography when ready.';
    grid.append(empty);
    return;
  }
  images.forEach((image, index) => grid.append(mediaCard(image, index, images.length)));
}

function mediaCard(image, index, total) {
  const card = document.createElement('article');
  card.className = `media-card${image.is_primary ? ' primary-photo' : ''}`;
  const thumb = document.createElement('div');
  thumb.className = 'media-thumb';
  const img = document.createElement('img');
  img.src = image.url;
  img.alt = image.alt_en || state.current.name;
  thumb.append(img);
  if (image.is_primary) {
    const badge = document.createElement('span');
    badge.className = 'primary-badge';
    badge.textContent = 'MAIN PHOTO';
    thumb.append(badge);
  }
  const body = document.createElement('div');
  body.className = 'media-body';
  const altEn = makeInput('Alt text · EN', image.alt_en || '');
  const altFr = makeInput('Texte alt · FR', image.alt_fr || '');
  const actions = document.createElement('div');
  actions.className = 'media-actions';
  const saveAlt = makeButton('Save text', () => updateImage(image, { alt_en: altEn.input.value, alt_fr: altFr.input.value, is_primary: Boolean(image.is_primary) }));
  const primary = makeButton('Set main', () => updateImage(image, { alt_en: altEn.input.value, alt_fr: altFr.input.value, is_primary: true }));
  primary.disabled = Boolean(image.is_primary);
  const up = makeButton('↑', () => moveImage(index, -1)); up.disabled = index === 0;
  const down = makeButton('↓', () => moveImage(index, 1)); down.disabled = index === total - 1;
  const remove = makeButton('Delete', () => removeImage(image)); remove.classList.add('remove');
  actions.append(saveAlt, primary, up, down, remove);
  body.append(altEn.label, altFr.label, actions);
  card.append(thumb, body);
  return card;
}

function makeInput(text, value) {
  const label = document.createElement('label');
  label.append(document.createTextNode(text));
  const input = document.createElement('input');
  input.value = value;
  input.maxLength = 180;
  label.append(input);
  return { label, input };
}

function makeButton(text, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.addEventListener('click', handler);
  return button;
}

async function updateImage(image, payload) {
  $('[data-upload-status]').textContent = 'Updating photo…';
  try {
    const { model } = await api(`/api/admin/images/${image.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    state.current = model;
    renderMedia();
    await loadModels(model.slug);
    $('[data-upload-status]').textContent = 'Photo updated.';
  } catch (error) { $('[data-upload-status]').textContent = error.message; }
}

async function moveImage(index, delta) {
  const images = [...state.current.images];
  const target = index + delta;
  if (target < 0 || target >= images.length) return;
  [images[index], images[target]] = [images[target], images[index]];
  $('[data-upload-status]').textContent = 'Saving photo order…';
  try {
    const { model } = await api(`/api/admin/models/${state.current.slug}/images/order`, { method: 'PATCH', body: JSON.stringify({ ids: images.map((image) => image.id) }) });
    state.current = model;
    renderMedia();
    $('[data-upload-status]').textContent = 'Photo order saved.';
  } catch (error) { $('[data-upload-status]').textContent = error.message; }
}

async function removeImage(image) {
  if (!confirm('Delete this photo? This cannot be undone.')) return;
  $('[data-upload-status]').textContent = 'Deleting photo…';
  try {
    const { model } = await api(`/api/admin/images/${image.id}`, { method: 'DELETE', body: '{}' });
    state.current = model;
    renderMedia();
    await loadModels(model.slug);
    $('[data-upload-status]').textContent = 'Photo deleted.';
  } catch (error) { $('[data-upload-status]').textContent = error.message; }
}

$('[data-delete-model]').addEventListener('click', async () => {
  if (!state.current || state.current.slug === 'eagle' || state.current.slug === 'super') return;
  if (!confirm(`Delete ${state.current.name} and every uploaded photo?`)) return;
  try {
    await api(`/api/admin/models/${state.current.slug}`, { method: 'DELETE', body: '{}' });
    state.current = null;
    editor.hidden = true;
    emptyState.hidden = false;
    $('[data-editor-title]').textContent = 'Select a motorcycle';
    await loadModels();
  } catch (error) { alert(error.message); }
});

boot();
