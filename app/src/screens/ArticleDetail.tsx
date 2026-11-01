import { useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { ARTICLE, LOTS, TARIFS_ARTICLE, BARCODES_ARTICLE } from '../api/queries';
import { Article } from '../api/types';
import { fmtDate, fmtQte } from '../lib/format';
import DataGrid, { Column } from '../components/ui/DataGrid';
import { Badge, Money, PageHeader, StatusPill } from '../components/ui/atoms';
import { Card, DescriptionList } from '../components/ui/Card';
import { Alert, Skeleton } from '../components/ui/States';
import { D, useDroits } from '../lib/droits';
import FicheStockPanel from '../components/FicheStockPanel';

type Lot = { id: number; n_lot: string; date_fabrication?: string | null; date_peremption?: string | null; qte: number; prix?: unknown[] };
type Tarif = Record<string, unknown> & { qte_from?: number; qte_to?: number; prix_ht?: number };

export default function ArticleDetail() {
  const { peut, droits, voirMarges } = useDroits();
  // « Cacher l'onglet Tarifs » est un droit restrictif : il ne s'applique que s'il est
  // explicitement coché (pas pour un administrateur ni un module « tout »).
  const tarifsCaches = !!droits && !droits.admin && Array.isArray(droits.stock) && droits.stock.includes(D.stock.cacherTarifs);
  const { id } = useParams();
  const articleId = Number(id);
  const { data, loading, error } = useQuery(ARTICLE, { variables: { id: articleId } });
  // L'agent renvoie { article, lots, tarifs, … } (forme partagée avec l'app mobile)
  const a: Article | undefined = data?.article?.article ?? data?.article ?? undefined;

  const { data: lotsData, loading: lotsLoading, error: lotsErreur } = useQuery(LOTS, { variables: { article_id: articleId } });
  const { data: tarifsData } = useQuery(TARIFS_ARTICLE, { variables: { code_article: a?.code ?? '' }, skip: !a?.code });
  const { data: bcData } = useQuery(BARCODES_ARTICLE, { variables: { article_id: articleId } });

  const lots: Lot[] = Array.isArray(lotsData?.lots) ? lotsData.lots : [];
  const tarifs: Tarif[] = Array.isArray(tarifsData?.tarifsArticle) ? tarifsData.tarifsArticle : [];
  const barcodes: unknown[] = Array.isArray(bcData?.barcodesArticle) ? bcData.barcodesArticle : [];

  const lotCols: Column<Lot>[] = [
    { key: 'lot', header: 'N° lot', sortAccessor: (l) => l.n_lot ?? '', render: (l) => <b className="money">{l.n_lot}</b> },
    { key: 'per', header: 'Péremption', width: '110px', sortAccessor: (l) => l.date_peremption ?? null, render: (l) => {
      if (!l.date_peremption) return <span className="text-ink-muted">—</span>;
      const days = Math.round((new Date(l.date_peremption).getTime() - Date.now()) / 86_400_000);
      const tone = days < 0 ? 'bad' : days <= 60 ? 'warn' : 'ok';
      return <span className="flex items-center gap-2">{fmtDate(l.date_peremption)} <StatusPill tone={tone}>{days < 0 ? 'Périmé' : `J-${days}`}</StatusPill></span>;
    } },
    { key: 'qte', header: 'Qté', align: 'right', width: '80px', render: (l) => <span className="money font-semibold">{fmtQte(l.qte)}</span> },
  ];

  const tarifCols: Column<Tarif>[] = [
    { key: 'from', header: 'Qté de', align: 'right', sortAccessor: (t) => Number(t.qte_from ?? 0), render: (t) => <span className="money">{fmtQte(t.qte_from)}</span> },
    { key: 'to', header: 'Qté à', align: 'right', sortAccessor: (t) => Number(t.qte_to ?? 0), render: (t) => <span className="money">{fmtQte(t.qte_to)}</span> },
    { key: 'prix', header: 'Prix HT', align: 'right', sortAccessor: (t) => Number(t.prix_ht ?? 0), render: (t) => <Money value={t.prix_ht} /> },
  ];

  const q = Number(a?.qte_reale ?? 0), min = Number(a?.stock_min ?? 0);
  const etat = !a ? null : q <= 0
    ? <Badge tone="danger" dot>Rupture</Badge>
    : q <= min ? <Badge tone="warning" dot>Stock bas</Badge> : null;
  const titre = a?.designation ?? `Article ${id}`;
  const puce = 'money text-xs font-semibold text-ink-label bg-sunken border border-line-soft rounded-xs px-2 py-1';

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title={titre} backTo="/stock" backLabel="Retour au stock"
                  breadcrumb={[{ label: 'Stock', to: '/stock' }, { label: titre }]}
                  meta={a && (
                    <>
                      <Badge tone="neutral" shape="square" className="money">{a.code}</Badge>
                      {etat}
                    </>
                  )} />
      {error && <Alert tone="danger">{error.message}</Alert>}
      {loading && !a && <Card><Skeleton lines={2} /></Card>}

      {a && (
        <Card>
          <DescriptionList columns={3} items={[
            { label: 'Code', value: a.code, mono: true },
            { label: 'Famille', value: a.famille },
            ...(voirMarges ? [{ label: 'PMP', value: <Money value={a.pmp} /> }] : []),
            { label: 'P.V. TTC', value: <Money value={a.prix_vente_ttc} /> },
            ...(voirMarges ? [{ label: 'Marge %', value: <Money value={a.margep} digits={1} tone={Number(a.margep) < 0 ? 'danger' : 'success'} /> }] : []),
            { label: 'Stock réel', value: (
              <span className="inline-flex items-center gap-2">
                {q <= 0 || q <= min
                  ? <Badge tone={q <= 0 ? 'danger' : 'warning'} shape="square" size="md" className="money">{fmtQte(a.qte_reale)}</Badge>
                  : <span className="money font-extrabold text-lg">{fmtQte(a.qte_reale)}</span>}
                <span className="text-ink-muted text-xs font-normal">min {fmtQte(a.stock_min)}</span>
              </span>
            ) },
          ]} />
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3.5 items-start">
        {peut('stock', D.stock.lots) && (
          <div className="flex flex-col gap-2">
            <h2 className="font-bold text-md text-ink">Lots & péremption</h2>
            <DataGrid complet columns={lotCols} rows={lots} rowKey={(l) => l.id} loading={lotsLoading} emptyMessage="Aucun lot."
                      error={lotsErreur && !lotsData ? `Lots indisponibles : ${lotsErreur.message}` : undefined} />
          </div>
        )}
        <div className="flex flex-col gap-2">
          {/* Droit Delphi « Cacher l'onglet Tarifs » : masque les prix par quantité */}
          {!tarifsCaches && (
            <>
              <h2 className="font-bold text-md text-ink">Tarifs par quantité</h2>
              <DataGrid complet columns={tarifCols} rows={tarifs} rowKey={(_t, i) => i} emptyMessage="Aucun tarif par quantité." />
            </>
          )}
          <h2 className="font-bold text-md text-ink mt-2">Codes-barres</h2>
          <Card padding="sm" className="flex gap-2 flex-wrap items-center">
            {a?.code_bare && <span className={puce}>{a.code_bare}</span>}
            {barcodes.map((b, i) => {
              const row = b as Record<string, unknown>;
              const val = String(row.barcode ?? row.code_bare ?? row.code ?? b);
              return <span key={i} className={puce}>{val}</span>;
            })}
            {!a?.code_bare && barcodes.length === 0 && <span className="text-ink-muted text-sm">Aucun code-barres.</span>}
          </Card>
        </div>
      </div>

      {a && <FicheStockPanel articleId={articleId} />}
    </div>
  );
}
