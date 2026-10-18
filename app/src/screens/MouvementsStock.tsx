import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApolloClient, useMutation, useQuery } from '@apollo/client';
import {
  BONS_ENTREE, BONS_SORTIE, TRANSFERTS, BON_STOCK, DELETE_BON_ENTREE, DELETE_BON_SORTIE, COORDONNEES_SOCIETE,
} from '../api/queries';
import { fmtDate, fmtMoney, fmtQte, isoFirstOfMonth, isoToday } from '../lib/format';
import { useDebouncedValue } from '../lib/useDebounce';
import { useDroits, D } from '../lib/droits';
import DataGrid, { Column, DataGridDistant, totalDistant } from '../components/ui/DataGrid';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { PageHeader, PeriodPicker, SearchInput, Tabs } from '../components/ui/atoms';
import { useToast } from '../components/ui/Toast';
import BonStockModal, { SensBon } from '../components/BonStockModal';
import TransfertStockModal from '../components/TransfertStockModal';
import ImprimerDocument from '../impression/ImprimerDocument';
import type { DemandeImpression } from '../impression/demandes';
import { demandeBonStock } from '../impression/demandes';
import type { BonStock, BonStockLigne } from '../print/templates';

type Transfert = {
  code: string; date: string; depot_source?: string | null; depot_destination?: string | null;
  motif?: string | null; observation?: string | null; valeur?: number | null;
  sortie_id?: number | null; entree_id?: number | null; nb_lignes?: number | null;
};

const ONGLETS = [
  { code: 'entree', label: "Bons d'entrée" },
  { code: 'sortie', label: 'Bons de sortie' },
  { code: 'transferts', label: 'Transferts' },
] as const;
type Onglet = (typeof ONGLETS)[number]['code'];

/** Bon ouvert en détail : sens + id (un transfert s'ouvre sur son bon de sortie). */
type Ouvert = { sens: SensBon; id: number; transfert?: Transfert };

/**
 * Mouvements de stock hors pièces commerciales : bons d'entrée, bons de sortie
 * et transferts entre dépôts. Consultation par période, détail, impression,
 * création et suppression (selon droits).
 */
