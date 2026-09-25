import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@apollo/client';
import { ARTICLES } from '../api/queries';
import { Article } from '../api/types';
import Grille from '../components/grille/Grille';
import { ColonneGrille, ModeEdition, ModeSelection } from '../components/grille/types';
import { PageHeader, StatusPill } from '../components/ui/atoms';
import { fmtMoney, fmtQte } from '../lib/format';
import { useToast } from '../components/ui/Toast';

type LigneDemo = Article & { valeur_stock: number };

/**
 * Démonstration de la grille (components/grille) sur les articles du dossier :
 * toutes les fonctionnalités activées, réglages en direct. Les modifications sont
 * appliquées à une copie locale (rien n'est écrit en base).
 */
export default function DemoGrille() {
  const toast = useToast();
  const { data, loading, error } = useQuery(ARTICLES, { variables: { limit: 5000, offset: 0 } });
  const [lignes, setLignes] = useState<LigneDemo[]>([]);
  useEffect(() => {
    const src: Article[] = data?.articles?.data ?? [];
    setLignes(src.map((a) => ({ ...a, valeur_stock: (Number(a.qte_reale) || 0) * (Number(a.pmp) || 0) })));
  }, [data]);

  const [modeEdition, setModeEdition] = useState<ModeEdition>('ligne');
  const [selection, setSelection] = useState<ModeSelection>('multiple');
  const [virtuel, setVirtuel] = useState(false);
  const [rtl, setRtl] = useState(false);
  const [bordures, setBordures] = useState(false);
  const [selectionnees, setSelectionnees] = useState(0);

  const familles = useMemo(() => [...new Set(lignes.map((l) => l.famille).filter(Boolean))].sort()
    .map((f) => ({ valeur: f, libelle: String(f) })), [lignes]);

  const colonnes: ColonneGrille<LigneDemo>[] = useMemo(() => [
    { champ: 'code', titre: 'Code', largeur: 90, figee: 'gauche', bande: 'Identification', validation: [{ type: 'requis' }], triInitial: 'asc' },
    { champ: 'designation', titre: 'Désignation', largeur: 260, bande: 'Identification', validation: [{ type: 'requis' }],
      rendu: (l) => <b>{l.designation}</b> },
    { champ: 'famille', titre: 'Famille', largeur: 150, bande: 'Identification', choix: familles },
    { champ: 'pmp', titre: 'PMP', type: 'money', bande: 'Prix', editable: false },
    { champ: 'prix_vente_ht', titre: 'P.V. HT', type: 'money', bande: 'Prix', validation: [{ type: 'min', valeur: 0, message: 'Prix négatif.' }] },
    { champ: 'marge', titre: 'Marge', type: 'money', bande: 'Prix', editable: false,
      rendu: (l, v) => <span style={{ color: Number(v) < 0 ? 'var(--danger)' : undefined }}>{fmtMoney(v)}</span> },
    { champ: 'tva', titre: 'TVA %', type: 'number', largeur: 70, bande: 'Prix' },
    { champ: 'qte_reale', titre: 'Stock', type: 'number', largeur: 90, bande: 'Stock', editable: false,
      rendu: (l, v) => <span style={{ color: Number(v) <= 0 ? 'var(--danger)' : Number(v) <= Number(l.stock_min ?? 0) ? 'var(--warning)' : undefined }}>{fmtQte(v)}</span> },
    { champ: 'stock_min', titre: 'Min', type: 'number', largeur: 70, bande: 'Stock' },
    { champ: 'valeur_stock', titre: 'Valeur', type: 'money', bande: 'Stock', editable: false, valeur: (l) => (Number(l.qte_reale) || 0) * (Number(l.pmp) || 0) },
    { champ: 'actif', titre: 'Actif', type: 'boolean', largeur: 70, visible: false },
    { champ: 'code_bare', titre: 'Code-barres', largeur: 140, visible: false },
    { champ: 'unite_mesure', titre: 'Unité', largeur: 80, visible: false },
  ], [familles]);

  const maj = (id: number, changements: Partial<LigneDemo>) =>
    setLignes((ls) => ls.map((l) => (l.id === id ? { ...l, ...changements } : l)));

  return (
    <div className="flex flex-col gap-3" style={{ height: 'calc(100vh - 40px)' }}>
      <PageHeader title="Grille de données — démonstration">
        <span className="text-[11.5px] text-ink-muted">Modifications locales, rien n’est enregistré en base.</span>
      </PageHeader>
      <div className="flex items-center gap-4 flex-wrap text-[12px] text-ink-label bg-surface border border-line-soft rounded-md px-3 py-2">
        <label>Édition{' '}
          <select value={modeEdition} onChange={(e) => setModeEdition(e.target.value as ModeEdition)} className="border border-line rounded-sm px-1.5 py-0.5 bg-surface text-ink">
            <option value="ligne">Ligne</option><option value="cellule">Cellule</option><option value="lot">Lot (batch)</option><option value="formulaire">Formulaire</option>
          </select>
        </label>
        <label>Sélection{' '}
          <select value={selection} onChange={(e) => setSelection(e.target.value as ModeSelection)} className="border border-line rounded-sm px-1.5 py-0.5 bg-surface text-ink">
            <option value="aucune">Aucune</option><option value="simple">Simple</option><option value="multiple">Multiple</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={virtuel} onChange={(e) => setVirtuel(e.target.checked)} />Défilement virtuel</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={bordures} onChange={(e) => setBordures(e.target.checked)} />Bordures</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={rtl} onChange={(e) => setRtl(e.target.checked)} />Droite à gauche</label>
        {selection === 'multiple' && <StatusPill tone="mut">{selectionnees} sélectionnée(s)</StatusPill>}
      </div>
      <div className="flex-1 min-h-0">
        <Grille<LigneDemo>
          key={`${modeEdition}-${virtuel}`}
          titre="Articles"
          donnees={lignes}
          cle={(l) => l.id}
          colonnes={colonnes}
          hauteur="100%"
          chargement={loading}
          erreur={error?.message}
          cleEtat="demo-articles"
          selection={selection}
          surSelection={(cles) => setSelectionnees(cles.length)}
          defilementVirtuel={virtuel}
          bordures={bordures}
          rtl={rtl}
          pagination={{ tailles: [20, 50, 100, 500], taille: 20 }}
          export={{ nom: 'articles', excel: true, csv: true, pdf: true }}
          edition={{
            mode: modeEdition,
            positionNouvelle: 'debut',
            nouvelleLigne: () => ({ tva: 19, actif: true }),
            surAjout: (l) => {
              const id = Math.max(0, ...lignes.map((x) => x.id)) + 1;
              setLignes((ls) => [{ ...l, id, valeur_stock: 0 } as LigneDemo, ...ls]);
              toast.success(`Ligne ${l.code} ajoutée (démo).`);
            },
            surModification: (id, changements) => { maj(Number(id), changements); toast.success('Ligne modifiée (démo).'); },
            surSuppression: (id) => { setLignes((ls) => ls.filter((l) => l.id !== id)); toast.success('Ligne supprimée (démo).'); },
          }}
          resumes={[
            { colonne: 'code', type: 'count', libelle: 'Articles' },
            { colonne: 'valeur_stock', type: 'sum', libelle: 'Σ' },
            { colonne: 'prix_vente_ht', type: 'avg', libelle: 'Moy.' },
            { colonne: 'qte_reale', type: 'sum', libelle: 'Σ' },
          ]}
          resumesGroupe={[
            { colonne: 'valeur_stock', type: 'sum', libelle: 'Valeur' },
            { colonne: 'marge', type: 'avg', libelle: 'Marge moy.' },
          ]}
          detail={(l) => (
            <div className="grid grid-cols-4 gap-3 text-[12px]">
              {[['Prix achat HT', fmtMoney(l.prix_achat_ht)], ['Prix TTC', fmtMoney(l.prix_vente_ttc)], ['Marge %', `${fmtMoney(l.margep, 1)} %`],
                ['Tarif 2', fmtMoney(l.prix_vente_ht1)], ['Tarif 3', fmtMoney(l.prix_vente_ht2)], ['Tarif 4', fmtMoney(l.prix_vente_ht3)],
                ['Dépôt', l.depot ?? '—'], ['Code-barres', l.code_bare ?? '—']].map(([k, v]) => (
                <div key={k}><div className="text-[10px] uppercase font-bold text-ink-muted">{k}</div><div className="money">{v}</div></div>
              ))}
            </div>
          )}
        />
      </div>
    </div>
  );
}
