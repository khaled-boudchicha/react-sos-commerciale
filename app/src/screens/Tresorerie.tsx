import { useEffect, useState, useMemo } from 'react';
import { useApolloClient, useQuery, useLazyQuery, useMutation } from '@apollo/client';
import { TRESORIE_COMPLETE, SOLDES_COMPTES, COORDONNEES_SOCIETE, ANNULER_MOUVEMENT } from '../api/queries';
import ImprimerDocument from '../impression/ImprimerDocument';
import type { DemandeImpression } from '../impression/demandes';
import { demandeTresorerie } from '../impression/demandes';
import MouvementCaisseModal, { MouvementKind } from '../components/MouvementCaisseModal';
import ArreteCaisseModal from '../components/ArreteCaisseModal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
import { useDroits, D } from '../lib/droits';
import { TresorieCompleteResult, MouvementTresorie, SoldeCompte } from '../api/types';
import { fmtDate, fmtMoney, isoFirstOfMonth, isoToday } from '../lib/format';
import { exporterCsv, ExportColumn } from '../lib/export';
import DataGrid, { Column, DataGridDistant, totalDistant } from '../components/ui/DataGrid';
import { ReponseDistante, RequeteDistante } from '../components/grille/types';
import { Money, PageHeader, Toolbar } from '../components/ui/atoms';
import { Button, IconButton } from '../components/ui/Button';
import { DateRangeField } from '../components/ui/Field';
import { KpiTile } from '../components/ui/Kpi';
import MouvementDetailModal from '../components/MouvementDetailModal';

/** Requête de premier niveau (ni valeurs d'un filtre d'en-tête, ni sous-groupe) : ses totaux valent pour la liste */
const estRacine = (req: RequeteDistante) => !req.sauf && (!req.groupe || req.groupe.chemin.length === 0);

const csvMouvements: ExportColumn<MouvementTresorie>[] = [
  { header: 'Date', value: (m) => (m.date ? fmtDate(m.date) : '') },
  { header: 'Catégorie', value: (m) => m.categorie ?? '' },
  { header: 'Tiers', value: (m) => m.raison || m.tier || m.code_tier || '' },
  { header: 'Libellé', value: (m) => m.objet || m.observation || '' },
  { header: 'Compte', value: (m) => m.compte ?? '' },
  { header: 'Mode', value: (m) => m.mode_payement ?? '' },
  { header: 'Utilisateur', value: (m) => m.user ?? '' },
  { header: 'Montant', value: (m) => m.montant, numeric: true },
  { header: 'Solde cumulé', value: (m) => m.solde_cumul, numeric: true },
];

