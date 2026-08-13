(() => {
  const slug = new URLSearchParams(location.search).get('model');
  const names = {
    'site-home-hero': 'Website Photo · Homepage Hero',
    'site-heritage-main': 'Website Photo · Heritage Large',
    'site-heritage-side': 'Website Photo · Heritage Side',
    'site-dealership-showroom': 'Website Photo · Dealership Showroom',
  };
  const name = names[slug];
  const internalNames = new Set(Object.values(names));
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    const buttons = [...document.querySelectorAll('.model-item')];
    if (!buttons.length && tries <= 50) return;
    const target = name ? buttons.find((button) => button.textContent.includes(name)) : null;
    if (target) {
      target.click();
      const danger = document.querySelector('[data-danger-zone]');
      if (danger) danger.hidden = true;
    }
    for (const button of buttons) {
      if ([...internalNames].some((internalName) => button.textContent.includes(internalName))) button.hidden = true;
    }
    if (buttons.length || tries > 50) clearInterval(timer);
  }, 100);
})();
