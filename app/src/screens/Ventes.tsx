import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApolloClient, useQuery, useLazyQuery } from '@apollo/client';
import { VENTES, COORDONNEES_SOCIETE } from '../api/queries';
import { VentesResult, Vente, TYPES_VENTE } from '../api/types';
import { fmtDate, isoFirstOfMonth, isoToday, fmtMoney } from '../lib/format';
import DataGrid, { Column, DataGridDistant, totalDistant } from '../components/ui/DataGrid';
import { ExportColumn } from '../lib/export';
import Journal from './JournalVentes';
import PrintPreview from '../print/engine/PrintPreview';
import { PrintDocument } from '../print/engine/types';
import { buildBordereauPrint } from '../print/templates';
import { DocBadge, PayStatus, Money, Tabs, PeriodPicker, PageHeader } from '../components/ui/atoms';
import { D, useDroits } from '../lib/droits';
import { useSession } from '../store/session';
import GrouperBLModal from '../components/document/GrouperBLModal';

export default function Ventes() {
  const navigate = useNavigate();
  const [vue, setVue] = useState<'documents' | 'journal'>('documents');
  const { peut, peutDoc, restreintAuxSiennes } = useDroits();
  const peutJournal = peut('vente', D.vente.journal);
  // « Nouvelle pièce » : le type courant s'il est permis, sinon l'éditeur choisit le premier permis
  const peutCreer = TYPES_VENTE.some((t) => peutDoc('vente', t.code, 'creer'));
  const [grouper, setGrouper] = useState(false);
  // Onglets limités aux types que l'utilisateur peut consulter (droit Delphi « <type> »)
  const typesVisibles = TYPES_VENTE.filter((t) => peutDoc('vente', t.code, 'voir'));
  const [type, setType] = useState<(typeof TYPES_VENTE)[number]['code']>(typesVisibles[0]?.code ?? 'FA');
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

  const { data: socData } = useQuery(COORDONNEES_SOCIETE);
  const [printDoc, setPrintDoc] = useState<PrintDocument | null>(null);
  const [fetchAll, { loading: bordereauEnCours }] = useLazyQuery(VENTES, { fetchPolicy: 'network-only' });
  const typeLabel = TYPES_VENTE.find((t) => t.code === type)?.label ?? type;

  async function imprimerBordereau() {
    const { data: all } = await fetchAll({ variables: { type_doc: type, date_debut: debut, date_fin: fin, limit: 5000, offset: 0 } });
    const docs: Vente[] = all?.ventes?.data ?? [];
    setPrintDoc(buildBordereauPrint(
      {
        titre: `Bordereau des ventes — ${typeLabel}`, tiersLabel: 'Client',
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

  const columns: Column<Vente>[] = [
    { key: 'numero', header: 'N° pièce', field: 'numero', render: (v) => <span className="flex items-center gap-2"><DocBadge code={type} /><span className="money">{v.numero}</span></span> },
    { key: 'date', header: 'Date', width: '90px', field: 'date', type: 'date', render: (v) => fmtDate(v.date) },
    { key: 'client', header: 'Client', field: 'raison', render: (v) => <b>{v.raison ?? v.code_cli ?? '—'}</b> },
    { key: 'mode', header: 'Mode', width: '90px', field: 'mode_payement', render: (v) => <span className="text-ink-muted">{v.mode_payement ?? '—'}</span> },
    { key: 'ttc', header: 'Net à payer', align: 'right', width: '120px', field: 'net_a_payer', render: (v) => <Money value={v.net_a_payer ?? v.total_ttc} /> },
    { key: 'regler', header: 'Réglé', align: 'right', width: '110px', field: 'regler', render: (v) => <Money value={v.regler} /> },
    { key: 'reste', header: 'Reste', align: 'right', width: '110px', field: 'reste_a_payer', render: (v) => (
      <span className="money font-medium" style={{ color: Number(v.reste_a_payer) > 0 ? 'var(--danger)' : undefined }}>{fmtMoney(v.reste_a_payer)}</span>
    ) },
    { key: 'statut', header: 'Statut', width: '86px', render: (v) => isAvoir ? null : <PayStatus regler={Number(v.regler)} reste={Number(v.reste_a_payer)} /> },
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
      <PageHeader title="Documents de vente">
        {vue === 'documents' && (
          <PeriodPicker debut={debut} fin={fin} onChange={(d, f) => { setDebut(d); setFin(f); }} />
        )}
        {vue === 'documents' && (
        <button onClick={() => void imprimerBordereau()} disabled={bordereauEnCours}
                className="rounded-md px-3 py-2 font-bold text-[12px] border border-line text-ink-label disabled:opacity-60">
          {bordereauEnCours ? 'Préparation…' : 'Bordereau'}
        </button>
        )}
        {vue === 'documents' && peutDoc('vente', 'FA', 'creer') && (
          <button onClick={() => setGrouper(true)}
                  title="Regrouper les bons de livraison d'un client en une facture"
                  className="rounded-md px-3 py-2 font-bold text-[12px] border border-line text-ink-label">
            Facturer des BL
          </button>
        )}
        {vue === 'documents' && peutCreer && (
        <button onClick={() => navigate(`/ventes/nouvelle${peutDoc('vente', type, 'creer') ? `?type=${type}` : ''}`)}
                className="rounded-md px-4 py-2 font-bold text-[12px] text-white bg-brand-700">
          ＋ Nouvelle pièce
        </button>
        )}
      </PageHeader>
      {printDoc && <PrintPreview doc={printDoc} onClose={() => setPrintDoc(null)} />}
      {grouper && <GrouperBLModal onClose={() => setGrouper(false)} />}
      {peutJournal && (
        <Tabs value={vue} onChange={setVue}
              options={[{ code: 'documents' as const, label: 'Documents' }, { code: 'journal' as const, label: 'Journal (lignes)' }]} />
      )}
      {vue === 'journal' && peutJournal && <Journal sens="vente" />}
      {vue === 'documents' && (
      <>
      <Tabs value={type} onChange={setType} options={typesVisibles} />
      <DataGrid
        exportCsv={{ nom: `ventes-${type.toLowerCase()}`, columns: csvDocs }}
        columns={columns} rowKey={(v) => v.id}
        distant={distant} cleEtat="ventes"
        onRowClick={(v) => navigate(`/ventes/${v.id}`)}
        footer={(r) => ({
          _label: `${r?.total ?? 0} pièce(s)`,
          ttc: <Money value={totalDistant(r, 'net_a_payer')} />,
          regler: <Money value={totalDistant(r, 'regler')} />,
          reste: <span className="money" style={{ color: 'var(--danger)' }}>{fmtMoney(totalDistant(r, 'reste_a_payer'))}</span>,
        })}
      />
      </>
      )}
    </div>
  );
}
