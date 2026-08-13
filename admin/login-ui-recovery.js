(() => {
  const status = document.querySelector('[data-login-status]');
  if (!status) return;
  const observer = new MutationObserver(() => {
    if (status.textContent.includes("Cannot read properties of null") && status.textContent.includes("reset")) {
      observer.disconnect();
      location.reload();
    }
  });
  observer.observe(status, { childList: true, characterData: true, subtree: true });
})();
