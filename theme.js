// Load independently of the game module so appearance never depends on puzzle startup.
(function () {
  const root = document.documentElement;
  let saved;
  try { saved = localStorage.getItem('inordle-theme'); } catch {}
  const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = saved === 'dark' || saved === 'light' ? saved : (systemDark ? 'dark' : 'light');

  function sync() {
    const dark = root.dataset.theme === 'dark';
    const button = document.getElementById('theme-toggle');
    if (button) {
      button.textContent = dark ? '☀' : '☾';
      button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      button.setAttribute('aria-pressed', String(dark));
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#131121' : '#c3d8cf';
  }
  function initialize() {
    const button = document.getElementById('theme-toggle');
    if (button) button.addEventListener('click', function () {
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('inordle-theme', root.dataset.theme); } catch {}
      sync();
    });
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
}());
