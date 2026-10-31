import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApolloClient, useQuery, useLazyQuery } from '@apollo/client';
import { VENTES, COORDONNEES_SOCIETE } from '../api/queries';
import { VentesResult, Vente, TYPES_VENTE } from '../api/types';
import { fmtDate, isoFirstOfMonth, isoToday, fmtMoney } from '../lib/format';
import DataGrid, { Column, DataGridDistant, totalDistant } from '../components/ui/DataGrid';
import { ExportColumn, exporterCsv } from '../lib/export';
import { SelectionBar, SelectionStat, useSelectionLignes } from '../components/ui/SelectionBar';
import { useToast } from '../components/ui/Toast';
import Journal from './JournalVentes';
import ImprimerDocument from '../impression/ImprimerDocument';
import type { DemandeImpression } from '../impression/demandes';
import { demandeBordereau } from '../impression/demandes';
import { Badge, DocBadge, DOC_TONE, PayStatus, Money, Tabs, PeriodPicker, PageHeader, Toolbar } from '../components/ui/atoms';
import type { VueGrille } from '../components/grille/types';
import { Button } from '../components/ui/Button';
import { D, useDroits } from '../lib/droits';
import { useSession } from '../store/session';
import GrouperBLModal from '../components/document/GrouperBLModal';
import ApercuPiece from '../components/document/ApercuPiece';
import ApercuDisposition, { BoutonApercu } from '../components/document/ApercuDisposition';
import { useApercu } from '../components/document/useApercu';

/** Clé stable d'une pièce (sélection multiple). */
const cleVente = (v: Vente) => v.id;

