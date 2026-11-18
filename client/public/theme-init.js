// Runs before the app paints so the page never flashes the wrong theme. Mirrors src/theme/theme.js.
(function () {
  var preference = 'system';
  try {
    var saved = window.localStorage.getItem('devtrack-theme');
    if (saved === 'light' || saved === 'dark') preference = saved;
  } catch {
    preference = 'system';
  }
  var prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  var theme = preference === 'system' ? (prefersLight ? 'light' : 'dark') : preference;
  document.documentElement.setAttribute('data-theme', theme);
})();