export default function MouvementsStock() {
  const [onglet, setOnglet] = useState<Onglet>('entree');
  const [debut, setDebut] = useState(isoFirstOfMonth());
  const [fin, setFin] = useState(isoToday());
  const [search, setSearch] = useState('');
  const recherche = useDebouncedValue(search, 300);

  const [creation, setCreation] = useState<SensBon | 'transfert' | null>(null);
  const [ouvert, setOuvert] = useState<Ouvert | null>(null);
  const [suppression, setSuppression] = useState<Ouvert & { libelle: string } | null>(null);
  const toast = useToast();

  const { peut } = useDroits();
  const droitEntree = peut('stock', D.stock.bonEntree);
  const droitSortie = peut('stock', D.stock.bonSortie);
  const droitTransfert = droitEntree && droitSortie;

  const estBon = onglet !== 'transferts';
  const client = useApolloClient();
  // Incrémenté après création / suppression : recharge la liste affichée
  const [version, setVersion] = useState(0);
  const dateDebut = debut || undefined;
  const dateFin = fin || undefined;
  const rechercheBons = recherche.trim() || undefined;

  // Tri, filtres, recherche, pagination et groupes faits par le serveur
  const distantBons = useMemo<DataGridDistant<BonStock>>(() => ({
    cle: JSON.stringify([onglet, dateDebut, dateFin, rechercheBons, version]),
    totaux: [{ field: 'valeur_total', type: 'sum' }],
    charger: async (grille) => {
      const entree = onglet === 'entree';
      const { data } = await client.query({
        query: entree ? BONS_ENTREE : BONS_SORTIE, fetchPolicy: 'network-only',
        variables: { date_debut: dateDebut, date_fin: dateFin, search: rechercheBons, grille },
      });
      return (entree ? data.bonsEntree : data.bonsSortie) as { data: BonStock[]; total: number; resumes?: Record<string, number | null> };
    },
  }), [client, onglet, dateDebut, dateFin, rechercheBons, version]);

  // Avec `grille`, la requête renvoie { data, total, resumes } (et non plus un tableau brut)
  const distantTransferts = useMemo<DataGridDistant<Transfert>>(() => ({
    cle: JSON.stringify([dateDebut, dateFin, version]),
    totaux: [{ field: 'valeur', type: 'sum' }],
    charger: async (grille) => {
      const { data } = await client.query({
        query: TRANSFERTS, fetchPolicy: 'network-only',
        variables: { date_debut: dateDebut, date_fin: dateFin, grille },
      });
      return data.transferts as { data: Transfert[]; total: number; resumes?: Record<string, number | null> };
    },
  }), [client, dateDebut, dateFin, version]);

  const [delEntree, { loading: l1 }] = useMutation(DELETE_BON_ENTREE);
  const [delSortie, { loading: l2 }] = useMutation(DELETE_BON_SORTIE);

  function rafraichir() {
    // Recharge la liste affichée ; les autres onglets sont relus à leur affichage
    // (network-only) — utile après un transfert qui touche les deux.
    setVersion((v) => v + 1);
  }

  async function confirmerSuppression() {
    if (!suppression) return;
    try {
      if (suppression.sens === 'entree') await delEntree({ variables: { id: suppression.id } });
      else await delSortie({ variables: { id: suppression.id } });
      toast.success(`${suppression.libelle} supprimé — stock recalculé.`);
      setSuppression(null);
      setOuvert(null);
      rafraichir();
    } catch (e: any) {
      setSuppression(null);
      toast.error(`Suppression impossible : ${e.message ?? 'erreur'}`);
    }
  }

  const peutSupprimer = (sens: SensBon) => (sens === 'entree' ? droitEntree : droitSortie);
  const sensCourant: SensBon = onglet === 'sortie' ? 'sortie' : 'entree';

  const colsBons: Column<BonStock>[] = [
    { key: 'numero', header: 'Numéro', width: '130px', field: 'numero', render: (b) => <span className="money font-semibold">{b.numero || `#${b.id}`}</span> },
    { key: 'date', header: 'Date', width: '95px', field: 'date', type: 'date', render: (b) => fmtDate(b.date) },
    { key: 'motif', header: 'Motif', field: 'motif', render: (b) => <span>{b.motif || <span className="text-ink-muted">—</span>}</span> },
    { key: 'depot', header: 'Dépôt', width: '140px', field: 'depot', render: (b) => <span className="text-ink-muted">{b.depot || '—'}</span> },
    { key: 'nb', header: 'Lignes', align: 'right', width: '70px', render: (b) => <span className="money">{b.lignes?.length ?? '—'}</span> },
    { key: 'valeur', header: 'Valeur', align: 'right', width: '130px', field: 'valeur_total', render: (b) => <span className="money font-semibold">{fmtMoney(b.valeur_total ?? b.total_ht)}</span> },
    ...(peutSupprimer(sensCourant) ? [{ key: 'actions', header: '', align: 'right' as const, width: '50px', render: (b: BonStock) => (
      <button onClick={(e) => { e.stopPropagation(); setSuppression({ sens: sensCourant, id: b.id, libelle: `${sensCourant === 'entree' ? "Bon d'entrée" : 'Bon de sortie'} ${b.numero || b.id}` }); }}
              title="Supprimer" className="px-1.5 py-0.5 rounded-sm border border-line text-[11px]" style={{ color: 'var(--danger)' }}>✕</button>
    ) }] : []),
  ];

  const colsTransferts: Column<Transfert>[] = [
    { key: 'code', header: 'Code', width: '130px', field: 'code', render: (t) => <span className="money font-semibold">{t.code}</span> },
    { key: 'date', header: 'Date', width: '95px', field: 'date', type: 'date', render: (t) => fmtDate(t.date) },
    { key: 'trajet', header: 'Source → destination', render: (t) => (
      <span><b>{t.depot_source || '—'}</b> <span className="text-ink-muted">→</span> <b>{t.depot_destination || '—'}</b></span>
    ) },
    { key: 'obs', header: 'Observation', field: 'observation', render: (t) => <span className="text-ink-muted">{t.observation || t.motif || '—'}</span> },
    { key: 'nb', header: 'Lignes', align: 'right', width: '70px', field: 'nb_lignes', type: 'number', render: (t) => <span className="money">{t.nb_lignes ?? '—'}</span> },
    { key: 'valeur', header: 'Valeur', align: 'right', width: '130px', field: 'valeur', render: (t) => <span className="money font-semibold">{fmtMoney(t.valeur)}</span> },
    ...(droitTransfert ? [{ key: 'actions', header: '', align: 'right' as const, width: '50px', render: (t: Transfert) => {
      // Supprimer une moitié du transfert supprime les deux bons côté serveur.
      const cible: Ouvert | null = t.sortie_id ? { sens: 'sortie', id: t.sortie_id } : t.entree_id ? { sens: 'entree', id: t.entree_id } : null;
      return cible ? (
        <button onClick={(e) => { e.stopPropagation(); setSuppression({ ...cible, transfert: t, libelle: `Transfert ${t.code}` }); }}
                title="Supprimer le transfert" className="px-1.5 py-0.5 rounded-sm border border-line text-[11px]" style={{ color: 'var(--danger)' }}>✕</button>
      ) : null;
    } }] : []),
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title="Mouvements de stock">
        <Link to="/stock" className="text-[12px] font-bold text-brand-700">← Stock</Link>
        {droitTransfert && (
          <button onClick={() => setCreation('transfert')}
                  className="rounded-md px-3 py-2 font-bold text-[12px] border border-line text-ink-label">
            ⇄ Nouveau transfert
          </button>
        )}
        {droitSortie && (
          <button onClick={() => setCreation('sortie')}
                  className="rounded-md px-3 py-2 font-bold text-[12px] border border-line" style={{ color: 'var(--danger)' }}>
            − Nouveau bon de sortie
          </button>
        )}
        {droitEntree && (
          <button onClick={() => setCreation('entree')}
                  className="rounded-md px-4 py-2 font-bold text-[12px] text-white bg-brand-700">
            ＋ Nouveau bon d'entrée
          </button>
        )}
      </PageHeader>

      <div className="flex items-center gap-3 flex-wrap">
        <Tabs value={onglet} onChange={setOnglet} options={ONGLETS} />
        <PeriodPicker debut={debut} fin={fin} onChange={(d, f) => { setDebut(d); setFin(f); }} />
        {estBon && <SearchInput value={search} onChange={setSearch} placeholder="N°, motif, observation…" />}
      </div>

      {estBon ? (
        // Une grille par sens (disposition mémorisée séparément)
        <DataGrid key={onglet} columns={colsBons} rowKey={(b) => b.id}
                  distant={distantBons} cleEtat={`mouvements-stock-${onglet}`}
                  onRowClick={(b) => setOuvert({ sens: sensCourant, id: b.id })}
                  emptyMessage="Aucun bon sur la période."
                  footer={(r) => ({ _label: `${r?.total ?? 0} bon(s)`,
                                    valeur: <span className="money">{fmtMoney(totalDistant(r, 'valeur_total'))}</span> })} />
      ) : (
        <DataGrid columns={colsTransferts} rowKey={(t) => t.code}
                  distant={distantTransferts} cleEtat="mouvements-stock-transferts"
                  onRowClick={(t) => {
                    if (t.sortie_id) setOuvert({ sens: 'sortie', id: t.sortie_id, transfert: t });
                    else if (t.entree_id) setOuvert({ sens: 'entree', id: t.entree_id, transfert: t });
                  }}
                  emptyMessage="Aucun transfert sur la période."
                  footer={(r) => ({ _label: `${r?.total ?? 0} transfert(s)`,
                                    valeur: <span className="money">{fmtMoney(totalDistant(r, 'valeur'))}</span> })} />
      )}

      {(creation === 'entree' || creation === 'sortie') && (
        <BonStockModal sens={creation} onClose={() => setCreation(null)} onDone={rafraichir} />
      )}
      {creation === 'transfert' && (
        <TransfertStockModal onClose={() => setCreation(null)} onDone={rafraichir} />
      )}

      {ouvert && (
        <BonDetailModal ouvert={ouvert} onClose={() => setOuvert(null)}
                        onSupprimer={(ouvert.transfert ? droitTransfert : peutSupprimer(ouvert.sens))
                          ? (libelle) => setSuppression({ ...ouvert, libelle }) : undefined} />
      )}

      {suppression && (
        <ConfirmDialog title={`Supprimer ${suppression.transfert ? 'ce transfert' : 'ce bon'} ?`}
          message={suppression.transfert
            ? <><b>{suppression.libelle}</b> : le bon de sortie du dépôt « {suppression.transfert.depot_source} » et le bon d'entrée du dépôt « {suppression.transfert.depot_destination} » seront supprimés et le stock recalculé.</>
            : <><b>{suppression.libelle}</b> sera supprimé et le stock des articles recalculé. S'il fait partie d'un transfert, le bon associé sera aussi supprimé.</>}
          confirmLabel="Supprimer" danger loading={l1 || l2}
          onConfirm={() => void confirmerSuppression()} onCancel={() => setSuppression(null)} />
      )}
    </div>
  );
}

