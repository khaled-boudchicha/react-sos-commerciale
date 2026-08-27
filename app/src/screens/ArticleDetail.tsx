import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { ARTICLE, LOTS, TARIFS_ARTICLE, BARCODES_ARTICLE } from '../api/queries';
import { Article } from '../api/types';
import { fmtDate, fmtMoney, fmtQte } from '../lib/format';
import DataGrid, { Column } from '../components/ui/DataGrid';
import { Money, PageHeader, StatusPill } from '../components/ui/atoms';

type Lot = { id: number; n_lot: string; date_fabrication?: string | null; date_peremption?: string | null; qte: number; prix?: unknown[] };
type Tarif = Record<string, unknown> & { qte_from?: number; qte_to?: number; prix_ht?: number };

export default function ArticleDetail() {
  const { id } = useParams();
  const articleId = Number(id);
  const { data, loading, error } = useQuery(ARTICLE, { variables: { id: articleId } });
  const a: Article | undefined = data?.article ?? undefined;

  const { data: lotsData, loading: lotsLoading } = useQuery(LOTS, { variables: { article_id: articleId } });
  const { data: tarifsData } = useQuery(TARIFS_ARTICLE, { variables: { code_article: a?.code ?? '' }, skip: !a?.code });
  const { data: bcData } = useQuery(BARCODES_ARTICLE, { variables: { article_id: articleId } });

  const lots: Lot[] = Array.isArray(lotsData?.lots) ? lotsData.lots : [];
  const tarifs: Tarif[] = Array.isArray(tarifsData?.tarifsArticle) ? tarifsData.tarifsArticle : [];
  const barcodes: unknown[] = Array.isArray(bcData?.barcodesArticle) ? bcData.barcodesArticle : [];

  const lotCols: Column<Lot>[] = [
    { key: 'lot', header: 'N° lot', render: (l) => <b className="money">{l.n_lot}</b> },
    { key: 'per', header: 'Péremption', width: '110px', render: (l) => {
      if (!l.date_peremption) return <span className="text-ink-muted">—</span>;
      const days = Math.round((new Date(l.date_peremption).getTime() - Date.now()) / 86_400_000);
      const tone = days < 0 ? 'bad' : days <= 60 ? 'warn' : 'ok';
      return <span className="flex items-center gap-2">{fmtDate(l.date_peremption)} <StatusPill tone={tone}>{days < 0 ? 'Périmé' : `J-${days}`}</StatusPill></span>;
    } },
    { key: 'qte', header: 'Qté', align: 'right', width: '80px', render: (l) => <span className="money font-semibold">{fmtQte(l.qte)}</span> },
  ];

  const tarifCols: Column<Tarif>[] = [
    { key: 'from', header: 'Qté de', align: 'right', render: (t) => <span className="money">{fmtQte(t.qte_from)}</span> },
    { key: 'to', header: 'Qté à', align: 'right', render: (t) => <span className="money">{fmtQte(t.qte_to)}</span> },
    { key: 'prix', header: 'Prix HT', align: 'right', render: (t) => <Money value={t.prix_ht} /> },
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title={a?.designation ?? `Article ${id}`}>
        <Link to="/stock" className="text-[12px] font-bold text-brand-700">← Retour au stock</Link>
      </PageHeader>
      {error && <div className="text-[12px]" style={{ color: 'var(--danger)' }}>{error.message}</div>}
      {loading && !a && <div className="text-[12px] text-ink-muted">Chargement…</div>}

      {a && (
        <div className="bg-surface border border-line-soft rounded-md shadow-soft px-4 py-3.5 grid grid-cols-6 gap-4 text-[12px]">
          <Head label="Code"><span className="money">{a.code}</span></Head>
          <Head label="Famille">{a.famille ?? '—'}</Head>
          <Head label="PMP"><span className="money">{fmtMoney(a.pmp)}</span></Head>
          <Head label="P.V. TTC"><span className="money">{fmtMoney(a.prix_vente_ttc)}</span></Head>
          <Head label="Marge %"><span className="money" style={{ color: Number(a.margep) < 0 ? 'var(--danger)' : 'var(--success)' }}>{fmtMoney(a.margep, 1)}</span></Head>
          <Head label="Stock réel">
            <span className="money font-extrabold text-[15px]"
                  style={{ color: Number(a.qte_reale) <= 0 ? 'var(--danger)' : Number(a.qte_reale) <= Number(a.stock_min ?? 0) ? 'var(--warning)' : undefined }}>
              {fmtQte(a.qte_reale)}
            </span>
            <span className="text-ink-muted text-[10.5px]"> / min {fmtQte(a.stock_min)}</span>
          </Head>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3.5 items-start">
        <div className="flex flex-col gap-2">
          <h2 className="font-bold text-[13px]">Lots & péremption</h2>
          <DataGrid columns={lotCols} rows={lots} rowKey={(l) => l.id} loading={lotsLoading} emptyMessage="Aucun lot." />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="font-bold text-[13px]">Tarifs par quantité</h2>
          <DataGrid columns={tarifCols} rows={tarifs} rowKey={(_t, i) => i} emptyMessage="Aucun tarif par quantité." />
          <h2 className="font-bold text-[13px] mt-2">Codes-barres</h2>
          <div className="bg-surface border border-line-soft rounded-md shadow-soft px-4 py-3 flex gap-2 flex-wrap">
            {a?.code_bare && <span className="money text-[11.5px] border border-line rounded px-2 py-1">{a.code_bare}</span>}
            {barcodes.map((b, i) => {
              const row = b as Record<string, unknown>;
              const val = String(row.barcode ?? row.code_bare ?? row.code ?? b);
              return <span key={i} className="money text-[11.5px] border border-line rounded px-2 py-1">{val}</span>;
            })}
            {!a?.code_bare && barcodes.length === 0 && <span className="text-ink-muted text-[12px]">Aucun code-barres.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Head({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase text-ink-muted mb-0.5">{label}</div>
      <div className="font-semibold">{children}</div>
    </div>
  );
}
