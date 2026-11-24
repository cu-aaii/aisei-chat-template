// Colour mode and theme before first paint, so a dark-mode visitor never sees a light flash. Same keys and
// values as ThemeService (client/app/shared/services/theme/theme.service.ts).
//
// A file, not an inline <script>: a Content-Security-Policy without 'unsafe-inline' in script-src (payflow's, for
// one) blocks inline scripts, and then the stored mode would only apply once Angular boots. Loaded synchronously
// from <head>, so it still runs before first paint. pre-paint.test.ts keeps its theme list equal to ThemeService's.
try {
  var m = localStorage.getItem('cu-mode'), t = localStorage.getItem('cu-theme'), r = document.documentElement;
  if (m === 'light' || m === 'dark') r.setAttribute('data-mode', m);
  if (/^(dark-header|red-header|light-bar|dark-bar|blue-bar)$/.test(t || '')) r.setAttribute('data-theme', t);
} catch (e) {}
