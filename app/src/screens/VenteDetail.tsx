import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { VENTE, DELETE_VENTE, COORDONNEES_SOCIETE } from '../api/queries';
import { Vente, LigneVente, VENTE_TYPE_CODE } from '../api/types';
import { fmtDate, fmtMoney, fmtQte } from '../lib/format';
import DataGrid, { Column } from '../components/ui/DataGrid';
import { DocBadge, PayStatus, Money, PageHeader } from '../components/ui/atoms';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PrintPreview from '../print/engine/PrintPreview';
import { PrintDocument } from '../print/engine/types';
import { buildVentePrint, buildTicketPrint } from '../print/templates';

const TYPE_TO_CODE: Record<number, string> = { 0: 'BC', 1: 'FA', 2: 'BL', 3: 'FP', 4: 'BCT', 6: 'FAV', 7: 'BRT' };

export default function VenteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [printDoc, setPrintDoc] = useState<PrintDocument | null>(null);
  const [delError, setDelError] = useState<string | null>(null);
  const { data, loading, error } = useQuery(VENTE, { variables: { id: Number(id) } });
  const { data: socData } = useQuery(COORDONNEES_SOCIETE);
  const societe = (socData?.coordonneesSociete ?? {}) as Record<string, unknown>;
  const v: Vente | undefined = data?.vente ?? undefined;
  const lignes: LigneVente[] = v?.lignes ?? [];
  const code = v ? (TYPE_TO_CODE[v.type] ?? 'FA') : 'FA';

  const [deleteVente, { loading: deleting }] = useMutation(DELETE_VENTE);
  async function handleDelete() {
    setDelError(null);
    try {
      await deleteVente({ variables: { id: Number(id) } });
      navigate('/ventes');
    } catch (e: any) {
      setConfirm(false);
      setDelError(e.message ?? 'Suppression impossible.');
    }
  }

  const columns: Column<LigneVente>[] = [
    { key: 'code', header: 'Code', width: '100px', render: (l) => <span className="money">{l.code_article}</span> },
    { key: 'designation', header: 'Désignation', render: (l) => <span><b>{l.designation}</b>{l.n_lot ? <span className="text-ink-muted money text-[10.5px]"> · lot {l.n_lot}</span> : null}</span> },
    { key: 'qte', header: 'Qté', align: 'right', width: '70px', render: (l) => <span className="money">{fmtQte(l.qte)}</span> },
    { key: 'pu', header: 'P.U. HT', align: 'right', width: '95px', render: (l) => <Money value={l.prix_ht} /> },
    { key: 'remise', header: 'Rem. %', align: 'right', width: '70px', render: (l) => <span className="money">{fmtMoney(l.remise ?? 0, 1)}</span> },
    { key: 'tva', header: 'TVA %', align: 'right', width: '65px', render: (l) => <span className="money">{fmtMoney(l.tva, 0)}</span> },
    { key: 'ttc', header: 'Total TTC', align: 'right', width: '110px', render: (l) => <Money value={l.total_ttc} /> },
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title={v ? `${v.type_doc} ${v.numero}` : 'Pièce de vente'}>
        <Link to="/ventes" className="text-[12px] font-bold text-brand-700">← Retour à la liste</Link>
        {v && (
          <button onClick={() => setPrintDoc(buildVentePrint(v, societe))}
                  className="rounded-md px-3 py-1.5 font-bold text-[12px] border border-line text-ink-label">
            Imprimer A4
          </button>
        )}
        {v && (
          <button onClick={() => navigate(`/ventes/nouvelle?type=${VENTE_TYPE_CODE[Number(v.type)] ?? 'FA'}&from=${v.id}`)}
                  title="Créer une nouvelle pièce reprenant ces lignes"
                  className="rounded-md px-3 py-1.5 font-bold text-[12px] border border-line text-ink-label">
            Dupliquer
          </button>
        )}
        {v && v.type === 4 && (
          <button onClick={() => setPrintDoc(buildTicketPrint(v, societe))}
                  className="rounded-md px-3 py-1.5 font-bold text-[12px] border border-line text-ink-label">
            Ticket 80mm
          </button>
        )}
        {v && (
          <button onClick={() => setConfirm(true)}
                  className="rounded-md px-3 py-1.5 font-bold text-[12px]"
                  style={{ background: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: 'var(--danger)' }}>
            Supprimer
          </button>
        )}
      </PageHeader>
      {printDoc && <PrintPreview doc={printDoc} onClose={() => setPrintDoc(null)} />}
      {error && <div className="text-[12px]" style={{ color: 'var(--danger)' }}>{error.message}</div>}
      {delError && <div className="text-[12px]" style={{ color: 'var(--danger)' }}>{delError}</div>}
      {confirm && v && (
        <ConfirmDialog
          title="Supprimer cette pièce ?"
          message={<>La pièce <b>{v.type_doc} {v.numero}</b> sera définitivement supprimée et le stock des articles reversé. Cette action est irréversible.</>}
          confirmLabel="Supprimer" danger loading={deleting}
          onConfirm={handleDelete} onCancel={() => setConfirm(false)}
        />
      )}
      {loading && !v && <div className="text-[12px] text-ink-muted">Chargement…</div>}

      {v && (
        <div className="bg-surface border border-line-soft rounded-md shadow-soft px-4 py-3 flex items-center gap-5 flex-wrap text-[12px]">
          <DocBadge code={code} />
          <Field label="Client"><b>{v.raison ?? v.code_cli ?? '—'}</b></Field>
          <Field label="Date">{fmtDate(v.date)}</Field>
          <Field label="Mode">{v.mode_payement ?? '—'}</Field>
          <span className="ml-auto"><PayStatus regler={Number(v.regler)} reste={Number(v.reste_a_payer)} /></span>
        </div>
      )}

      <div className="grid grid-cols-[1fr_270px] gap-3.5 items-start">
        <DataGrid columns={columns} rows={lignes} rowKey={(l) => l.id} loading={loading}
                  emptyMessage="Aucune ligne." footer={{ _label: `${lignes.length} ligne(s)`, ttc: <Money value={v?.total_ttc} /> }} />
        {v && (
          <div className="bg-surface border border-line-soft rounded-md shadow-soft overflow-hidden">
            <Row label="Total HT" value={v.total_ht} />
            <Row label="Remise" value={-(Number(v.remise ?? 0))} neg />
            <Row label="TVA" value={v.tva ?? 0} />
            <div className="px-4 py-3 flex justify-between items-center text-white font-extrabold" style={{ background: 'var(--gradient-hero)' }}>
              <span>Net à payer</span><span className="money text-[15px]">{fmtMoney(v.net_a_payer)} DA</span>
            </div>
            <Row label="Réglé" value={v.regler} />
            <Row label="Reste" value={v.reste_a_payer} danger={Number(v.reste_a_payer) > 0} />
          </div>
        )}
      </div>
      {v?.observation && <div className="text-[12px] text-ink-muted">Note : {v.observation}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <span><span className="text-[10px] font-bold uppercase text-ink-muted mr-1.5">{label}</span>{children}</span>;
}

function Row({ label, value, neg, danger }: { label: string; value: unknown; neg?: boolean; danger?: boolean }) {
  const v = Number(value ?? 0);
  return (
    <div className="flex justify-between px-4 py-2 text-[12px] text-ink-label border-b border-dashed border-line-soft">
      <span>{label}</span>
      <span className="money" style={{ color: danger || (neg && v < 0) ? 'var(--danger)' : undefined }}>{fmtMoney(v)}</span>
    </div>
  );
}