/** Détail d'un bon (lignes) avec impression ; pour un transfert, rappel du trajet. */
const COLONNES_LIGNES_BON: Column<BonStockLigne>[] = [
  { key: 'code_article', header: 'Code', width: '110px', render: (l) => <span className="money">{l.code_article}</span> },
  { key: 'designation', header: 'Désignation', render: (l) => <b>{l.designation}</b> },
  { key: 'qte', header: 'Qté', align: 'right', width: '80px', render: (l) => <span className="money">{fmtQte(l.qte)}</span> },
  { key: 'unite', header: 'Unité', width: '80px', render: (l) => <span className="text-ink-muted">{l.unite ?? ''}</span> },
  { key: 'prix_unitaire', header: 'P.U.', align: 'right', width: '110px', render: (l) => <span className="money">{fmtMoney(l.prix_unitaire)}</span> },
  { key: 'total', header: 'Total', align: 'right', width: '120px', render: (l) => <span className="money font-semibold">{fmtMoney(l.total)}</span> },
];
const EXPORT_LIGNES_BON = [
  { header: 'Code', value: (l: BonStockLigne) => l.code_article ?? '' },
  { header: 'Désignation', value: (l: BonStockLigne) => l.designation ?? '' },
  { header: 'Qté', value: (l: BonStockLigne) => Number(l.qte ?? 0), numeric: true },
  { header: 'Unité', value: (l: BonStockLigne) => l.unite ?? '' },
  { header: 'P.U.', value: (l: BonStockLigne) => Number(l.prix_unitaire ?? 0), numeric: true },
  { header: 'Total', value: (l: BonStockLigne) => Number(l.total ?? 0), numeric: true },
];

