import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useLazyQuery } from '@apollo/client';
import {
  ARTICLES, COORDONNEES_SOCIETE, REFERENTIELS,
  CREATE_ARTICLE, UPDATE_ARTICLE, DELETE_ARTICLE,
} from '../api/queries';
import { useCrud } from '../forms/useCrud';
import { buildArticleSections } from '../forms/schemas';
import PrintPreview from '../print/engine/PrintPreview';
import { PrintDocument } from '../print/engine/types';
import { buildStockPrint } from '../print/templates';
import { ArticlesResult, Article } from '../api/types';
import { fmtMoney, fmtQte } from '../lib/format';
import DataGrid, { Column } from '../components/ui/DataGrid';
import { ExportColumn } from '../lib/export';
import { Money, Tabs, PageHeader, Pagination, SearchInput, StatusPill } from '../components/ui/atoms';

const LIMIT = 50;
const VUES = [
  { code: 'tous', label: 'Articles' },
  { code: 'alerte', label: 'Stock en alerte' },
  { code: 'marge', label: 'Marge négative' },
] as const;

export default function Stock() {
  const navigate = useNavigate();
  const [vue, setVue] = useState<(typeof VUES)[number]['code']>('tous');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);

  const { data, loading, error, refetch } = useQuery(ARTICLES, {
    variables: {
      search: search || undefined,
      stock_alerte: vue === 'alerte' ? true : undefined,
      marge_negative: vue === 'marge' ? true : undefined,
      limit: LIMIT, offset,
    },
  });
  const res: ArticlesResult | undefined = data?.articles;
  const rows = res?.data ?? [];

  // Listes déroulantes du formulaire article (familles, dépôts, unités, TVA)
  const { data: refData } = useQuery(REFERENTIELS);
  const names = (list: unknown, keys: string[]) =>
    (Array.isArray(list) ? list : []).map((r: any) =>
      String(keys.map((k) => r?.[k]).find((v) => v != null && v !== '') ?? '')).filter(Boolean);
  const articleSections = buildArticleSections({
    familles: names(refData?.familles, ['nom', 'designation', 'famille', 'name']),
    depots:   names(refData?.depots,   ['nom', 'designation', 'depot', 'name']),
    unites:   names(refData?.unitesMesure, ['nom', 'designation', 'unite', 'name']),
    tva:      names(refData?.tauxTVA,  ['taux', 'valeur', 'tva', 'nom']),
  });
  const crud = useCrud<Article & { id: number }>({
    label: 'article', createTitle: 'Nouvel article', editTitle: "Modifier l'article", deleteTitle: 'Supprimer cet article ?', sections: articleSections, width: 820,
    createDoc: CREATE_ARTICLE, updateDoc: UPDATE_ARTICLE, deleteDoc: DELETE_ARTICLE,
    onDone: () => { void refetch(); },
    labelOf: (a) => `${a.designation} (${a.code})`,
    formExtra: (v) => <MatricePrix values={v} />,
  });

  const [printDoc, setPrintDoc] = useState<PrintDocument | null>(null);
  const { data: socData } = useQuery(COORDONNEES_SOCIETE);
  const [fetchAll, { loading: printing }] = useLazyQuery(ARTICLES, { fetchPolicy: 'network-only' });

  async function printEtat() {
    const { data: all } = await fetchAll({
      variables: {
        search: search || undefined,
        stock_alerte: vue === 'alerte' ? true : undefined,
        marge_negative: vue === 'marge' ? true : undefined,
        limit: 3000, offset: 0,
      },
    });
    const full: ArticlesResult | undefined = all?.articles;
    if (!full) return;
    const filtre = vue === 'alerte' ? 'Articles en alerte' : vue === 'marge' ? 'Marges négatives' : (search || undefined);
    setPrintDoc(buildStockPrint(
      { articles: full.data ?? [], filtre },
      (socData?.coordonneesSociete ?? {}) as Record<string, unknown>,
    ));
  }

  const columns: Column<Article>[] = [
    { key: 'code', header: 'Code', width: '110px', render: (a) => <span className="money">{a.code}</span> },
    { key: 'designation', header: 'Désignation', render: (a) => <b>{a.designation}</b> },
    { key: 'famille', header: 'Famille', width: '120px', render: (a) => <span className="text-ink-muted">{a.famille ?? '—'}</span> },
    { key: 'pmp', header: 'PMP', align: 'right', width: '95px', render: (a) => <Money value={a.pmp} /> },
    { key: 'pv', header: 'P.V. TTC', align: 'right', width: '95px', render: (a) => <Money value={a.prix_vente_ttc} /> },
    { key: 'margep', header: 'Marge %', align: 'right', width: '80px', render: (a) => (
      <span className="money" style={{ color: Number(a.margep) < 0 ? 'var(--danger)' : undefined }}>{fmtMoney(a.margep, 1)}</span>
    ) },
    { key: 'qte', header: 'Stock', align: 'right', width: '85px', render: (a) => {
      const q = Number(a.qte_reale ?? 0), min = Number(a.stock_min ?? 0);
      return <span className="money font-semibold" style={{ color: q <= 0 ? 'var(--danger)' : q <= min ? 'var(--warning)' : undefined }}>{fmtQte(q)}</span>;
    } },
    { key: 'etat', header: 'État', width: '90px', render: (a) => {
      const q = Number(a.qte_reale ?? 0), min = Number(a.stock_min ?? 0);
      if (q <= 0) return <StatusPill tone="bad">Rupture</StatusPill>;
      if (min > 0 && q <= min) return <StatusPill tone="warn">Stock bas</StatusPill>;
      return <StatusPill tone="ok">OK</StatusPill>;
    } },
    { key: 'actions', header: '', align: 'right', width: '70px', render: (a) => crud.rowActions(a as Article & { id: number }) },
  ];

  const csvStock: ExportColumn<Article>[] = [
    { header: 'Code', value: (a) => a.code },
    { header: 'Désignation', value: (a) => (a.designation ?? '').replace(/\s+/g, ' ').trim() },
    { header: 'Famille', value: (a) => a.famille ?? '' },
    { header: 'PMP', value: (a) => a.pmp, numeric: true },
    { header: 'P.V. TTC', value: (a) => a.prix_vente_ttc, numeric: true },
    { header: 'Marge %', value: (a) => a.margep, numeric: true },
    { header: 'Stock', value: (a) => a.qte_reale, numeric: true },
    { header: 'Stock min', value: (a) => a.stock_min, numeric: true },
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title="Articles & stock">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setOffset(0); }} placeholder="Code, désignation, code-barres…" />
        <button onClick={() => void printEtat()} disabled={printing}
                className="rounded-md px-3 py-2 font-bold text-[12px] border border-line text-ink-label disabled:opacity-60">
          {printing ? 'Préparation…' : "Imprimer l'état du stock"}
        </button>
        <button onClick={() => navigate('/stock/inventaires')}
                className="rounded-md px-3 py-2 font-bold text-[12px] border border-line text-ink-label">
          Inventaires
        </button>
        <button onClick={crud.openCreate}
                className="rounded-md px-4 py-2 font-bold text-[12px] text-white bg-brand-700">
          ＋ Nouvel article
        </button>
      </PageHeader>
      {crud.modals}
      {printDoc && <PrintPreview doc={printDoc} onClose={() => setPrintDoc(null)} />}
      <Tabs value={vue} onChange={(v) => { setVue(v); setOffset(0); }} options={VUES} />
      <DataGrid columns={columns} rows={rows} rowKey={(a) => a.id} loading={loading} error={error?.message}
                exportCsv={{ nom: 'articles-stock', columns: csvStock }}
                onRowClick={(a) => navigate(`/stock/article/${a.id}`)}
                footer={{ _label: `${res?.total ?? 0} article(s)` }} />
      {res && res.total > LIMIT && <Pagination offset={offset} limit={LIMIT} total={res.total} onOffset={setOffset} />}
    </div>
  );
}

