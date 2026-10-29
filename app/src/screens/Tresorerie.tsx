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
import { PeriodPicker, PageHeader } from '../components/ui/atoms';
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
      <span className="money font-semibold" style={{ color: Number(m.montant) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
        {Number(m.montant) >= 0 ? '+' : ''}{fmtMoney(m.montant)}
      </span>
    ) },
    // Pas de `field` : le cumul n'a de sens qu'en ordre chronologique, sans filtre de grille
    { key: 'solde', header: 'Solde cumulé', align: 'right', width: '120px', render: (m) => <span className="money">{fmtMoney(m.solde_cumul)}</span> },
    ...(peutAnnuler && !groupe ? [{ key: 'actions', header: '', align: 'right' as const, width: '70px', render: (m: MouvementTresorie) => !annulable(m) ? null : (
      <button onClick={(e) => { e.stopPropagation(); setAnnulation(m); }} title="Annuler ce mouvement"
              className="px-1.5 py-0.5 rounded-sm border border-line text-[11px] font-semibold" style={{ color: 'var(--danger)' }}>
        Annuler
      </button>
    ) }] : []),
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title="Trésorerie">
        <PeriodPicker debut={debut} fin={fin} onChange={(d, f) => { setDebut(d); setFin(f); }} />
        <button onClick={() => setGroupe((g) => !g)} aria-pressed={groupe}
                title="Un mouvement par règlement (uuid, tiers et date)"
                className={`rounded-md px-3 py-2 font-bold text-[12px] border ${groupe ? 'border-brand-700 text-brand-700' : 'border-line text-ink-label'}`}>
          {groupe ? 'Vue détaillée' : 'Vue groupée'}
        </button>
        <button onClick={() => void printEtat()} disabled={printing}
                className="rounded-md px-3 py-2 font-bold text-[12px] border border-line text-ink-label disabled:opacity-60">
          {printing ? 'Préparation…' : "Imprimer l'état"}
        </button>
        <button onClick={() => void exporter()} disabled={exporting}
                title="Exporter tous les mouvements en CSV (Excel)"
                className="rounded-md px-3 py-2 font-bold text-[12px] border border-line text-ink-label disabled:opacity-60">
          {exporting ? 'Export…' : '⬇ CSV'}
        </button>
        {peutArreter && (
          <button onClick={() => setArrete(true)}
                  className="rounded-md px-3 py-2 font-bold text-[12px] border border-line text-ink-label">
            Arrêté de caisse
          </button>
        )}
        {peutTransfert && (
          <button onClick={() => setMouvement('transfert')}
                  className="rounded-md px-3 py-2 font-bold text-[12px] border border-line text-ink-label">
            Transfert
          </button>
        )}
        {peutCreer && (
          <button onClick={() => setMouvement('decaissement')}
                  className="rounded-md px-3 py-2 font-bold text-[12px] border border-line"
                  style={{ color: 'var(--danger)' }}>
            − Décaissement
          </button>
        )}
        {peutCreer && (
          <button onClick={() => setMouvement('encaissement')}
                  className="rounded-md px-4 py-2 font-bold text-[12px] text-white bg-brand-700">
            ＋ Encaissement
          </button>
        )}
      </PageHeader>
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
          confirmLabel="Annuler le mouvement" danger loading={annulant}
          onConfirm={() => void confirmerAnnulation()} onCancel={() => setAnnulation(null)} />
      )}
      {mouvement && (
        <MouvementCaisseModal kind={mouvement} onClose={() => setMouvement(null)}
                              onDone={() => { void refetchMvts(); void refetchSoldes(); }} />
      )}
      {printDoc && <ImprimerDocument demande={printDoc} onClose={() => setPrintDoc(null)} />}

      <div className="flex gap-3 flex-wrap">
        {!restreint && <CompteCard label="Tous les comptes" solde={soldes.reduce((s, c) => s + Number(c.solde ?? 0), 0)}
                    active={compteId === null} onClick={() => setCompteId(null)} />}
        {soldes.map((c) => (
          <CompteCard key={c.compte_id ?? c.compte} label={c.compte} solde={c.solde}
                      active={compteId === c.compte_id} onClick={() => setCompteId(c.compte_id ?? null)} />
        ))}
      </div>

      {res && !enAttente && (
        <div className="text-[11.5px] text-ink-muted">
          Solde initial : <span className="money">{fmtMoney(res.solde_initial as number | null | undefined)}</span>
          {' · '}Crédits : <span className="money" style={{ color: 'var(--success)' }}>{fmtMoney(totalDistant(res, 'credit'))}</span>
          {' · '}Débits : <span className="money" style={{ color: 'var(--danger)' }}>{fmtMoney(totalDistant(res, 'debit'))}</span>
          {' · '}Solde final : <b className="money text-ink">{fmtMoney(totalDistant(res, 'montant'))}</b>
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

function CompteCard({ label, solde, active, onClick }: { label: string; solde: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
            className={`text-left bg-surface border rounded-md shadow-soft px-3.5 py-2.5 min-w-[170px] ${active ? 'border-brand-500' : 'border-line-soft'}`}
            style={active ? { boxShadow: '0 0 0 2px var(--brand-100)' } : undefined}>
      <div className="text-[10.5px] font-bold text-ink-muted">{label}</div>
      <div className="money text-[15px] font-extrabold mt-0.5">{fmtMoney(solde)} DA</div>
    </button>
  );
}
