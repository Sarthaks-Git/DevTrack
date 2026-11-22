// Runs before the app paints so the page never flashes the wrong theme. Mirrors src/theme/theme.js.
(function () {
  var preference = 'system';
  try {
    var saved = window.localStorage.getItem('devtrack-theme');
    if (saved === 'light' || saved === 'dark') preference = saved;
    // Weather mode: the last answer if it is under 3 hours old, else the device setting.
    if (saved === 'weather') {
      var weather = JSON.parse(window.localStorage.getItem('devtrack-weather'));
      if (weather && (weather.theme === 'light' || weather.theme === 'dark') && Date.now() - weather.at < 3 * 60 * 60 * 1000) preference = weather.theme;
    }
  } catch {
    preference = 'system';
  }
  var prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  var theme = preference === 'system' ? (prefersLight ? 'light' : 'dark') : preference;
  document.documentElement.setAttribute('data-theme', theme);
})();
