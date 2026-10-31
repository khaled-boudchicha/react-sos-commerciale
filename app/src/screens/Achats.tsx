import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApolloClient, useQuery, useLazyQuery } from '@apollo/client';
import { ACHATS, COORDONNEES_SOCIETE } from '../api/queries';
import { AchatsResult, Achat, TYPES_ACHAT } from '../api/types';
import { fmtDate, isoFirstOfMonth, isoToday } from '../lib/format';
import DataGrid, { Column, DataGridDistant, totalDistant } from '../components/ui/DataGrid';
import { ExportColumn } from '../lib/export';
import Journal from './JournalVentes';
import ImprimerDocument from '../impression/ImprimerDocument';
import type { DemandeImpression } from '../impression/demandes';
import { demandeBordereau } from '../impression/demandes';
import { DocBadge, DOC_TONE, PayStatus, Money, Tabs, PeriodPicker, PageHeader, Toolbar } from '../components/ui/atoms';
import type { VueGrille } from '../components/grille/types';
import { Button } from '../components/ui/Button';
import { D, useDroits } from '../lib/droits';
import { useSession } from '../store/session';

export default function Achats() {
  const navigate = useNavigate();
  const [vue, setVue] = useState<'documents' | 'journal'>('documents');
  const { peut, peutDoc, restreintAuxSiennes } = useDroits();
  const peutJournal = peut('achat', D.achat.journal);
  // « Nouvelle pièce » : le type courant s'il est permis, sinon l'éditeur choisit le premier permis
  const peutCreer = TYPES_ACHAT.some((t) => peutDoc('achat', t.code, 'creer'));
  // Onglets limités aux types que l'utilisateur peut consulter (droit Delphi « <type> »)
  const typesVisibles = TYPES_ACHAT.filter((t) => peutDoc('achat', t.code, 'voir'));
  const [type, setType] = useState<(typeof TYPES_ACHAT)[number]['code']>(typesVisibles[0]?.code ?? 'FA');
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
  const siennesSeulement = restreintAuxSiennes('achat', type);
  const client = useApolloClient();
  const userId = siennesSeulement ? Number(moiId) : undefined;
  // Tri, filtres, recherche, pagination et groupes faits par le serveur
  const distant = useMemo<DataGridDistant<Achat>>(() => ({
    cle: JSON.stringify([type, debut, fin, userId]),
    totaux: [{ field: 'net_a_payer', type: 'sum' }, { field: 'regler', type: 'sum' }, { field: 'reste_a_payer', type: 'sum' }],
    charger: async (grille) => {
      // Les pièces changent ailleurs (modification, transformation, règlement) : toujours relire
      const { data } = await client.query({
        query: ACHATS, fetchPolicy: 'network-only',
        variables: { type_doc: type, date_debut: debut, date_fin: fin, user_id: userId, grille },
      });
      return data.achats as AchatsResult & { resumes?: Record<string, number | null> };
    },
  }), [client, type, debut, fin, userId]);

  const { data: socData } = useQuery(COORDONNEES_SOCIETE);
  const [printDoc, setPrintDoc] = useState<DemandeImpression | null>(null);
  const [fetchAll, { loading: bordereauEnCours }] = useLazyQuery(ACHATS, { fetchPolicy: 'network-only' });
  const typeLabel = TYPES_ACHAT.find((t) => t.code === type)?.label ?? type;

  async function imprimerBordereau() {
    const { data: all } = await fetchAll({ variables: { type_doc: type, date_debut: debut, date_fin: fin, limit: 5000, offset: 0 } });
    const docs: Achat[] = all?.achats?.data ?? [];
    setPrintDoc(demandeBordereau(
      {
        titre: `Bordereau des achats — ${typeLabel}`, tiersLabel: 'Fournisseur',
        debut, fin,
        lignes: docs.map((a) => ({
          numero: a.numero, date: a.date, tiers: a.raison ?? a.code_four ?? a.code_cli, mode_payement: a.mode_payement,
          net: a.net_a_payer ?? a.total_ttc, regler: a.regler, reste: a.reste_a_payer,
        })),
      },
      (socData?.coordonneesSociete ?? {}) as Record<string, unknown>,
    ));
  }

  // Colonnes historiques (tri / filtres / totaux côté serveur) + optionnelles masquées par défaut
  const vide = <span className="text-ink-muted">—</span>;
  const columns: Column<Achat>[] = [
    { key: 'numero', header: 'N° pièce', field: 'numero', width: '170px', pinned: 'left',
      render: (a) => <span className="flex items-center gap-2"><DocBadge code={type === 'FA' ? 'BR' : type} /><span className="money font-semibold">{a.numero}</span></span> },
    { key: 'date', header: 'Date', width: '96px', field: 'date', type: 'date', render: (a) => <span className="money">{fmtDate(a.date)}</span> },
    { key: 'code_four', header: 'Code fournisseur', width: '120px', hidden: true, render: (a) => (a.code_four ?? a.code_cli ? <span className="money">{a.code_four ?? a.code_cli}</span> : vide) },
    { key: 'fournisseur', header: 'Fournisseur', field: 'fournisseur', render: (a) => <b title={a.fournisseur ?? a.raison ?? undefined}>{a.fournisseur ?? a.raison ?? a.code_four ?? a.code_cli ?? '—'}</b> },
    { key: 'mode', header: 'Mode', width: '96px', field: 'mode_payement', render: (a) => <span className="text-ink-label">{a.mode_payement ?? '—'}</span> },
    { key: 'ht', header: 'Total HT', align: 'right', width: '120px', hidden: true, render: (a) => (a.total_ht == null ? vide : <Money value={a.total_ht} />) },
    { key: 'ttc', header: 'Net à payer', align: 'right', width: '124px', field: 'net_a_payer', render: (a) => <Money value={a.net_a_payer ?? a.total_ttc} className="font-semibold" /> },
    { key: 'regler', header: 'Réglé', align: 'right', width: '116px', field: 'regler', render: (a) => <Money value={a.regler} /> },
    { key: 'reste', header: 'Reste', align: 'right', width: '116px', field: 'reste_a_payer', render: (a) => (
      <Money value={a.reste_a_payer} tone={Number(a.reste_a_payer) > 0 ? 'danger' : undefined} />
    ) },
    { key: 'statut', header: 'Statut', width: '92px', render: (a) => <PayStatus regler={Number(a.regler)} reste={Number(a.reste_a_payer)} /> },
    { key: 'observation', header: 'Observation', width: '220px', hidden: true,
      render: (a) => (a.observation ? <span className="text-ink-label" title={a.observation}>{a.observation}</span> : vide) },
  ];
  const tous = ['numero', 'date', 'code_four', 'fournisseur', 'mode_payement', 'ht', 'net_a_payer', 'regler', 'reste_a_payer', 'statut', 'observation'];
  const seulement = (garder: string[]) => tous.filter((c) => !garder.includes(c));
  const vues: VueGrille[] = [
    { id: 'standard', libelle: 'Standard', etat: { ordreColonnes: tous, masquees: seulement(['numero', 'date', 'fournisseur', 'mode_payement', 'net_a_payer', 'regler', 'reste_a_payer', 'statut']) } },
    { id: 'reglements', libelle: 'Règlements fournisseurs', etat: { ordreColonnes: tous, masquees: seulement(['numero', 'date', 'code_four', 'fournisseur', 'net_a_payer', 'regler', 'reste_a_payer', 'statut']) } },
    { id: 'complete', libelle: 'Complète (toutes les colonnes)', etat: { ordreColonnes: tous, masquees: [], figees: { numero: 'gauche', statut: 'droite' }, densite: 'compacte' } },
  ];

  const csvDocs: ExportColumn<Achat>[] = [
    { header: 'N° pièce', value: (r) => r.numero },
    { header: 'Date', value: (r) => (r.date ? fmtDate(r.date) : '') },
    { header: 'Fournisseur', value: (r) => r.raison ?? r.code_four ?? r.code_cli ?? '' },
    { header: 'Mode', value: (r) => r.mode_payement ?? '' },
    { header: 'Net à payer', value: (r) => r.net_a_payer ?? r.total_ttc, numeric: true },
    { header: 'Réglé', value: (r) => r.regler, numeric: true },
    { header: 'Reste', value: (r) => r.reste_a_payer, numeric: true },
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title="Documents d'achat" icon="cart">
        {vue === 'documents' && (
          <Button icon="printer" onClick={() => void imprimerBordereau()} loading={bordereauEnCours}>
            {bordereauEnCours ? 'Préparation…' : 'Bordereau'}
          </Button>
        )}
        {vue === 'documents' && peutCreer && (
          <Button variant="primary" icon="plus"
                  onClick={() => navigate(`/achats/nouvelle${peutDoc('achat', type, 'creer') ? `?type=${type}` : ''}`)}>
            Nouvelle pièce
          </Button>
        )}
      </PageHeader>
      {printDoc && <ImprimerDocument demande={printDoc} onClose={() => setPrintDoc(null)} />}
      {(peutJournal || vue === 'documents') && (
        <Toolbar>
          {peutJournal && (
            <Tabs value={vue} onChange={setVue} label="Vue"
                  options={[{ code: 'documents' as const, label: 'Documents' }, { code: 'journal' as const, label: 'Journal (lignes)' }]} />
          )}
          {vue === 'documents' && (
            <div className="ml-auto">
              <PeriodPicker debut={debut} fin={fin} onChange={(d, f) => { setDebut(d); setFin(f); }} />
            </div>
          )}
        </Toolbar>
      )}
      {vue === 'journal' && peutJournal && <Journal sens="achat" />}
      {vue === 'documents' && (
      <>
      <Tabs value={type} onChange={setType} variant="underline" label="Type de pièce"
            options={typesVisibles.map((t) => ({ ...t, tone: DOC_TONE[t.code] }))} />
      <DataGrid
        exportCsv={{ nom: `achats-${type.toLowerCase()}`, columns: csvDocs }}
        columns={columns} rowKey={(a) => a.id}
        distant={distant} cleEtat="achats" grille={{ vues }}
        onRowClick={(a) => navigate(`/achats/${a.id}`)}
        footer={(r) => ({
          _label: `${r?.total ?? 0} pièce(s)`,
          ttc: <Money value={totalDistant(r, 'net_a_payer')} />,
          regler: <Money value={totalDistant(r, 'regler')} />,
          reste: <Money value={totalDistant(r, 'reste_a_payer')} tone="danger" />,
        })}
      />
      </>
      )}
    </div>
  );
}