function BonDetailModal({ ouvert, onClose, onSupprimer }: {
  ouvert: Ouvert; onClose: () => void; onSupprimer?: (libelle: string) => void;
}) {
  const { data, loading, error } = useQuery(BON_STOCK, { variables: { sens: ouvert.sens, id: ouvert.id }, fetchPolicy: 'network-only' });
  const bon: BonStock | undefined = data?.bon ?? undefined;
  const { data: socData } = useQuery(COORDONNEES_SOCIETE);
  const [printDoc, setPrintDoc] = useState<DemandeImpression | null>(null);
  const label = ouvert.sens === 'entree' ? "Bon d'entrée" : 'Bon de sortie';
  const lignes = bon?.lignes ?? [];
  const t = ouvert.transfert;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgb(15 26 46 / .45)' }}>
      <div className="w-[820px] max-h-full flex flex-col bg-surface border border-line-soft rounded-lg shadow-lifted">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-soft flex-none">
          <div>
            <div className="font-extrabold text-[15px]">
              {t ? `Transfert ${t.code}` : label} {bon?.numero ? <span className="money">{bon.numero}</span> : null}
            </div>
            <div className="text-[11px] text-ink-muted">
              {t ? <>{t.depot_source} → {t.depot_destination} · affichage du {label.toLowerCase()}</> : <>{fmtDate(bon?.date)}{bon?.depot ? ` · ${bon.depot}` : ''}</>}
            </div>
          </div>
          <button onClick={onClose} className="text-ink-muted text-[18px] px-2">✕</button>
        </div>

        <div className="px-5 py-4 overflow-auto flex flex-col gap-3">
          {error && <div className="text-[12px]" style={{ color: 'var(--danger)' }}>{error.message}</div>}
          {loading && !bon && <div className="text-[12px] text-ink-muted">Chargement…</div>}
          {bon && (
            <>
              <div className="flex gap-6 flex-wrap text-[12px]">
                <Info label="Date">{fmtDate(bon.date)}</Info>
                <Info label="Dépôt">{bon.depot || '—'}</Info>
                <Info label="Motif">{bon.motif || '—'}</Info>
                <Info label="Agent">{bon.agent || '—'}</Info>
                {bon.observation ? <Info label="Observation">{bon.observation}</Info> : null}
              </div>
              <DataGrid complet columns={COLONNES_LIGNES_BON} rows={lignes} rowKey={(l, i) => l.id ?? i}
                        emptyMessage="Aucune ligne."
                        exportCsv={{ nom: `bon-${bon.numero || bon.id}`, columns: EXPORT_LIGNES_BON }}
                        footer={{ _label: `${lignes.length} ligne(s)`, total: <span className="money">{fmtMoney(bon.total_ht ?? bon.valeur_total ?? lignes.reduce((s, l) => s + Number(l.total ?? 0), 0))}</span> }} />
            </>
          )}
        </div>

        <div className="flex gap-2 justify-end px-5 py-3.5 border-t border-line-soft flex-none">
          {onSupprimer && bon && (
            <button onClick={() => onSupprimer(t ? `Transfert ${t.code}` : `${label} ${bon.numero || bon.id}`)}
                    className="mr-auto px-4 py-2 rounded-md border border-line font-bold text-[12px]" style={{ color: 'var(--danger)' }}>
              Supprimer
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-line text-ink-label font-bold text-[12px]">Fermer</button>
          <button disabled={!bon}
                  onClick={() => bon && setPrintDoc(demandeBonStock({ bon, sens: ouvert.sens }, (socData?.coordonneesSociete ?? {}) as Record<string, unknown>))}
                  className="px-5 py-2 rounded-md bg-brand-700 text-white font-bold text-[12px] disabled:opacity-60">
            Imprimer
          </button>
        </div>
      </div>
      {printDoc && <ImprimerDocument demande={printDoc} onClose={() => setPrintDoc(null)} />}
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase text-ink-muted">{label}</div>
      <div className="font-semibold">{children}</div>
    </div>
  );
}
