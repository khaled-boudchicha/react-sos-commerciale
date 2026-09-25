// Configuration Paged.js de l'aperçu d'impression (iframe srcdoc).
// Fichier séparé (et non <script> inline) pour rester compatible avec la CSP `script-src 'self'`.
window.PagedConfig = {
  auto: true,
  after: function (flow) { parent.postMessage({ type: 'paged:rendered', pages: flow.total }, '*'); },
};
window.addEventListener('error', function (e) {
  parent.postMessage({ type: 'paged:error', message: e.message }, '*');
});
