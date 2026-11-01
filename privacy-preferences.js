const button = document.querySelector('#analytics-optout');
const status = document.querySelector('#analytics-status');
const key = 'portfolio-analytics-optout';
const browserOptOut = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
function render() {
  try {
    const disabled = localStorage.getItem(key) === '1';
    button.textContent = disabled ? 'Allow analytics on this browser' : 'Turn off analytics on this browser';
    button.setAttribute('aria-pressed', String(disabled));
    button.disabled = browserOptOut;
    status.textContent = browserOptOut ? 'Analytics are off because of your browser’s privacy preference.' : disabled ? 'Analytics are off on this browser.' : 'Analytics are currently allowed on this browser.';
  } catch {
    button.disabled = true;
    status.textContent = 'Analytics are off because browser storage is unavailable.';
  }
}
button.addEventListener('click', () => {
  try { localStorage.setItem(key, localStorage.getItem(key) === '1' ? '0' : '1'); } catch {}
  render();
});
render();
