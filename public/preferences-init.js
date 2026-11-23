try {
  const preferences = JSON.parse(localStorage.getItem('playtest-match-preferences-v1'));
  document.documentElement.dataset.theme = preferences?.theme === 'dark' ? 'dark' : 'light';
  document.documentElement.lang = preferences?.language === 'en' ? 'en' : 'ko';
} catch {
  // The app defaults to the light theme and Korean if local storage is unavailable.
}
