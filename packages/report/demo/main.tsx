import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ImpressionModele, ModelesPage, configurerReport, enregistrerFonction, installerExemples, kindDe } from '../src';
import '../src/ui/styles/report.css'; // en projet tiers : import '@softly/report/style.css'

// 1. L'hôte déclare ses types de documents, ses modèles livrés et ses fonctions métier.
installerExemples();
enregistrerFonction('TVA19', (a) => Number(a[0]) * 0.19, { categorie: 'Métier', signature: 'TVA19(Facture.total_ht)', description: 'TVA à 19 %' });

// 2. (Optionnel) stockage, impression, notifications fournis par l'hôte
configurerReport({ espaceNoms: 'demo.etats' });

function Demo() {
  const [vue, setVue] = useState<'aucune' | 'impression' | 'modeles'>('aucune');
  const data = (() => { const d = JSON.parse(JSON.stringify(kindDe('facture').sample)); d.Lignes = Array.from({ length: 60 }, (_, i) => ({ ...d.Lignes[i % 3], code: `A-${String(i + 1).padStart(3, '0')}` })); return d; })();
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>@softly/report — démo (sans Tailwind)</h1>
      <p>Composants consommés comme dans un projet tiers : aucune feuille de style de l’application, uniquement <code>report.css</code>.</p>
      <button id="b-impr" onClick={() => setVue('impression')}>Imprimer une facture (60 lignes)</button>{' '}
      <button id="b-mod" onClick={() => setVue('modeles')}>Bibliothèque de modèles</button>
      {vue === 'impression' && <ImpressionModele modeleRef="integre:exemple-facture-a4" data={data} titre="Facture 2026-0042" onClose={() => setVue('aucune')} />}
      {vue === 'modeles' && <div style={{ position: 'fixed', inset: 0, overflow: 'auto', background: '#fff', zIndex: 10 }}><button onClick={() => setVue('aucune')} style={{ position: 'fixed', right: 8, top: 8, zIndex: 20 }}>Fermer la bibliothèque</button><ModelesPage /></div>}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><Demo /></StrictMode>);