export default function Tresorerie() {
  const [compteId, setCompteId] = useState<number | null>(null);
  // Vue groupée : un mouvement par règlement (comme SQLTresorieGroupe du desktop)
  const [groupe, setGroupe] = useState(false);
  const [debut, setDebut] = useState(isoFirstOfMonth());
  const [fin, setFin] = useState(isoToday());

  const [mouvement, setMouvement] = useState<MouvementKind | null>(null);
  const [arrete, setArrete] = useState(false);
  const [annulation, setAnnulation] = useState<MouvementTresorie | null>(null);
  const [detail, setDetail] = useState<MouvementTresorie | null>(null);
  const toast = useToast();
  const { peut, peutUn, comptesAutorises } = useDroits();
  const peutCreer = peut('autre', D.autre.nouveauTresorerie);
  const peutTransfert = peut('autre', D.autre.transfertComptes);
  const peutAnnuler = peut('autre', D.autre.suppressionTresorerie);
  const peutArreter = peutUn('autre', [D.autre.arreterCaisse, D.autre.arreterCaisseAlt]);
  const [annuler, { loading: annulant }] = useMutation(ANNULER_MOUVEMENT);
  const { data: soldesData, refetch: refetchSoldes } = useQuery(SOLDES_COMPTES);
  const tousSoldes: SoldeCompte[] = Array.isArray(soldesData?.soldesComptes) ? soldesData.soldesComptes : [];
  // Droit Delphi PrevilegeBank : l'utilisateur ne voit que ses comptes autorisés
  const soldes = useMemo(() => comptesAutorises(tousSoldes, (c) => c.compte), [tousSoldes, comptesAutorises]);
  const restreint = soldes.length !== tousSoldes.length;
  const premierAutorise = soldes[0]?.compte_id ?? null;
  useEffect(() => {
    if (restreint && compteId === null && premierAutorise != null) setCompteId(premierAutorise);
  }, [restreint, compteId, premierAutorise]);
  // Utilisateur limité à certains comptes : aucune requête « tous comptes » tant qu'un compte autorisé n'est pas choisi
  const enAttenteCompte = restreint && compteId === null;

  const enAttente = enAttenteCompte || !soldesData;

  // Tri, filtres, recherche, pagination et groupes faits par le serveur ;
  // `version` est incrémenté après un mouvement / une annulation pour recharger la liste.
  const client = useApolloClient();
  const [version, setVersion] = useState(0);
  const refetchMvts = () => setVersion((v) => v + 1);
  // Dernière réponse de premier niveau (totaux du bandeau, restreints aux filtres de la grille)
  const [res, setRes] = useState<ReponseDistante<MouvementTresorie> | null>(null);
  const distant = useMemo<DataGridDistant<MouvementTresorie>>(() => ({
    cle: JSON.stringify([compteId, debut, fin, groupe, enAttente, version]),
    totaux: [{ field: 'debit', type: 'sum' }, { field: 'credit', type: 'sum' }, { field: 'montant', type: 'sum' }],
    charger: async (grille) => {
      if (enAttente) return { data: [], total: 0 };
      const { data } = await client.query({
        query: TRESORIE_COMPLETE, fetchPolicy: 'network-only',
        variables: { compte_id: compteId ?? undefined, date_debut: debut, date_fin: fin, groupe, grille },
      });
      const r = data.tresorieComplete as ReponseDistante<MouvementTresorie>;
      if (estRacine(grille)) setRes(r);
      return r;
    },
  }), [client, compteId, debut, fin, groupe, enAttente, version]);

  const [printDoc, setPrintDoc] = useState<DemandeImpression | null>(null);
  const { data: socData } = useQuery(COORDONNEES_SOCIETE);
  const [fetchAll, { loading: printing }] = useLazyQuery(TRESORIE_COMPLETE, { fetchPolicy: 'network-only' });
  const [fetchExport, { loading: exporting }] = useLazyQuery(TRESORIE_COMPLETE, { fetchPolicy: 'network-only' });

  async function exporter() {
    // Tous les mouvements de la période/compte, dans l'ordre chronologique cumulé.
    const { data: all } = await fetchExport({
      variables: { compte_id: compteId ?? undefined, date_debut: debut, date_fin: fin, limit: 5000, offset: 0 },
    });
    exporterCsv('tresorerie', csvMouvements, all?.tresorieComplete?.data ?? []);
  }

  async function printEtat() {
    // Tous les mouvements de la période (pas seulement la page affichée)
    const { data: all } = await fetchAll({
      variables: { compte_id: compteId ?? undefined, date_debut: debut, date_fin: fin, limit: 2000, offset: 0 },
    });
    const full: TresorieCompleteResult | undefined = all?.tresorieComplete;
    if (!full) return;
    const compte = compteId != null
      ? (soldes.find((c) => c.compte_id === compteId)?.compte ?? `Compte ${compteId}`)
      : 'Tous les comptes';
    setPrintDoc(demandeTresorerie(
      { res: full, compte, debut, fin },
      (socData?.coordonneesSociete ?? {}) as Record<string, unknown>,
    ));
  }

  async function confirmerAnnulation() {
    if (!annulation) return;
    try {
      await annuler({ variables: { cle: annulation.cle } });
      setAnnulation(null);
      toast.success('Mouvement annulé.');
      void refetchMvts(); void refetchSoldes();
    } catch (e: any) {
      setAnnulation(null);
      toast.error(`Annulation impossible : ${e.message ?? 'erreur'}`);
    }
  }

  const columns: Column<MouvementTresorie>[] = [
    { key: 'date', header: 'Date', width: '90px', field: 'date', type: 'date', render: (m) => fmtDate(m.date) },
    { key: 'categorie', header: 'Catégorie', width: '130px', field: 'categorie', render: (m) => <span className="text-ink-label font-semibold">{m.categorie ?? m.cle?.replace(/\d+$/, '') ?? '—'}</span> },
    { key: 'tier', header: 'Tiers', width: '200px', field: 'raison', render: (m) => <b>{m.raison || m.tier || m.code_tier || '—'}</b> },
    { key: 'objet', header: 'Libellé', field: 'objet', render: (m) => <span className="text-ink-muted">{m.objet || m.observation || '—'}</span> },
    { key: 'compte', header: 'Compte', width: '120px', field: 'compte', render: (m) => <span className="text-ink-muted">{m.compte ?? '—'}</span> },
    { key: 'mode', header: 'Mode', width: '90px', field: 'mode_payement', render: (m) => <span className="text-ink-muted">{m.mode_payement ?? '—'}</span> },
    { key: 'user', header: 'Utilisateur', width: '90px', field: 'user', render: (m) => <span className="text-ink-muted">{m.user ?? '—'}</span> },
    { key: 'montant', header: 'Montant', align: 'right', width: '120px', field: 'montant', render: (m) => (
      <Money value={m.montant} signed colorNeg={false} tone={Number(m.montant) >= 0 ? 'success' : 'danger'} className="font-semibold" />
    ) },
    // Pas de `field` : le cumul n'a de sens qu'en ordre chronologique, sans filtre de grille
    { key: 'solde', header: 'Solde cumulé', align: 'right', width: '120px', render: (m) => <span className="money">{fmtMoney(m.solde_cumul)}</span> },
    ...(peutAnnuler && !groupe ? [{ key: 'actions', header: '', align: 'right' as const, width: '70px', render: (m: MouvementTresorie) => !annulable(m) ? null : (
      <IconButton icon="xCircle" label="Annuler ce mouvement" size="xs" tone="danger"
                  onClick={(e) => { e.stopPropagation(); setAnnulation(m); }} />
    ) }] : []),
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title="Trésorerie" icon="wallet" description="Soldes des comptes, mouvements de caisse et de banque">
        {peutArreter && (
          <Button icon="lock" onClick={() => setArrete(true)}>Arrêté de caisse</Button>
        )}
        {peutTransfert && (
          <Button icon="movements" onClick={() => setMouvement('transfert')}>Transfert</Button>
        )}
        {peutCreer && (
          <Button icon="minus" className="!text-danger-text" onClick={() => setMouvement('decaissement')}>Décaissement</Button>
        )}
        {peutCreer && (
          <Button variant="primary" icon="plus" onClick={() => setMouvement('encaissement')}>Encaissement</Button>
        )}
      </PageHeader>
      <Toolbar>
        <DateRangeField from={debut} to={fin} onChange={(d, f) => { setDebut(d); setFin(f); }} />
        <Button icon="layers" onClick={() => setGroupe((g) => !g)} pressed={groupe}
                title="Un mouvement par règlement (uuid, tiers et date)">
          {groupe ? 'Vue détaillée' : 'Vue groupée'}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button icon="printer" onClick={() => void printEtat()} disabled={printing}>
            {printing ? 'Préparation…' : "Imprimer l'état"}
          </Button>
          <Button icon="download" onClick={() => void exporter()} disabled={exporting}
                  title="Exporter tous les mouvements en CSV (Excel)">
            {exporting ? 'Export…' : 'CSV'}
          </Button>
        </div>
      </Toolbar>
      {arrete && (
        <ArreteCaisseModal onClose={() => setArrete(false)}
                           onDone={() => { void refetchMvts(); void refetchSoldes(); }} />
      )}
      {annulation && (
        <ConfirmDialog title="Annuler ce mouvement ?"
          message={<>
            <b>{annulation.categorie ?? annulation.cle}</b> du {fmtDate(annulation.date)} — <b className="money">{fmtMoney(annulation.montant)} DA</b>
            {annulation.tier ? <> ({annulation.tier})</> : null}.
            <div className="mt-2">{messageAnnulation(annulation.cle)}</div>
          </>}
          confirmLabel="Annuler le mouvement" cancelLabel="Conserver" danger loading={annulant}
          onConfirm={() => void confirmerAnnulation()} onCancel={() => setAnnulation(null)} />
      )}
      {mouvement && (
        <MouvementCaisseModal kind={mouvement} onClose={() => setMouvement(null)}
                              onDone={() => { void refetchMvts(); void refetchSoldes(); }} />
      )}
      {printDoc && <ImprimerDocument demande={printDoc} onClose={() => setPrintDoc(null)} />}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
        {!restreint && <CompteCard tous label="Tous les comptes" solde={soldes.reduce((s, c) => s + Number(c.solde ?? 0), 0)}
                    active={compteId === null} onClick={() => setCompteId(null)} />}
        {soldes.map((c) => (
          <CompteCard key={c.compte_id ?? c.compte} label={c.compte} solde={c.solde}
                      active={compteId === c.compte_id} onClick={() => setCompteId(c.compte_id ?? null)} />
        ))}
      </div>

      {res && !enAttente && (
        <div className="text-sm text-ink-muted">
          Solde initial : <Money value={res.solde_initial as number | null | undefined} colorNeg={false} className="text-ink-label" />
          {' · '}Crédits : <Money value={totalDistant(res, 'credit')} tone="success" />
          {' · '}Débits : <Money value={totalDistant(res, 'debit')} tone="danger" />
          {' · '}Solde final : <Money value={totalDistant(res, 'montant')} colorNeg={false} className="font-bold text-ink" />
        </div>
      )}

      {detail && (
        <MouvementDetailModal m={detail} onClose={() => setDetail(null)}
                              onAnnuler={peutAnnuler && annulable(detail) ? () => { setAnnulation(detail); setDetail(null); } : undefined} />
      )}
      <DataGrid columns={columns} rowKey={(m) => m.cle}
                distant={distant} cleEtat="tresorerie"
                onRowClick={(m) => setDetail(m)}
                footer={(r) => ({
                  _label: `${r?.total ?? 0} mouvement(s)`,
                  montant: <span className="money font-semibold">{fmtMoney(totalDistant(r, 'montant'))}</span>,
                })} />
    </div>
  );
}

