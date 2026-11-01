import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApolloClient, useQuery, useLazyQuery } from '@apollo/client';
import {
  ARTICLES, COORDONNEES_SOCIETE, REFERENTIELS,
  CREATE_ARTICLE, UPDATE_ARTICLE, DELETE_ARTICLE,
} from '../api/queries';
import { useCrud } from '../forms/useCrud';
import PeremptionPanel from '../components/PeremptionPanel';
import { D, useDroits } from '../lib/droits';
import { buildArticleSections } from '../forms/schemas';
import ImprimerDocument from '../impression/ImprimerDocument';
import type { DemandeImpression } from '../impression/demandes';
import { demandeStock } from '../impression/demandes';
import { ArticlesResult, Article } from '../api/types';
import { fmtMoney, fmtQte } from '../lib/format';
import DataGrid, { Column, DataGridDistant } from '../components/ui/DataGrid';
import { ExportColumn } from '../lib/export';
import { Badge, Money, Tabs, PageHeader, StatusPill, Toolbar } from '../components/ui/atoms';
import { Button } from '../components/ui/Button';
import { SearchField } from '../components/ui/Field';
import { SectionTitle } from '../components/ui/Card';
import ApercuArticle from '../components/document/ApercuArticle';
import ApercuDisposition, { BoutonApercu } from '../components/document/ApercuDisposition';
import { useApercu } from '../components/document/useApercu';

const VUES = [
  { code: 'tous', label: 'Articles' },
  { code: 'alerte', label: 'Stock en alerte' },
  { code: 'marge', label: 'Marge négative' },
  { code: 'peremption', label: 'Péremption' },
] as const;

