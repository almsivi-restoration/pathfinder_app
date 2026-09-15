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
  link.href = theme.cssUrl;
  if (!existingLink) document.head.appendChild(link);
}

export function initThemeBridge() {
  if (!window.electron?.getThemeState) return;

  window.electron.getThemeState().then(applyThemeState).catch(() => {});
  window.electron.onThemeStateChanged?.(applyThemeState);
}
