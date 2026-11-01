import { useMemo, useState } from 'react';
import { useApolloClient, useMutation, useQuery } from '@apollo/client';
import {
  BONS_ENTREE, BONS_SORTIE, TRANSFERTS, BON_STOCK, DELETE_BON_ENTREE, DELETE_BON_SORTIE, COORDONNEES_SOCIETE,
} from '../api/queries';
import { fmtDate, fmtQte, isoFirstOfMonth, isoToday } from '../lib/format';
import { useDebouncedValue } from '../lib/useDebounce';
import { useDroits, D } from '../lib/droits';
import DataGrid, { Column, DataGridDistant, totalDistant } from '../components/ui/DataGrid';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { Money, PageHeader, PeriodPicker, Tabs, Toolbar } from '../components/ui/atoms';
import Dialog from '../components/ui/Dialog';
import { Button, IconButton } from '../components/ui/Button';
import { SearchField } from '../components/ui/Field';
import { DescriptionList } from '../components/ui/Card';
import { Alert, Skeleton } from '../components/ui/States';
import { Icon } from '../components/ui/Icon';
import { useToast } from '../components/ui/Toast';
import BonStockModal, { SensBon } from '../components/BonStockModal';
import TransfertStockModal from '../components/TransfertStockModal';
import ImprimerDocument from '../impression/ImprimerDocument';
import type { DemandeImpression } from '../impression/demandes';
import { demandeBonStock } from '../impression/demandes';
import type { BonStock, BonStockLigne } from '../impression/donnees';

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
  const { peut } = useDroits();
  const droitEntree = peut('stock', D.stock.bonEntree);
  const droitSortie = peut('stock', D.stock.bonSortie);
  const droitTransfert = droitEntree && droitSortie;
  // Onglets limités aux mouvements que l'utilisateur peut consulter
  const onglets = ONGLETS.filter((o) => (o.code === 'entree' ? droitEntree : o.code === 'sortie' ? droitSortie : droitTransfert));
  const [onglet, setOnglet] = useState<Onglet>(onglets[0]?.code ?? 'entree');
  const [debut, setDebut] = useState(isoFirstOfMonth());
  const [fin, setFin] = useState(isoToday());
  const [search, setSearch] = useState('');
  const recherche = useDebouncedValue(search, 300);

  const [creation, setCreation] = useState<SensBon | 'transfert' | null>(null);
  const [ouvert, setOuvert] = useState<Ouvert | null>(null);
  const [suppression, setSuppression] = useState<Ouvert & { libelle: string } | null>(null);
  const toast = useToast();


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
    { key: 'valeur', header: 'Valeur', align: 'right', width: '130px', field: 'valeur_total', render: (b) => <Money value={b.valeur_total ?? b.total_ht} className="font-semibold" /> },
    ...(peutSupprimer(sensCourant) ? [{ key: 'actions', header: '', align: 'right' as const, width: '50px', render: (b: BonStock) => (
      <IconButton icon="trash" label="Supprimer" tone="danger" size="xs"
                  onClick={(e) => { e.stopPropagation(); setSuppression({ sens: sensCourant, id: b.id, libelle: `${sensCourant === 'entree' ? "Bon d'entrée" : 'Bon de sortie'} ${b.numero || b.id}` }); }} />
    ) }] : []),
  ];

  const colsTransferts: Column<Transfert>[] = [
    { key: 'code', header: 'Code', width: '130px', field: 'code', render: (t) => <span className="money font-semibold">{t.code}</span> },
    { key: 'date', header: 'Date', width: '95px', field: 'date', type: 'date', render: (t) => fmtDate(t.date) },
    { key: 'trajet', header: 'Source → destination', render: (t) => (
      <span className="inline-flex items-center gap-1.5"><b>{t.depot_source || '—'}</b> <Icon name="arrowRight" size={14} className="text-ink-muted" /> <b>{t.depot_destination || '—'}</b></span>
    ) },
    { key: 'obs', header: 'Observation', field: 'observation', render: (t) => <span className="text-ink-muted">{t.observation || t.motif || '—'}</span> },
    { key: 'nb', header: 'Lignes', align: 'right', width: '70px', field: 'nb_lignes', type: 'number', render: (t) => <span className="money">{t.nb_lignes ?? '—'}</span> },
    { key: 'valeur', header: 'Valeur', align: 'right', width: '130px', field: 'valeur', render: (t) => <Money value={t.valeur} className="font-semibold" /> },
    ...(droitTransfert ? [{ key: 'actions', header: '', align: 'right' as const, width: '50px', render: (t: Transfert) => {
      // Supprimer une moitié du transfert supprime les deux bons côté serveur.
      const cible: Ouvert | null = t.sortie_id ? { sens: 'sortie', id: t.sortie_id } : t.entree_id ? { sens: 'entree', id: t.entree_id } : null;
      return cible ? (
        <IconButton icon="trash" label="Supprimer le transfert" tone="danger" size="xs"
                    onClick={(e) => { e.stopPropagation(); setSuppression({ ...cible, transfert: t, libelle: `Transfert ${t.code}` }); }} />
      ) : null;
    } }] : []),
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title="Mouvements de stock" icon="movements" backTo="/stock" backLabel="Retour au stock"
                  breadcrumb={[{ label: 'Stock', to: '/stock' }, { label: 'Mouvements' }]}>
        {droitTransfert && (
          <Button icon="movements" onClick={() => setCreation('transfert')}>Nouveau transfert</Button>
        )}
        {droitSortie && (
          <Button icon="stockOut" onClick={() => setCreation('sortie')}>Nouveau bon de sortie</Button>
        )}
        {droitEntree && (
          <Button variant="primary" icon="plus" onClick={() => setCreation('entree')}>Nouveau bon d'entrée</Button>
        )}
      </PageHeader>

      <Toolbar>
        <Tabs value={onglet} onChange={setOnglet} options={onglets} label="Type de mouvement" />
        <PeriodPicker debut={debut} fin={fin} onChange={(d, f) => { setDebut(d); setFin(f); }} />
        {estBon && <SearchField value={search} onChange={setSearch} placeholder="N°, motif, observation…" label="Rechercher un bon" />}
      </Toolbar>

      {estBon ? (
        // Une grille par sens (disposition mémorisée séparément)
        <DataGrid key={onglet} columns={colsBons} rowKey={(b) => b.id}
                  distant={distantBons} cleEtat={`mouvements-stock-${onglet}`}
                  onRowClick={(b) => setOuvert({ sens: sensCourant, id: b.id })}
                  emptyMessage="Aucun bon sur la période."
                  footer={(r) => ({ _label: `${r?.total ?? 0} bon(s)`,
                                    valeur: <Money value={totalDistant(r, 'valeur_total')} /> })} />
      ) : (
        <DataGrid columns={colsTransferts} rowKey={(t) => t.code}
                  distant={distantTransferts} cleEtat="mouvements-stock-transferts"
                  onRowClick={(t) => {
                    if (t.sortie_id) setOuvert({ sens: 'sortie', id: t.sortie_id, transfert: t });
                    else if (t.entree_id) setOuvert({ sens: 'entree', id: t.entree_id, transfert: t });
                  }}
                  emptyMessage="Aucun transfert sur la période."
                  footer={(r) => ({ _label: `${r?.total ?? 0} transfert(s)`,
                                    valeur: <Money value={totalDistant(r, 'valeur')} /> })} />
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
  { key: 'prix_unitaire', header: 'P.U.', align: 'right', width: '110px', render: (l) => <Money value={l.prix_unitaire} /> },
  { key: 'total', header: 'Total', align: 'right', width: '120px', render: (l) => <Money value={l.total} className="font-semibold" /> },
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
    <>
      <Dialog width={820} onClose={onClose}
              icon={t ? 'movements' : ouvert.sens === 'entree' ? 'stockIn' : 'stockOut'}
              iconTone={t ? 'brand' : ouvert.sens === 'entree' ? 'success' : 'danger'}
              title={<>{t ? `Transfert ${t.code}` : label} {bon?.numero ? <span className="money">{bon.numero}</span> : null}</>}
              subtitle={t ? <>{t.depot_source} → {t.depot_destination} · affichage du {label.toLowerCase()}</> : <>{fmtDate(bon?.date)}{bon?.depot ? ` · ${bon.depot}` : ''}</>}
              footerStart={onSupprimer && bon ? (
                <Button variant="danger" icon="trash"
                        onClick={() => onSupprimer(t ? `Transfert ${t.code}` : `${label} ${bon.numero || bon.id}`)}>
                  Supprimer
                </Button>
              ) : undefined}
              footer={(
                <>
                  <Button onClick={onClose}>Fermer</Button>
                  <Button variant="primary" icon="printer" disabled={!bon}
                          onClick={() => bon && setPrintDoc(demandeBonStock({ bon, sens: ouvert.sens }, (socData?.coordonneesSociete ?? {}) as Record<string, unknown>))}>
                    Imprimer
                  </Button>
                </>
              )}>
        <div className="flex flex-col gap-3">
          {error && <Alert tone="danger">{error.message}</Alert>}
          {loading && !bon && <Skeleton lines={3} />}
          {bon && (
            <>
              <DescriptionList columns={4} items={[
                { label: 'Date', value: fmtDate(bon.date) },
                { label: 'Dépôt', value: bon.depot },
                { label: 'Motif', value: bon.motif },
                { label: 'Agent', value: bon.agent },
                ...(bon.observation ? [{ label: 'Observation', value: bon.observation, full: true }] : []),
              ]} />
              <DataGrid complet columns={COLONNES_LIGNES_BON} rows={lignes} rowKey={(l, i) => l.id ?? i}
                        emptyMessage="Aucune ligne."
                        exportCsv={{ nom: `bon-${bon.numero || bon.id}`, columns: EXPORT_LIGNES_BON }}
                        footer={{ _label: `${lignes.length} ligne(s)`, total: <Money value={bon.total_ht ?? bon.valeur_total ?? lignes.reduce((s, l) => s + Number(l.total ?? 0), 0)} /> }} />
            </>
          )}
        </div>
      </Dialog>
      {printDoc && <ImprimerDocument demande={printDoc} onClose={() => setPrintDoc(null)} />}
    </>
  );
}
