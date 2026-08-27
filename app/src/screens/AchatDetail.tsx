import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { ACHAT, DELETE_ACHAT, COORDONNEES_SOCIETE } from '../api/queries';
import { fmtDate, fmtMoney, fmtQte } from '../lib/format';
import DataGrid, { Column } from '../components/ui/DataGrid';
import { DocBadge, PayStatus, Money, PageHeader } from '../components/ui/atoms';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PrintPreview from '../print/engine/PrintPreview';
import { PrintDocument } from '../print/engine/types';
import { buildAchatPrint } from '../print/templates/achat';

type LigneAchat = Record<string, unknown> & {
  id: number; code_article?: string; designation?: string; qte?: number;
  prix_ht?: number; tva?: number; total_ttc?: number; n_lot?: string;
};

export default function AchatDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [printDoc, setPrintDoc] = useState<PrintDocument | null>(null);
  const [delError, setDelError] = useState<string | null>(null);
  const { data, loading, error } = useQuery(ACHAT, { variables: { id: Number(id) } });
  const { data: socData } = useQuery(COORDONNEES_SOCIETE);
  const societe = (socData?.coordonneesSociete ?? {}) as Record<string, unknown>;
  const a = (data?.achat ?? undefined) as (Record<string, any> | undefined);
  const lignes: LigneAchat[] = Array.isArray(a?.lignes) ? a.lignes : [];

  const [deleteAchat, { loading: deleting }] = useMutation(DELETE_ACHAT);
  async function handleDelete() {
    setDelError(null);
    try {
      await deleteAchat({ variables: { id: Number(id) } });
      navigate('/achats');
    } catch (e: any) {
      setConfirm(false);
      setDelError(e.message ?? 'Suppression impossible.');
    }
  }

  const columns: Column<LigneAchat>[] = [
    { key: 'code', header: 'Code', width: '100px', render: (l) => <span className="money">{String(l.code_article ?? '')}</span> },
    { key: 'designation', header: 'Désignation', render: (l) => <span><b>{String(l.designation ?? '')}</b>{l.n_lot ? <span className="text-ink-muted money text-[10.5px]"> · lot {String(l.n_lot)}</span> : null}</span> },
    { key: 'qte', header: 'Qté', align: 'right', width: '70px', render: (l) => <span className="money">{fmtQte(l.qte)}</span> },
    { key: 'pu', header: 'P.U. HT', align: 'right', width: '95px', render: (l) => <Money value={l.prix_ht} /> },
    { key: 'tva', header: 'TVA %', align: 'right', width: '65px', render: (l) => <span className="money">{fmtMoney(l.tva, 0)}</span> },
    { key: 'ttc', header: 'Total TTC', align: 'right', width: '110px', render: (l) => <Money value={l.total_ttc} /> },
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title={a ? `${a.type_doc} ${a.numero}` : "Pièce d'achat"}>
        <Link to="/achats" className="text-[12px] font-bold text-brand-700">← Retour à la liste</Link>
        {a && (
          <button onClick={() => setPrintDoc(buildAchatPrint(a, societe))}
                  className="rounded-md px-3 py-1.5 font-bold text-[12px] border border-line text-ink-label">
            Imprimer
          </button>
        )}
        {a && (
          <button onClick={() => setConfirm(true)}
                  className="rounded-md px-3 py-1.5 font-bold text-[12px]"
                  style={{ background: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: 'var(--danger)' }}>
            Supprimer
          </button>
        )}
      </PageHeader>
      {error && <div className="text-[12px]" style={{ color: 'var(--danger)' }}>{error.message}</div>}
      {delError && <div className="text-[12px]" style={{ color: 'var(--danger)' }}>{delError}</div>}
      {printDoc && <PrintPreview doc={printDoc} onClose={() => setPrintDoc(null)} />}
      {confirm && a && (
        <ConfirmDialog
          title="Supprimer cette pièce ?"
          message={<>La pièce <b>{a.type_doc} {a.numero}</b> sera définitivement supprimée et le stock reversé. Action irréversible.</>}
          confirmLabel="Supprimer" danger loading={deleting}
          onConfirm={handleDelete} onCancel={() => setConfirm(false)}
        />
      )}
      {loading && !a && <div className="text-[12px] text-ink-muted">Chargement…</div>}

      {a && (
        <div className="bg-surface border border-line-soft rounded-md shadow-soft px-4 py-3 flex items-center gap-5 flex-wrap text-[12px]">
          <DocBadge code="BR" />
          <span><span className="text-[10px] font-bold uppercase text-ink-muted mr-1.5">Fournisseur</span><b>{a.raison ?? a.code_four ?? a.code_cli ?? '—'}</b></span>
          <span><span className="text-[10px] font-bold uppercase text-ink-muted mr-1.5">Date</span>{fmtDate(a.date)}</span>
          <span><span className="text-[10px] font-bold uppercase text-ink-muted mr-1.5">Mode</span>{a.mode_payement ?? '—'}</span>
          <span className="ml-auto"><PayStatus regler={Number(a.regler)} reste={Number(a.reste_a_payer)} /></span>
        </div>
      )}

      <DataGrid columns={columns} rows={lignes} rowKey={(l) => l.id} loading={loading}
                emptyMessage="Aucune ligne."
                footer={{ _label: `${lignes.length} ligne(s)`, ttc: <Money value={a?.total_ttc} /> }} />
      {a && (
        <div className="text-[12px] text-ink-label flex gap-5">
          <span>Net à payer : <b className="money">{fmtMoney(a.net_a_payer)} DA</b></span>
          <span>Réglé : <span className="money">{fmtMoney(a.regler)}</span></span>
          <span>Reste : <span className="money" style={{ color: Number(a.reste_a_payer) > 0 ? 'var(--danger)' : undefined }}>{fmtMoney(a.reste_a_payer)}</span></span>
        </div>
      )}
    </div>
  );
}
