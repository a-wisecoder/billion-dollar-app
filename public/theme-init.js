(function () {
  try {
    var mode = localStorage.getItem('vaultflow_theme_v1') || 'system';
    var dark =
      mode === 'dark' ||
      (mode === 'system' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.style.colorScheme = 'light';
    }
  } catch (e) {
    // Ignore storage access restrictions
  }
})();
