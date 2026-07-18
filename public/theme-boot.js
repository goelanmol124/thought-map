/* Blocking theme boot — prevents flash before React hydrates.
 * Same-origin external script so script-src 'self' CSP remains feasible.
 * Supports current `theme` and legacy `themePreference` keys.
 */
(function () {
  try {
    var theme = localStorage.getItem('theme');
    var legacy = localStorage.getItem('themePreference');
    var isDark;

    if (theme === 'dark' || theme === 'light') {
      isDark = theme === 'dark';
    } else if (legacy !== null) {
      isDark = JSON.parse(legacy) === true;
    } else {
      // Warm paper default for the inquiry workspace
      isDark = false;
    }

    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  } catch (e) {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
  }
})();
