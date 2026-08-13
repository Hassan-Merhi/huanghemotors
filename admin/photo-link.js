(() => {
  const slug = new URLSearchParams(location.search).get('model');
  const names = {
    'site-home-hero': 'Website Photo · Homepage Hero',
    'site-heritage-main': 'Website Photo · Heritage Large',
    'site-heritage-side': 'Website Photo · Heritage Side',
    'site-dealership-showroom': 'Website Photo · Dealership Showroom',
  };
  const name = names[slug];
  if (!name) return;
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    const target = [...document.querySelectorAll('.model-item')].find((button) => button.textContent.includes(name));
    if (target) {
      target.click();
      const danger = document.querySelector('[data-danger-zone]');
      if (danger) danger.hidden = true;
      clearInterval(timer);
    } else if (tries > 50) {
      clearInterval(timer);
    }
  }, 100);
})();
