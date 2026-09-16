function applyThemeState(state) {
  const theme = state?.themes?.find((candidate) => candidate.id === state.activeThemeId);
  document.documentElement.dataset.theme = theme?.id || 'morrowind';

  const existingLink = document.getElementById('gmw-theme-overrides');
  if (!theme?.cssUrl) {
    existingLink?.remove();
    return;
  }

  const link = existingLink || document.createElement('link');
  link.id = 'gmw-theme-overrides';
  link.rel = 'stylesheet';
  // Cache-bust so Reload Themes actually re-fetches an edited theme: Chromium
  // caches file:// stylesheets by URL, and the cssUrl string is otherwise
  // identical across reloads, so edits to an already-loaded theme never apply.
  const separator = theme.cssUrl.includes('?') ? '&' : '?';
  link.href = `${theme.cssUrl}${separator}v=${Date.now()}`;
  if (!existingLink) document.head.appendChild(link);
}

export function initThemeBridge() {
  if (!window.electron?.getThemeState) return;

  window.electron.getThemeState().then(applyThemeState).catch(() => {});
  window.electron.onThemeStateChanged?.(applyThemeState);
}
