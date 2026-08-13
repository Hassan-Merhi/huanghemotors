(() => {
  const slug = new URLSearchParams(location.search).get('model');
  const names = {
    'site-home-hero': 'Website Photo · Homepage Hero',
    'site-heritage-main': 'Website Photo · Heritage Large',
    'site-heritage-side': 'Website Photo · Heritage Side',
    'site-dealership-showroom': 'Website Photo · Dealership Showroom',
  };
  const targetName = names[slug] || '';
  const internalNames = new Set(Object.values(names));
  const list = document.querySelector('[data-model-list]');
  if (!list) return;

  let targetOpened = false;

  function processList() {
    const buttons = [...list.querySelectorAll('.model-item')];
    const target = targetName ? buttons.find((button) => button.textContent.includes(targetName)) : null;

    if (target && !targetOpened) {
      targetOpened = true;
      target.click();
      const danger = document.querySelector('[data-danger-zone]');
      if (danger) danger.hidden = true;
    }

    for (const button of buttons) {
      if ([...internalNames].some((name) => button.textContent.includes(name))) {
        button.hidden = true;
        button.dataset.internalModel = 'true';
        button.setAttribute('aria-hidden', 'true');
      }
    }
  }

  processList();
  new MutationObserver(processList).observe(list, { childList: true });
})();