/**
 * Aperçu calculé des 4 prix de vente : pour chaque tier, TTC (via TVA), marge et
 * marge % (relative au prix d'achat, comme l'agent). Purement réactif aux
 * valeurs du formulaire — n'envoie rien au serveur, qui recalcule de son côté.
 */
function MatricePrix({ values }: { values: Record<string, unknown> }) {
  const n = (k: string) => Number(values[k] ?? 0) || 0;
  const achat = n('prix_achat_ht');
  const tva = n('tva');
  const tiers = [
    { label: 'Prix 1 (principal)', ht: n('prix_vente_ht') },
    { label: 'Prix 2',             ht: n('prix_vente_ht1') },
    { label: 'Prix 3',             ht: n('prix_vente_ht2') },
    { label: 'Prix 4',             ht: n('prix_vente_ht3') },
  ];
  return (
    <section>
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-ink-muted mb-2">
        Aperçu des marges (calcul automatique)
      </h3>
      <div className="border border-line-soft rounded-md overflow-hidden">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr>
              {['Tarif', 'P.V. HT', 'P.V. TTC', 'Marge', 'Marge %'].map((h, i) => (
                <th key={h} className={`text-[10px] font-bold uppercase tracking-wider text-ink-muted bg-bg border-b border-line-soft px-3 py-1.5 ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tiers.map((t) => {
              const ttc = t.ht * (1 + tva / 100);
              const marge = t.ht - achat;
              const margep = achat > 0 ? (marge / achat) * 100 : 0;
              const neg = marge < 0;
              return (
                <tr key={t.label} className="border-b border-line-soft last:border-b-0">
                  <td className="px-3 py-1.5 font-semibold">{t.label}</td>
                  <td className="px-3 py-1.5 text-right money">{fmtMoney(t.ht)}</td>
                  <td className="px-3 py-1.5 text-right money">{fmtMoney(ttc)}</td>
                  <td className="px-3 py-1.5 text-right money" style={{ color: neg ? 'var(--danger)' : 'var(--success)' }}>{fmtMoney(marge)}</td>
                  <td className="px-3 py-1.5 text-right money" style={{ color: neg ? 'var(--danger)' : undefined }}>{fmtQte(margep)} %</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-[10.5px] text-ink-muted mt-1">
        La marge % est calculée par rapport au prix d'achat HT. Le serveur enregistre les 4 prix et recalcule TTC/marges.
      </div>
    </section>
  );
}