/**
 * Mouvement annulable : seules les lignes de la vue détaillée portent une clé reconnue
 * par l'agent (RGF / RG / EN / DE / TR / AVC + id). Les lignes de la vue groupée
 * (`GRP|…`) regroupent plusieurs écritures et ne s'annulent pas.
 */
const annulable = (m: MouvementTresorie) => /^(RGF|RG|EN|DE|TR|AVC)\d+$/.test(String(m.cle ?? ''));

/** Conséquences d'une annulation selon le type de mouvement (préfixe de la clé). */
function messageAnnulation(cle: string): string {
  const prefixe = cle.replace(/\d+$/, '').toUpperCase();
  if (prefixe === 'RGF') return "Le règlement client est supprimé : le reste à payer des factures concernées et le solde du client sont rouverts.";
  if (prefixe === 'RG') return "Le paiement fournisseur est supprimé : le reste à payer des pièces d'achat concernées et le solde du fournisseur sont rouverts.";
  if (prefixe === 'TR') return 'Le transfert entre comptes est annulé dans sa totalité (sortie du compte source et entrée du compte destination).';
  if (prefixe.startsWith('AV')) return "L'avance est supprimée et le solde d'avance du tiers est réduit d'autant.";
  return 'Le mouvement est supprimé et le solde du compte est recalculé.';
}

function CompteCard({ label, solde, active, onClick, tous }: { label: string; solde: number; active: boolean; onClick: () => void; tous?: boolean }) {
  return (
    <KpiTile size="sm" label={label} value={`${fmtMoney(solde)} DA`} icon={tous ? 'layers' : 'wallet'}
             tone={active ? 'brand' : 'neutral'} selected={active} onClick={onClick} />
  );
}
