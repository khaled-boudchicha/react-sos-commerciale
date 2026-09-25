// Configuration Paged.js de l'aperçu d'impression (iframe srcdoc).
// Fichier séparé (et non <script> inline) pour rester compatible avec la CSP `script-src 'self'`.

// Aperçu À L'ÉCRAN ajusté à la largeur de la fenêtre (pages paysage plus larges que
// l'aperçu : centrées, elles débordaient des deux côtés et le bord gauche devenait
// inaccessible). Le zoom est posé en style direct — Paged.js réécrit les feuilles
// de style et ne conserve pas une règle `zoom` — et retiré le temps de l'impression.
var echelle = 1;
function conteneur() { return document.querySelector('.pagedjs_pages'); }
function ajusterALaLargeur() {
  var pages = conteneur();
  var page = document.querySelector('.pagedjs_page');
  if (!pages || !page) return;
  pages.style.zoom = '1';
  echelle = Math.min(1, window.innerWidth / (page.getBoundingClientRect().width + 32));
  pages.style.zoom = String(echelle);
}
window.addEventListener('resize', ajusterALaLargeur);
window.addEventListener('beforeprint', function () { var p = conteneur(); if (p) p.style.zoom = '1'; });
window.addEventListener('afterprint', function () { var p = conteneur(); if (p) p.style.zoom = String(echelle); });

window.PagedConfig = {
  auto: true,
  after: function (flow) {
    ajusterALaLargeur();
    parent.postMessage({ type: 'paged:rendered', pages: flow.total }, '*');
  },
};
window.addEventListener('error', function (e) {
  parent.postMessage({ type: 'paged:error', message: e.message }, '*');
});