export default function Ventes() {
  const navigate = useNavigate();
  const toast = useToast();
  const [vue, setVue] = useState<'documents' | 'journal'>('documents');
  const { peut, peutDoc, restreintAuxSiennes } = useDroits();
  const peutJournal = peut('vente', D.vente.journal);
  // « Nouvelle pièce » : le type courant s'il est permis, sinon l'éditeur choisit le premier permis
  const peutCreer = TYPES_VENTE.some((t) => peutDoc('vente', t.code, 'creer'));
  const [grouper, setGrouper] = useState(false);
  // Onglets limités aux types que l'utilisateur peut consulter (droit Delphi « <type> »)
  const typesVisibles = TYPES_VENTE.filter((t) => peutDoc('vente', t.code, 'voir'));
  const [type, setType] = useState<(typeof TYPES_VENTE)[number]['code']>(typesVisibles[0]?.code ?? 'FA');
  // Liens directs (ruban, palette) : ?type=FA, ?vue=journal
  const [params] = useSearchParams();
  useEffect(() => {
    const t = params.get('type');
    const v = typesVisibles.find((x) => x.code === t);
    if (v) { setType(v.code); setVue('documents'); }
    if (params.get('vue') === 'journal' && peutJournal) setVue('journal');
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
  const [debut, setDebut] = useState(isoFirstOfMonth());
  const [fin, setFin] = useState(isoToday());

  // Droit « <type> par utilisateur » : la liste se limite aux pièces de l'utilisateur connecté
  const moiId = useSession((s) => s.dossierUser?.id);
  const siennesSeulement = restreintAuxSiennes('vente', type);
  const client = useApolloClient();
  const userId = siennesSeulement ? Number(moiId) : undefined;
  // Tri, filtres, recherche, pagination et groupes faits par le serveur
  const distant = useMemo<DataGridDistant<Vente>>(() => ({
    cle: JSON.stringify([type, debut, fin, userId]),
    totaux: [{ field: 'net_a_payer', type: 'sum' }, { field: 'regler', type: 'sum' }, { field: 'reste_a_payer', type: 'sum' }],
    charger: async (grille) => {
      // Les pièces changent ailleurs (modification, transformation, règlement) : toujours relire
      const { data } = await client.query({
        query: VENTES, fetchPolicy: 'network-only',
        variables: { type_doc: type, date_debut: debut, date_fin: fin, user_id: userId, grille },
      });
      return data.ventes as VentesResult & { resumes?: Record<string, number | null> };
    },
  }), [client, type, debut, fin, userId]);

  // Aperçu rapide (désactivé par défaut : clic = ouvrir la pièce, comme avant)
  const apercu = useApercu<Vente>('ventes', (v) => navigate(`/ventes/${v.id}`), distant.cle);

  const { data: socData } = useQuery(COORDONNEES_SOCIETE);
  const [printDoc, setPrintDoc] = useState<DemandeImpression | null>(null);
  const [fetchAll, { loading: bordereauEnCours }] = useLazyQuery(VENTES, { fetchPolicy: 'network-only' });
  const typeLabel = TYPES_VENTE.find((t) => t.code === type)?.label ?? type;

  async function imprimerBordereau() {
    const { data: all } = await fetchAll({ variables: { type_doc: type, date_debut: debut, date_fin: fin, limit: 5000, offset: 0 } });
    const docs: Vente[] = all?.ventes?.data ?? [];
    bordereauDe(docs, `Bordereau des ventes — ${typeLabel}`);
  }
  /** Bordereau d'un ensemble de pièces (toute la période, ou la sélection). */
  function bordereauDe(docs: Vente[], titre: string) {
    setPrintDoc(demandeBordereau(
      {
        titre, tiersLabel: 'Client',
        debut, fin,
        lignes: docs.map((v) => ({
          numero: v.numero, date: v.date, tiers: v.raison ?? v.code_cli, mode_payement: v.mode_payement,
          net: v.net_a_payer ?? v.total_ttc, regler: v.regler, reste: v.reste_a_payer,
        })),
      },
      (socData?.coordonneesSociete ?? {}) as Record<string, unknown>,
    ));
  }
  const isAvoir = type === 'FAV' || type === 'BRT';

  // Sélection multiple (actions groupées) — conservée d'une page à l'autre, vidée au changement de liste
  const sel = useSelectionLignes<Vente>(cleVente, distant.cle);
  const totSel = sel.lignes.reduce((t, v) => ({
    net: t.net + Number(v.net_a_payer ?? v.total_ttc ?? 0), regler: t.regler + Number(v.regler ?? 0), reste: t.reste + Number(v.reste_a_payer ?? 0),
  }), { net: 0, regler: 0, reste: 0 });
  async function copierNumeros() {
    try {
      await navigator.clipboard.writeText(sel.lignes.map((v) => v.numero).join('\n'));
      toast.success(`${sel.nombre} numéro(s) copié(s) dans le presse-papiers.`);
    } catch { toast.error('Copie impossible : presse-papiers indisponible.'); }
  }

  // Colonnes : les 8 historiques (tri / filtres / totaux côté serveur) + colonnes optionnelles masquées
  // par défaut (affichées via « Colonnes » ou une vue). Les optionnelles n'envoient aucun champ au serveur.
  const vide = <span className="text-ink-muted">—</span>;
  const montantOpt = (v: unknown) => (v === null || v === undefined || v === '' ? vide : <Money value={v} />);
  const columns: Column<Vente>[] = [
    { key: 'numero', header: 'N° pièce', field: 'numero', width: '190px', pinned: 'left',
      render: (v) => <span className="flex items-center gap-2"><DocBadge code={type} /><span className="money font-semibold">{v.numero}</span>
        {Number(v.grouped) > 0 && <Badge tone="neutral" title="Pièce regroupée (BL facturé / facture de regroupement)">groupée</Badge>}</span> },
    { key: 'date', header: 'Date', width: '96px', field: 'date', type: 'date', render: (v) => <span className="money">{fmtDate(v.date)}</span> },
    { key: 'echeance', header: 'Échéance', width: '104px', hidden: true,
      render: (v) => (v.date_echeance ? <span className="money">{fmtDate(v.date_echeance)}</span> : vide) },
    { key: 'retard', header: 'Retard', width: '136px', hidden: true, render: (v) => <Retard v={v} /> },
    { key: 'code_cli', header: 'Code client', width: '100px', hidden: true, render: (v) => (v.code_cli ? <span className="money">{v.code_cli}</span> : vide) },
    { key: 'client', header: 'Client', field: 'raison', render: (v) => <b title={v.raison ?? undefined}>{v.raison ?? v.code_cli ?? '—'}</b> },
    { key: 'tel', header: 'Téléphone', width: '120px', hidden: true, render: (v) => (v.tel ? <span className="money">{v.tel}</span> : vide) },
    { key: 'mode', header: 'Mode', width: '96px', field: 'mode_payement', render: (v) => <span className="text-ink-label">{v.mode_payement ?? '—'}</span> },
    { key: 'ht', header: 'Total HT', align: 'right', width: '120px', hidden: true, render: (v) => montantOpt(v.total_ht) },
    { key: 'remise', header: 'Remise', align: 'right', width: '104px', hidden: true, render: (v) => montantOpt(v.remise) },
    { key: 'tva', header: 'TVA', align: 'right', width: '110px', hidden: true, render: (v) => montantOpt(v.tva ?? v.total_taxe) },
    { key: 'timbre', header: 'Timbre', align: 'right', width: '96px', hidden: true, render: (v) => montantOpt(v.timbre) },
    { key: 'ttc', header: 'Net à payer', align: 'right', width: '124px', field: 'net_a_payer', render: (v) => <Money value={v.net_a_payer ?? v.total_ttc} className="font-semibold" /> },
    { key: 'regler', header: 'Réglé', align: 'right', width: '116px', field: 'regler', render: (v) => <Money value={v.regler} /> },
    { key: 'reste', header: 'Reste', align: 'right', width: '116px', field: 'reste_a_payer', render: (v) => (
      <span className="money font-medium" style={{ color: Number(v.reste_a_payer) > 0 ? 'var(--danger-text)' : undefined }}>{fmtMoney(v.reste_a_payer)}</span>
    ) },
    { key: 'statut', header: 'Statut', width: '92px', render: (v) => isAvoir ? null : <PayStatus regler={Number(v.regler)} reste={Number(v.reste_a_payer)} /> },
    { key: 'observation', header: 'Observation', width: '220px', hidden: true,
      render: (v) => (v.observation ? <span className="text-ink-label" title={v.observation}>{v.observation}</span> : vide) },
  ];

  // Vues de liste prédéfinies (modèles à la Sage / Odoo) — champs : clé serveur si la colonne en a une
  const C = { numero: 'numero', date: 'date', echeance: 'echeance', retard: 'retard', code: 'code_cli', client: 'raison', tel: 'tel',
    mode: 'mode_payement', ht: 'ht', remise: 'remise', tva: 'tva', timbre: 'timbre', ttc: 'net_a_payer', regler: 'regler',
    reste: 'reste_a_payer', statut: 'statut', obs: 'observation' } as const;
  const tous = Object.values(C) as string[];
  const seulement = (garder: string[]) => tous.filter((c) => !garder.includes(c));
  const vues: VueGrille[] = [
    { id: 'standard', libelle: 'Standard', etat: { ordreColonnes: tous, masquees: seulement([C.numero, C.date, C.client, C.mode, C.ttc, C.regler, C.reste, C.statut]) } },
    { id: 'comptable', libelle: 'Comptable (HT · TVA · TTC)', etat: {
      ordreColonnes: [C.numero, C.date, C.code, C.client, C.ht, C.remise, C.tva, C.timbre, C.ttc, C.statut, ...seulement([C.numero, C.date, C.code, C.client, C.ht, C.remise, C.tva, C.timbre, C.ttc, C.statut])],
      masquees: seulement([C.numero, C.date, C.code, C.client, C.ht, C.remise, C.tva, C.timbre, C.ttc, C.statut]) } },
    { id: 'recouvrement', libelle: 'Recouvrement (échéances)', etat: {
      ordreColonnes: [C.numero, C.date, C.echeance, C.retard, C.client, C.tel, C.ttc, C.regler, C.reste, C.statut, ...seulement([C.numero, C.date, C.echeance, C.retard, C.client, C.tel, C.ttc, C.regler, C.reste, C.statut])],
      masquees: seulement([C.numero, C.date, C.echeance, C.retard, C.client, C.tel, C.ttc, C.regler, C.reste, C.statut]) } },
    { id: 'complete', libelle: 'Complète (toutes les colonnes)', etat: { ordreColonnes: tous, masquees: [], figees: { [C.numero]: 'gauche', [C.statut]: 'droite' }, densite: 'compacte' } },
  ];

  const csvDocs: ExportColumn<Vente>[] = [
    { header: 'N° pièce', value: (r) => r.numero },
    { header: 'Date', value: (r) => (r.date ? fmtDate(r.date) : '') },
    { header: 'Client', value: (r) => r.raison ?? r.code_cli ?? '' },
    { header: 'Mode', value: (r) => r.mode_payement ?? '' },
    { header: 'Net à payer', value: (r) => r.net_a_payer ?? r.total_ttc, numeric: true },
    { header: 'Réglé', value: (r) => r.regler, numeric: true },
    { header: 'Reste', value: (r) => r.reste_a_payer, numeric: true },
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title="Documents de vente" icon="invoice">
        {vue === 'documents' && (
          <Button icon="printer" onClick={() => void imprimerBordereau()} loading={bordereauEnCours}
                  title="Imprimer le bordereau des pièces de la période">
            {bordereauEnCours ? 'Préparation…' : 'Bordereau'}
          </Button>
        )}
        {vue === 'documents' && peutDoc('vente', 'FA', 'creer') && (
          <Button icon="layers" onClick={() => setGrouper(true)}
                  title="Regrouper les bons de livraison d'un client en une facture">
            Facturer des BL
          </Button>
        )}
        {vue === 'documents' && peutCreer && (
          <Button variant="primary" icon="plus"
                  onClick={() => navigate(`/ventes/nouvelle${peutDoc('vente', type, 'creer') ? `?type=${type}` : ''}`)}>
            Nouvelle pièce
          </Button>
        )}
      </PageHeader>
      {printDoc && <ImprimerDocument demande={printDoc} onClose={() => setPrintDoc(null)} />}
      {grouper && <GrouperBLModal onClose={() => setGrouper(false)} />}
      {(peutJournal || vue === 'documents') && (
        <Toolbar>
          {peutJournal && (
            <Tabs value={vue} onChange={setVue} label="Vue"
                  options={[
                    { code: 'documents' as const, label: 'Documents', icon: 'invoice' as const },
                    { code: 'journal' as const, label: 'Journal (lignes)', icon: 'journal' as const },
                  ]} />
          )}
          {vue === 'documents' && (
            <div className="ml-auto">
              <PeriodPicker debut={debut} fin={fin} onChange={(d, f) => { setDebut(d); setFin(f); }} />
            </div>
          )}
        </Toolbar>
      )}
      {vue === 'journal' && peutJournal && <Journal sens="vente" />}
      {vue === 'documents' && (
      <>
      <Tabs value={type} onChange={setType} variant="underline" label="Type de pièce"
            options={typesVisibles.map((t) => ({ ...t, tone: DOC_TONE[t.code] }))} />
      <SelectionBar nombre={sel.nombre} libelle={sel.nombre > 1 ? 'pièces' : 'pièce'} feminin onClear={sel.vider}
                    resume={(
                      <>
                        <SelectionStat label="Net">{fmtMoney(totSel.net)}</SelectionStat>
                        <SelectionStat label="Réglé">{fmtMoney(totSel.regler)}</SelectionStat>
                        <SelectionStat label="Reste"><span className="text-danger-text">{fmtMoney(totSel.reste)}</span></SelectionStat>
                      </>
                    )}>
        <Button size="sm" icon="printer" onClick={() => bordereauDe(sel.lignes, `Bordereau des ventes — ${typeLabel} (sélection)`)}>Bordereau</Button>
        <Button size="sm" icon="download" onClick={() => exporterCsv(`ventes-${type.toLowerCase()}-selection`, csvDocs, sel.lignes)}>Exporter CSV</Button>
        <Button size="sm" icon="copy" onClick={() => void copierNumeros()}>Copier les numéros</Button>
      </SelectionBar>
      <ApercuDisposition apercu={apercu} libelle="Aperçu de la pièce de vente"
                         panneau={(fermer) => (
                           <ApercuPiece sens="vente" id={apercu.selection?.id ?? null} onFermer={fermer}
                                        onOuvrir={() => apercu.selection && navigate(`/ventes/${apercu.selection.id}`)} />
                         )}>
      <DataGrid
        exportCsv={{ nom: `ventes-${type.toLowerCase()}`, columns: csvDocs }}
        columns={columns} rowKey={(v) => v.id}
        distant={distant} cleEtat="ventes"
        actions={<BoutonApercu apercu={apercu} />}
        {...apercu.propsGrille({ vues, selection: 'multiple', toutSelectionner: 'page', selectionnees: sel.cles, surSelection: sel.surSelection })}
        footer={(r) => ({
          _label: `${r?.total ?? 0} pièce(s)`,
          ttc: <Money value={totalDistant(r, 'net_a_payer')} />,
          regler: <Money value={totalDistant(r, 'regler')} />,
          reste: <span className="money" style={{ color: 'var(--danger-text)' }}>{fmtMoney(totalDistant(r, 'reste_a_payer'))}</span>,
        })}
      />
      </ApercuDisposition>
      </>
      )}
    </div>
  );
}

/** Retard de paiement (pièces avec reste dû) : échue → rouge, proche (≤ 7 j) → ambre, sinon jours restants. */
function Retard({ v }: { v: Vente }) {
  if (!v.date_echeance || !(Number(v.reste_a_payer) > 0.009)) return <span className="text-ink-muted">—</span>;
  const jour = 86_400_000;
  const aujourdhui = new Date(); aujourdhui.setHours(0, 0, 0, 0);
  const ech = new Date(`${String(v.date_echeance).slice(0, 10)}T00:00:00`);
  const n = Math.round((aujourdhui.getTime() - ech.getTime()) / jour);
  if (Number.isNaN(n)) return <span className="text-ink-muted">—</span>;
  if (n > 0) return <Badge tone="danger" icon="clock">{n} j de retard</Badge>;
  if (n >= -7) return <Badge tone="warning" icon="clock">{n === 0 ? 'aujourd’hui' : `dans ${-n} j`}</Badge>;
  return <span className="text-xs text-ink-muted">dans {-n} j</span>;
}