export default function Stock() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { peut, peutUn, voirMarges } = useDroits();
  // Vues autorisées : alerte, lots (péremption) et marges suivent les droits, y compris par lien direct
  const vuesAutorisees = VUES.filter((v) => (v.code !== 'alerte' || peut('stock', D.stock.alerte))
    && (v.code !== 'peremption' || peut('stock', D.stock.lots)) && (v.code !== 'marge' || voirMarges));
  const vueDemandee = (code: string | null) => vuesAutorisees.find((v) => v.code === code)?.code ?? 'tous';
  const [vue, setVue] = useState<(typeof VUES)[number]['code']>(() => vueDemandee(params.get('vue')));
  // Liens directs (ruban) : ?vue=alerte, ?vue=peremption… — ignorés sans le droit correspondant
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setVue(vueDemandee(params.get('vue'))); }, [params, vuesAutorisees.length]);
  const [search, setSearch] = useState('');
  // Incrémenté après création / modification / suppression : relit la liste
  const [version, setVersion] = useState(0);

  const client = useApolloClient();
  const stockAlerte = vue === 'alerte' ? true : undefined;
  const margeNegative = vue === 'marge' ? true : undefined;
  // Tri, filtres, recherche, pagination et groupes faits par le serveur
  const distant = useMemo<DataGridDistant<Article>>(() => ({
    cle: JSON.stringify([search, stockAlerte, margeNegative, version]),
    charger: async (grille) => {
      const { data } = await client.query({
        query: ARTICLES, fetchPolicy: 'network-only',
        variables: { search: search || undefined, stock_alerte: stockAlerte, marge_negative: margeNegative, grille },
      });
      return data.articles as ArticlesResult;
    },
  }), [client, search, stockAlerte, margeNegative, version]);

  // Aperçu rapide (désactivé par défaut) : clic = aperçu, double-clic / Entrée = ouvrir la fiche.
  // La vue fait partie de la clé : changer d'onglet vide la sélection.
  const ouvrirArticle = (a: Article) => navigate(`/stock/article/${a.id}`);
  const apercu = useApercu<Article>('articles', ouvrirArticle, `${vue}|${distant.cle}`);

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
    onDone: () => setVersion((v) => v + 1),
    labelOf: (a) => `${a.designation} (${a.code})`,
    formExtra: (v) => <MatricePrix values={v} />,
    peutModifier: peut('stock', D.stock.modifierArticle),
    peutSupprimer: peut('stock', D.stock.supprimerArticle),
  });

  const [printDoc, setPrintDoc] = useState<DemandeImpression | null>(null);
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
    setPrintDoc(demandeStock(
      { articles: full.data ?? [], filtre },
      (socData?.coordonneesSociete ?? {}) as Record<string, unknown>,
    ));
  }

  const columns: Column<Article>[] = [
    { key: 'code', header: 'Code', width: '110px', field: 'code', render: (a) => <span className="money">{a.code}</span> },
    { key: 'designation', header: 'Désignation', field: 'designation', render: (a) => <b>{a.designation}</b> },
    { key: 'famille', header: 'Famille', width: '120px', field: 'famille', render: (a) => <span className="text-ink-muted">{a.famille ?? '—'}</span> },
    // Coûts et marges : seulement avec le droit « bénéfice »
    ...(voirMarges ? [{ key: 'pmp', header: 'PMP', align: 'right' as const, width: '95px', field: 'pmp', render: (a: Article) => <Money value={a.pmp} /> }] : []),
    { key: 'pv', header: 'P.V. TTC', align: 'right', width: '95px', field: 'prix_vente_ttc', render: (a) => <Money value={a.prix_vente_ttc} /> },
    ...(voirMarges ? [{ key: 'margep', header: 'Marge %', align: 'right' as const, width: '80px', field: 'margep', render: (a: Article) => (
      <Money value={a.margep} digits={1} />
    ) }] : []),
    { key: 'qte', header: 'Stock', align: 'right', width: '85px', field: 'qte_reale', type: 'number', render: (a) => {
      const q = Number(a.qte_reale ?? 0), min = Number(a.stock_min ?? 0);
      if (q <= 0 || q <= min) {
        return <Badge tone={q <= 0 ? 'danger' : 'warning'} shape="square" size="md" className="money">{fmtQte(q)}</Badge>;
      }
      return <span className="money font-semibold">{fmtQte(q)}</span>;
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
    ...(voirMarges ? [{ header: 'PMP', value: (a: Article) => a.pmp, numeric: true }] : []),
    { header: 'P.V. TTC', value: (a) => a.prix_vente_ttc, numeric: true },
    ...(voirMarges ? [{ header: 'Marge %', value: (a: Article) => a.margep, numeric: true }] : []),
    { header: 'Stock', value: (a) => a.qte_reale, numeric: true },
    { header: 'Stock min', value: (a) => a.stock_min, numeric: true },
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title="Articles & stock" icon="package">
        <Button icon="printer" onClick={() => void printEtat()} loading={printing}>
          {printing ? 'Préparation…' : "Imprimer l'état du stock"}
        </Button>
        {peut('stock', D.stock.inventaire) && (
          <Button icon="inventory" onClick={() => navigate('/stock/inventaires')}>Inventaires</Button>
        )}
        {peutUn('stock', [D.stock.bonEntree, D.stock.bonSortie]) && (
          <Button icon="movements" onClick={() => navigate('/stock/mouvements')}>Mouvements</Button>
        )}
        {peut('stock', D.stock.creerArticle) && (
          <Button variant="primary" icon="plus" onClick={crud.openCreate}>Nouvel article</Button>
        )}
      </PageHeader>
      {crud.modals}
      {printDoc && <ImprimerDocument demande={printDoc} onClose={() => setPrintDoc(null)} />}
      <Toolbar>
        <Tabs value={vue} onChange={setVue} label="Vue"
              options={vuesAutorisees} />
        <SearchField value={search} onChange={setSearch} placeholder="Code, désignation, code-barres…"
                     label="Rechercher un article" className="ml-auto" />
      </Toolbar>
      {vue === 'peremption' ? <PeremptionPanel /> : (
        <>
          <ApercuDisposition apercu={apercu} libelle="Aperçu de l'article"
                             panneau={(fermer) => (
                               <ApercuArticle article={apercu.selection} onFermer={fermer}
                                              onOuvrir={() => apercu.selection && ouvrirArticle(apercu.selection)} />
                             )}>
            <DataGrid columns={columns} rowKey={(a) => a.id}
                      distant={distant} cleEtat="stock-articles"
                      exportCsv={{ nom: 'articles-stock', columns: csvStock }}
                      actions={<BoutonApercu apercu={apercu} objet={{ de: "de l'article", le: 'la fiche' }} />}
                      {...apercu.propsGrille()}
                      footer={(r) => ({ _label: `${r?.total ?? 0} article(s)` })} />
          </ApercuDisposition>
        </>
      )}
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
      <SectionTitle>Aperçu des marges (calcul automatique)</SectionTitle>
      <div className="border border-line-soft rounded-md overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              {['Tarif', 'P.V. HT', 'P.V. TTC', 'Marge', 'Marge %'].map((h, i) => (
                <th key={h} className={`text-2xs font-bold uppercase tracking-wider text-ink-muted bg-bg border-b border-line-soft px-3 py-1.5 ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
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
                  <td className="px-3 py-1.5 text-right money" style={{ color: neg ? 'var(--danger-text)' : 'var(--success-text)' }}>{fmtMoney(marge)}</td>
                  <td className="px-3 py-1.5 text-right money" style={{ color: neg ? 'var(--danger-text)' : undefined }}>{fmtQte(margep)} %</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-ink-muted mt-1">
        La marge % est calculée par rapport au prix d'achat HT. Le serveur enregistre les 4 prix et recalcule TTC/marges.
      </div>
    </section>
  );
}
