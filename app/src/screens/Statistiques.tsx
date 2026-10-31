import { ReactNode, useMemo, useState } from 'react';
import { useApolloClient, useQuery } from '@apollo/client';
import ImprimerDocument from '../impression/ImprimerDocument';
import type { DemandeImpression } from '../impression/demandes';
import { demandeTicketVentes } from '../impression/demandes';
import {
  STAT_VENTES, STAT_VENTES_PAR_FAMILLE, STAT_VENTES_PAR_UTILISATEUR, STAT_VENTES_PAR_ARTICLE, STAT_VENTES_PAR_CLIENT,
  COORDONNEES_SOCIETE, BENEFICES, STAT_ACHATS, STAT_ACHATS_PAR_FOURNISSEUR, STAT_ACHATS_PAR_ARTICLE, STAT_STOCK,
} from '../api/queries';
import {
  Client,
  StatVentesResult, StatVenteLigne, StatParFamille, StatArticleVente, StatClient,
  BeneficesResult, BeneficeLigne, StatAchatsResult, StatAchatLigne, StatFournisseur,
  StatArticleAchat, StatStockLigne,
} from '../api/types';
import { fmtMoney, isoFirstOfMonth, isoToday } from '../lib/format';
import { exporterCsv, ExportColumn } from '../lib/export';
import { useDebouncedValue } from '../lib/useDebounce';
import DataGrid, { Column, DataGridDistant, totalDistant } from '../components/ui/DataGrid';
import { ReponseDistante } from '../components/grille/types';
import { Money, Tabs, PageHeader, Toolbar } from '../components/ui/atoms';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { DateRangeField, SearchField, Select } from '../components/ui/Field';
import { KpiTile } from '../components/ui/Kpi';
import type { IconName, Tone } from '../components/ui/Icon';
import LineChart from '../components/charts/LineChart';
import BarChart from '../components/charts/BarChart';
import DonutChart from '../components/charts/DonutChart';
import ClientSearch from '../components/ClientSearch';
import { D, useDroits } from '../lib/droits';
import Etat104Panel from '../components/Etat104Panel';

/** Cartouche graphique réutilisable (titre + corps). */
function Carte({ titre, actions, icon, children }: { titre: string; actions?: ReactNode; icon?: IconName; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={titre} actions={actions} icon={icon} className="items-center" />
      {children}
    </Card>
  );
}

const SECTIONS = [
  { code: 'ventes', label: 'Ventes', icon: 'trend' },
  { code: 'achats', label: 'Achats', icon: 'cart' },
  { code: 'benefices', label: 'Bénéfices', icon: 'stats' },
  { code: 'stock', label: 'Valorisation du stock', icon: 'package' },
  { code: 'etat104', label: 'État 104', icon: 'statement' },
] as const;
type Section = (typeof SECTIONS)[number]['code'];

const GROUPEMENTS = [
  { code: 'jour', label: 'Par jour' },
  { code: 'mois', label: 'Par mois' },
  { code: 'annee', label: 'Par année' },
] as const;
type Groupement = (typeof GROUPEMENTS)[number]['code'];

export default function Statistiques() {
  const { peut } = useDroits();
  // « Bénéfice Statistique » (Delphi) conditionne l'accès aux marges et bénéfices
  const sections = SECTIONS.filter((x) => x.code !== 'benefices' || peut('autre', D.autre.beneficeStat));
  const [section, setSection] = useState<Section>('ventes');
  const [debut, setDebut] = useState(isoFirstOfMonth());
  const [fin, setFin] = useState(isoToday());

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title="Statistiques" icon="stats" description="Ventes, achats, marges et valorisation du stock">
        {section !== 'stock' && section !== 'etat104' && (
          <DateRangeField from={debut} to={fin} onChange={(d, f) => { setDebut(d); setFin(f); }} />
        )}
      </PageHeader>
      <Tabs value={section} onChange={setSection} options={sections} label="Sections des statistiques" />
      {section === 'ventes' && <SectionVentes debut={debut} fin={fin} />}
      {section === 'achats' && <SectionAchats debut={debut} fin={fin} />}
      {section === 'benefices' && sections.some((x) => x.code === 'benefices') && <SectionBenefices debut={debut} fin={fin} />}
      {section === 'stock' && <SectionStock />}
      {section === 'etat104' && <Etat104Panel />}
    </div>
  );
}

/* ─── Ventes ────────────────────────────────────────────────────────────────── */

const VUES_VENTES = [
  { code: 'periode', label: 'Par période' },
  { code: 'article', label: 'Par article' },
  { code: 'client', label: 'Par client' },
  { code: 'famille', label: 'Par famille' },
  { code: 'utilisateur', label: 'Par utilisateur' },
] as const;

/** « Mes ventes » : CA et marge par vendeur (les retours sont déduits), totaux = CA de la période. */
function VueParUtilisateur({ debut, fin }: { debut: string; fin: string }) {
  const { data, loading, error } = useQuery(STAT_VENTES_PAR_UTILISATEUR, { variables: { date_debut: debut, date_fin: fin } });
  const lignes: any[] = data?.statVentesParUtilisateur?.lignes ?? [];
  const cols: Column<any>[] = [
    { key: 'user', header: 'Vendeur', render: (l) => <b>{String(l.utilisateur)}</b> },
    { key: 'pieces', header: 'Pièces', align: 'right', width: '90px', render: (l) => <span className="money">{l.nb_pieces}</span> },
    { key: 'ht', header: 'CA HT', align: 'right', render: (l) => <Money value={l.total_ht} />, sortAccessor: (l) => Number(l.total_ht) },
    { key: 'ttc', header: 'CA TTC', align: 'right', render: (l) => <Money value={l.total_ttc} />, sortAccessor: (l) => Number(l.total_ttc) },
    { key: 'marge', header: 'Marge', align: 'right', render: (l) => <Money value={l.total_marge} />, sortAccessor: (l) => Number(l.total_marge) },
    { key: 'pct', header: '%', align: 'right', width: '70px', render: (l) => <Pct value={l.pct_marge} />, sortAccessor: (l) => Number(l.pct_marge) },
  ];
  return (
    <DataGrid titre="Mes ventes — par vendeur" columns={cols} rows={lignes} rowKey={(l) => String(l.utilisateur)}
              loading={loading} error={error?.message}
              footer={{ _label: 'Totaux', ttc: <Money value={somme(lignes, 'total_ttc')} /> }} />
  );
}

function SectionVentes({ debut, fin }: { debut: string; fin: string }) {
  const [vue, setVue] = useState<(typeof VUES_VENTES)[number]['code']>('periode');
  const [groupement, setGroupement] = useState<Groupement>('jour');
  // Filtres appliqués CÔTÉ SERVEUR (paramètres des requêtes stat).
  const [famille, setFamille] = useState('');
  const [clientFiltre, setClientFiltre] = useState<Client | null>(null);
  const periode = { date_debut: debut, date_fin: fin };
  const filtreFam = famille || undefined;

  // statVentes agrège au niveau document (parité Delphi) : le filtre famille (ligne)
  // ne s'y applique pas ; il vaut pour les vues article/client (serveur).
  const { data, loading, error } = useQuery(STAT_VENTES, { variables: { ...periode, groupement } });
  const res: StatVentesResult | undefined = data?.statVentes;

  const art = useQuery(STAT_VENTES_PAR_ARTICLE, { variables: { ...periode, famille: filtreFam, code_cli: clientFiltre?.code || undefined }, skip: vue !== 'article' });
  const cli = useQuery(STAT_VENTES_PAR_CLIENT, { variables: { ...periode, famille: filtreFam }, skip: vue !== 'client' });
  // Toujours chargée : alimente à la fois les options du filtre et les graphiques familles.
  const fam = useQuery(STAT_VENTES_PAR_FAMILLE, { variables: periode });

  const articles: StatArticleVente[] = Array.isArray(art.data?.statVentesParArticle) ? art.data.statVentesParArticle : [];
  const clients: StatClient[] = Array.isArray(cli.data?.statVentesParClient) ? cli.data.statVentesParClient : [];
  const famillesTout: StatParFamille[] = Array.isArray(fam.data?.statVentesParFamille) ? fam.data.statVentesParFamille : [];
  const familles = filtreFam ? famillesTout.filter((f) => f.famille === famille) : famillesTout;
  // Ticket caisse « Articles vendus » / « Familles vendues » (même période et filtres que l'écran)
  const [ticket, setTicket] = useState<DemandeImpression | null>(null);
  const { data: socData } = useQuery(COORDONNEES_SOCIETE);
  function imprimerTicket(v: 'article' | 'famille') {
    const estArticle = v === 'article';
    setTicket(demandeTicketVentes({
      titre: estArticle ? 'ARTICLES VENDUS' : 'FAMILLES VENDUES',
      debut, fin,
      lignes: estArticle
        ? articles.map((a) => ({ libelle: a.designation, qte: Number(a.qte), total_ttc: Number(a.total_ttc) }))
        : familles.map((f) => ({ libelle: f.famille || '(sans famille)', qte: Number(f.qte), total_ttc: Number(f.total_ttc) })),
      societe: (socData?.coordonneesSociete ?? {}) as Record<string, unknown>,
    }));
  }
  const optionsFamille = famillesTout.map((f) => f.famille).filter(Boolean).sort();

  const colPeriode: Column<StatVenteLigne>[] = [
    { key: 'periode', header: 'Période', render: (l) => <b className="money">{l.periode}</b> },
    { key: 'ht', header: 'Total HT', align: 'right', render: (l) => <Money value={l.total_ht} /> },
    { key: 'ttc', header: 'Total TTC', align: 'right', render: (l) => <Money value={l.total_ttc} /> },
    { key: 'remise', header: 'Remises', align: 'right', render: (l) => <Money value={l.remise} /> },
    { key: 'marge', header: 'Marge', align: 'right', render: (l) => <MargeCell value={l.total_marge} /> },
  ];

  const colArticle: Column<StatArticleVente>[] = [
    { key: 'code', header: 'Code', width: '90px', render: (a) => <span className="money">{a.code_article}</span>, sortAccessor: (a) => a.code_article },
    { key: 'des', header: 'Désignation', render: (a) => <b>{(a.designation ?? '').trim() || '—'}</b>, sortAccessor: (a) => (a.designation ?? '').trim() },
    { key: 'fam', header: 'Famille', width: '130px', render: (a) => <span className="text-ink-muted">{a.famille || '—'}</span>, sortAccessor: (a) => a.famille ?? '' },
    { key: 'qte', header: 'Qté', align: 'right', width: '80px', render: (a) => <span className="money">{fmtMoney(a.qte, 2)}</span>, sortAccessor: (a) => Number(a.qte) },
    { key: 'ht', header: 'CA HT', align: 'right', width: '120px', render: (a) => <Money value={a.total_ht} />, sortAccessor: (a) => Number(a.total_ht) },
    { key: 'marge', header: 'Marge', align: 'right', width: '120px', render: (a) => <MargeCell value={a.total_marge} />, sortAccessor: (a) => Number(a.total_marge) },
    { key: 'pct', header: '%', align: 'right', width: '70px', render: (a) => <Pct value={a.pct_marge} />, sortAccessor: (a) => Number(a.pct_marge) },
  ];

  const colClient: Column<StatClient>[] = [
    { key: 'code', header: 'Code', width: '80px', render: (c) => <span className="money">{c.code_cli}</span>, sortAccessor: (c) => c.code_cli },
    { key: 'raison', header: 'Client', render: (c) => <b>{(c.raison ?? '').trim() || '—'}</b>, sortAccessor: (c) => (c.raison ?? '').trim() },
    { key: 'nb', header: 'Pièces', align: 'right', width: '80px', render: (c) => <span className="money">{c.nb_factures}</span>, sortAccessor: (c) => Number(c.nb_factures) },
    { key: 'ht', header: 'CA HT', align: 'right', width: '130px', render: (c) => <Money value={c.total_ht} />, sortAccessor: (c) => Number(c.total_ht) },
    { key: 'ttc', header: 'CA TTC', align: 'right', width: '130px', render: (c) => <Money value={c.total_ttc} />, sortAccessor: (c) => Number(c.total_ttc) },
    { key: 'marge', header: 'Marge', align: 'right', width: '120px', render: (c) => <MargeCell value={c.total_marge} />, sortAccessor: (c) => Number(c.total_marge) },
    { key: 'pct', header: '%', align: 'right', width: '70px', render: (c) => <Pct value={c.pct_marge} />, sortAccessor: (c) => Number(c.pct_marge) },
  ];

  const colFamille: Column<StatParFamille>[] = [
    { key: 'fam', header: 'Famille', render: (f) => <b>{f.famille || '(sans famille)'}</b>, sortAccessor: (f) => f.famille ?? '' },
    { key: 'ht', header: 'CA HT', align: 'right', render: (f) => <Money value={f.total_ht} />, sortAccessor: (f) => Number(f.total_ht) },
    { key: 'ttc', header: 'CA TTC', align: 'right', render: (f) => <Money value={f.total_ttc} />, sortAccessor: (f) => Number(f.total_ttc) },
    { key: 'marge', header: 'Marge', align: 'right', render: (f) => <MargeCell value={f.total_marge} />, sortAccessor: (f) => Number(f.total_marge) },
  ];

  return (
    <>
      {ticket && <ImprimerDocument demande={ticket} onClose={() => setTicket(null)} />}
      {res && (
        <div className="grid grid-cols-4 gap-3">
          <Kpi label="CA TTC" icon="trend" value={`${fmtMoney(res.total_ttc)} DA`} />
          <Kpi label="Marge brute" icon="stats" tone="success" value={`${fmtMoney(res.total_marge)} DA`} sub={`${fmtMoney(res.pct_marge_global, 1)} % du CA HT`} />
          <Kpi label="Charges période" icon="trendDown" tone="warning" value={`${fmtMoney(res.total_charges)} DA`} />
          <Kpi label="Marge nette" icon="wallet" tone="teal" value={`${fmtMoney(res.marge_nette_total)} DA`}
               sub={`${fmtMoney(Number(res.total_ht) > 0 ? (Number(res.marge_nette_total) / Number(res.total_ht)) * 100 : 0, 1)} % du CA HT`} />
        </div>
      )}
      <Tabs value={vue} onChange={setVue} options={VUES_VENTES} variant="underline" label="Vues des ventes" />
      {(vue === 'article' || vue === 'famille' || vue === 'client') && (
        <Toolbar>
          {vue === 'article' && (
            <div className="w-64"><ClientSearch value={clientFiltre} onSelect={setClientFiltre} /></div>
          )}
          {(vue === 'article' || vue === 'client') && (
            <label className="text-xs font-semibold text-ink-label flex items-center gap-2">
              Famille
              <Select size="sm" value={famille} onChange={(e) => setFamille(e.target.value)} className="w-auto min-w-[160px]">
                <option value="">Toutes</option>
                {optionsFamille.map((f) => <option key={f} value={f}>{f}</option>)}
              </Select>
            </label>
          )}
          {(vue === 'article' || vue === 'famille') && (
            <Button size="sm" icon="printer" className="ml-auto" onClick={() => imprimerTicket(vue)}>
              Imprimer le ticket
            </Button>
          )}
        </Toolbar>
      )}

      {vue === 'periode' && (
        <>
          <Carte titre={`Évolution du CA TTC ${groupement === 'jour' ? '— par jour' : '— par mois'}`} icon="trend"
                 actions={<Tabs value={groupement} onChange={setGroupement} options={GROUPEMENTS} size="sm" label="Groupement" />}>
            <LineChart data={(res?.lignes ?? []).map((l) => ({ label: l.periode, value: Number(l.total_ttc ?? 0) }))}
                       format={(v) => fmtMoney(v, 0)} />
          </Carte>
          <DataGrid titre={`Ventes ${groupement === 'jour' ? 'par jour' : 'par mois'}`}
                    exportCsv={{ nom: 'ventes-par-periode', columns: csvPeriode }}
                    columns={colPeriode} rows={res?.lignes ?? []} rowKey={(l) => l.periode}
                    loading={loading} error={error?.message}
                    footer={{ _label: 'Totaux', ht: <Money value={res?.total_ht} />, ttc: <Money value={res?.total_ttc} />, marge: <Money value={res?.total_marge} /> }} />
        </>
      )}

      {vue === 'article' && (
        <DataGrid titre={`Ventes par article — ${articles.length} article(s)`} exportCsv={{ nom: 'ventes-par-article', columns: csvArticleVente }} columns={colArticle} rows={articles} rowKey={(a) => a.code_article}
                    loading={art.loading} error={art.error?.message}
                    footer={{ _label: 'Totaux', ht: <Money value={somme(articles, 'total_ht')} />, marge: <Money value={somme(articles, 'total_marge')} /> }} />
        
      )}

      {vue === 'client' && (
        <DataGrid titre={`Ventes par client — ${clients.length} client(s)`} exportCsv={{ nom: 'ventes-par-client', columns: csvClient }} columns={colClient} rows={clients} rowKey={(c) => c.code_cli}
                    loading={cli.loading} error={cli.error?.message}
                    footer={{ _label: 'Totaux', ht: <Money value={somme(clients, 'total_ht')} />, ttc: <Money value={somme(clients, 'total_ttc')} />, marge: <Money value={somme(clients, 'total_marge')} /> }} />
        
      )}

      {vue === 'utilisateur' && <VueParUtilisateur debut={debut} fin={fin} />}

      {vue === 'famille' && (
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3.5 items-start">
            <Carte titre="Top familles — CA TTC" icon="stats">
              <BarChart data={famillesTout.map((f) => ({ label: f.famille || '(sans famille)', value: Number(f.total_ttc ?? 0) }))}
                        format={(v) => fmtMoney(v, 0)} />
            </Carte>
            <Carte titre="Répartition du CA TTC" icon="pie">
              <DonutChart data={famillesTout.map((f) => ({ label: f.famille || '(sans famille)', value: Number(f.total_ttc ?? 0) }))}
                          format={(v) => fmtMoney(v, 0)} titreCentre="CA TTC" />
            </Carte>
          </div>
          <DataGrid titre="Ventes par famille" exportCsv={{ nom: 'ventes-par-famille', columns: csvFamille }} columns={colFamille} rows={familles} rowKey={(f) => f.famille ?? '—'}
                    loading={fam.loading} error={fam.error?.message}
                    footer={{ _label: 'Totaux', ht: <Money value={somme(familles, 'total_ht')} />, ttc: <Money value={somme(familles, 'total_ttc')} /> }} />
        </div>
      )}
    </>
  );
}

/* ─── Achats ────────────────────────────────────────────────────────────────── */

const VUES_ACHATS = [
  { code: 'periode', label: 'Par période' },
  { code: 'fournisseur', label: 'Par fournisseur' },
  { code: 'article', label: 'Par article' },
] as const;

function SectionAchats({ debut, fin }: { debut: string; fin: string }) {
  const [vue, setVue] = useState<(typeof VUES_ACHATS)[number]['code']>('periode');
  const [groupement, setGroupement] = useState<Groupement>('mois');
  // Filtre fournisseur appliqué CÔTÉ SERVEUR (param de statAchatsParArticle).
  const [codeFour, setCodeFour] = useState('');
  const periode = { date_debut: debut, date_fin: fin };

  const { data, loading, error } = useQuery(STAT_ACHATS, { variables: { ...periode, groupement } });
  const res: StatAchatsResult | undefined = data?.statAchats;

  // Toujours chargée : alimente les graphiques fournisseur ET les options du filtre.
  const four = useQuery(STAT_ACHATS_PAR_FOURNISSEUR, { variables: periode });
  const art = useQuery(STAT_ACHATS_PAR_ARTICLE, { variables: { ...periode, code_four: codeFour || undefined }, skip: vue !== 'article' });
  const fournisseurs: StatFournisseur[] = Array.isArray(four.data?.statAchatsParFournisseur) ? four.data.statAchatsParFournisseur : [];
  const articles: StatArticleAchat[] = Array.isArray(art.data?.statAchatsParArticle) ? art.data.statAchatsParArticle : [];

  const colPeriode: Column<StatAchatLigne>[] = [
    { key: 'periode', header: 'Période', render: (l) => <b className="money">{l.periode}</b> },
    { key: 'nb', header: 'Pièces', align: 'right', width: '80px', render: (l) => <span className="money">{l.nb_factures}</span> },
    { key: 'qte', header: 'Qté', align: 'right', width: '90px', render: (l) => <span className="money">{fmtMoney(l.qte, 2)}</span> },
    { key: 'ht', header: 'Achats HT', align: 'right', render: (l) => <Money value={l.total_ht} /> },
    { key: 'ttc', header: 'Achats TTC', align: 'right', render: (l) => <Money value={l.total_ttc} /> },
    { key: 'ret', header: 'Retours HT', align: 'right', render: (l) => (
      <span className="money" style={{ color: Number(l.r_total_ht) > 0 ? 'var(--danger-text)' : undefined }}>{fmtMoney(l.r_total_ht)}</span>
    ) },
  ];

  const colFournisseur: Column<StatFournisseur>[] = [
    { key: 'code', header: 'Code', width: '80px', render: (f) => <span className="money">{f.code_four}</span>, sortAccessor: (f) => f.code_four },
    { key: 'nom', header: 'Fournisseur', render: (f) => <b>{(f.fournisseur ?? '').trim() || '—'}</b>, sortAccessor: (f) => (f.fournisseur ?? '').trim() },
    { key: 'nb', header: 'Pièces', align: 'right', width: '80px', render: (f) => <span className="money">{f.nb_factures}</span>, sortAccessor: (f) => Number(f.nb_factures) },
    { key: 'ht', header: 'Achats HT', align: 'right', width: '130px', render: (f) => <Money value={f.total_ht} />, sortAccessor: (f) => Number(f.total_ht) },
    { key: 'ttc', header: 'Achats TTC', align: 'right', width: '130px', render: (f) => <Money value={f.total_ttc} />, sortAccessor: (f) => Number(f.total_ttc) },
    { key: 'reste', header: 'Reste à payer', align: 'right', width: '130px', render: (f) => (
      <span className="money font-medium" style={{ color: Number(f.reste_a_payer) > 0 ? 'var(--danger-text)' : undefined }}>{fmtMoney(f.reste_a_payer)}</span>
    ), sortAccessor: (f) => Number(f.reste_a_payer) },
  ];

  const colArticle: Column<StatArticleAchat>[] = [
    { key: 'code', header: 'Code', width: '90px', render: (a) => <span className="money">{a.code_article}</span>, sortAccessor: (a) => a.code_article },
    { key: 'des', header: 'Désignation', render: (a) => <b>{(a.designation ?? '').trim() || '—'}</b>, sortAccessor: (a) => (a.designation ?? '').trim() },
    { key: 'fam', header: 'Famille', width: '130px', render: (a) => <span className="text-ink-muted">{a.famille || '—'}</span>, sortAccessor: (a) => a.famille ?? '' },
    { key: 'qte', header: 'Qté', align: 'right', width: '80px', render: (a) => <span className="money">{fmtMoney(a.qte, 2)}</span>, sortAccessor: (a) => Number(a.qte) },
    { key: 'pmp', header: 'PMP moyen', align: 'right', width: '120px', render: (a) => <Money value={a.pmp_moyen} />, sortAccessor: (a) => Number(a.pmp_moyen) },
    { key: 'ht', header: 'Achats HT', align: 'right', width: '130px', render: (a) => <Money value={a.total_ht} />, sortAccessor: (a) => Number(a.total_ht) },
  ];

  return (
    <>
      {res && (
        <div className="grid grid-cols-3 gap-3">
          <Kpi label="Achats HT" icon="cart" value={`${fmtMoney(res.total_ht)} DA`} />
          <Kpi label="Achats TTC" icon="cart" value={`${fmtMoney(res.total_ttc)} DA`} />
          <Kpi label="Pièces d'achat" icon="invoice" tone="neutral" value={String(res.nb_factures ?? 0)} />
        </div>
      )}
      <Tabs value={vue} onChange={setVue} options={VUES_ACHATS} variant="underline" label="Vues des achats" />
      {vue === 'article' && (
        <Toolbar>
          <label className="text-xs font-semibold text-ink-label flex items-center gap-2">
            Filtrer par fournisseur
            <Select size="sm" value={codeFour} onChange={(e) => setCodeFour(e.target.value)} className="w-auto max-w-[220px]">
              <option value="">Tous les fournisseurs</option>
              {fournisseurs.map((f) => <option key={f.code_four} value={f.code_four}>{(f.fournisseur ?? '').trim() || f.code_four}</option>)}
            </Select>
          </label>
        </Toolbar>
      )}

      {vue === 'periode' && (
        <>
          <Carte titre={`Évolution des achats HT ${groupement === 'jour' ? '— par jour' : '— par mois'}`} icon="trend"
                 actions={<Tabs value={groupement} onChange={setGroupement} options={GROUPEMENTS} size="sm" label="Groupement" />}>
            <LineChart data={(res?.lignes ?? []).map((l) => ({ label: l.periode, value: Number(l.total_ht ?? 0) }))}
                       format={(v) => fmtMoney(v, 0)} couleur="var(--chart-2)" />
          </Carte>
          <DataGrid titre={`Achats ${groupement === 'jour' ? 'par jour' : 'par mois'}`}
                    exportCsv={{ nom: 'achats-par-periode', columns: csvAchatPeriode }}
                    columns={colPeriode} rows={res?.lignes ?? []} rowKey={(l) => l.periode}
                    loading={loading} error={error?.message}
                    footer={{ _label: 'Totaux', ht: <Money value={res?.total_ht} />, ttc: <Money value={res?.total_ttc} /> }} />
        </>
      )}

      {vue === 'fournisseur' && (
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3.5 items-start">
            <Carte titre="Top fournisseurs — Achats HT" icon="stats">
              <BarChart data={fournisseurs.map((f) => ({ label: (f.fournisseur ?? '').trim() || f.code_four, value: Number(f.total_ht ?? 0) }))}
                        format={(v) => fmtMoney(v, 0)} />
            </Carte>
            <Carte titre="Répartition des achats HT" icon="pie">
              <DonutChart data={fournisseurs.map((f) => ({ label: (f.fournisseur ?? '').trim() || f.code_four, value: Number(f.total_ht ?? 0) }))}
                          format={(v) => fmtMoney(v, 0)} titreCentre="Achats HT" />
            </Carte>
          </div>
          <DataGrid titre={`Achats par fournisseur — ${fournisseurs.length} fournisseur(s)`} exportCsv={{ nom: 'achats-par-fournisseur', columns: csvFournisseur }} columns={colFournisseur} rows={fournisseurs} rowKey={(f) => f.code_four}
                    loading={four.loading} error={four.error?.message}
                    footer={{ _label: 'Totaux', ht: <Money value={somme(fournisseurs, 'total_ht')} />, ttc: <Money value={somme(fournisseurs, 'total_ttc')} />,
                              reste: <Money value={somme(fournisseurs, 'reste_a_payer')} tone="danger" /> }} />
        </div>
      )}

      {vue === 'article' && (
        <DataGrid titre={`Achats par article — ${articles.length} article(s)`} exportCsv={{ nom: 'achats-par-article', columns: csvArticleAchat }} columns={colArticle} rows={articles} rowKey={(a) => a.code_article}
                    loading={art.loading} error={art.error?.message}
                    footer={{ _label: 'Totaux', ht: <Money value={somme(articles, 'total_ht')} /> }} />
        
      )}
    </>
  );
}

/* ─── Bénéfices ─────────────────────────────────────────────────────────────── */

function SectionBenefices({ debut, fin }: { debut: string; fin: string }) {
  const [groupement, setGroupement] = useState<Groupement>('mois');
  const { data, loading, error } = useQuery(BENEFICES, {
    variables: { date_debut: debut, date_fin: fin, groupement },
  });
  const res: BeneficesResult | undefined = data?.benefices;
  const lignes = res?.lignes ?? [];
  const taux = Number(res?.total_ht) > 0 ? (Number(res?.total_benefice) / Number(res?.total_ht)) * 100 : 0;

  const columns: Column<BeneficeLigne>[] = [
    { key: 'periode', header: 'Période', render: (l) => <b className="money">{l.periode}</b>, sortAccessor: (l) => l.periode },
    { key: 'ht', header: 'CA HT', align: 'right', render: (l) => <Money value={l.total_ht} />, sortAccessor: (l) => Number(l.total_ht) },
    { key: 'revien', header: 'Coût de revient', align: 'right', render: (l) => <Money value={l.total_revien} />, sortAccessor: (l) => Number(l.total_revien) },
    { key: 'brut', header: 'Bénéfice brut', align: 'right', render: (l) => <MargeCell value={l.benefice_brut} />, sortAccessor: (l) => Number(l.benefice_brut) },
    { key: 'remise', header: 'Remises', align: 'right', render: (l) => <Money value={l.remise} />, sortAccessor: (l) => Number(l.remise) },
    { key: 'net', header: 'Après remises', align: 'right', render: (l) => <MargeCell value={l.benefice_avec_remise} />, sortAccessor: (l) => Number(l.benefice_avec_remise) },
    { key: 'pct', header: '%', align: 'right', width: '70px', render: (l) => (
      <Pct value={Number(l.total_ht) > 0 ? (Number(l.benefice_avec_remise) / Number(l.total_ht)) * 100 : 0} />
    ), sortAccessor: (l) => (Number(l.total_ht) > 0 ? (Number(l.benefice_avec_remise) / Number(l.total_ht)) * 100 : 0) },
  ];

  return (
    <>
      {res && (
        <div className="grid grid-cols-4 gap-3">
          <Kpi label="CA HT" icon="trend" value={`${fmtMoney(res.total_ht)} DA`} />
          <Kpi label="Coût de revient" icon="package" tone="neutral" value={`${fmtMoney(res.total_revien)} DA`} />
          {/* total_benefice = bénéfice APRÈS remises (beneficeAvecRemise), comme la marge Delphi */}
          <Kpi label="Bénéfice après remises" icon="wallet" tone="success" value={`${fmtMoney(res.total_benefice)} DA`} />
          <Kpi label="Taux de marge" icon="percent" tone="teal" value={`${fmtMoney(taux, 2)} %`} sub="bénéfice après remises / CA HT" />
        </div>
      )}
      <Carte titre="Évolution du bénéfice après remises" icon="trend"
             actions={<Tabs value={groupement} onChange={setGroupement} options={GROUPEMENTS} size="sm" label="Groupement" />}>
        <LineChart data={lignes.map((l) => ({ label: l.periode, value: Number(l.benefice_avec_remise ?? 0) }))}
                   format={(v) => fmtMoney(v, 0)} couleur="var(--chart-3)" />
      </Carte>
      <DataGrid titre="Bénéfices par période"
                  exportCsv={{ nom: 'benefices', columns: csvBenefice }}
                  columns={columns} rows={lignes} rowKey={(l) => l.periode} loading={loading} error={error?.message}
                  footer={{ _label: 'Totaux', ht: <Money value={res?.total_ht} />, revien: <Money value={res?.total_revien} />, brut: <Money value={res?.total_benefice} /> }} />
    </>
  );
}

/* ─── Valorisation du stock ─────────────────────────────────────────────────── */

function SectionStock() {
  const [search, setSearch] = useState('');
  // La frappe met à jour `search` (affichage immédiat) mais la requête n'utilise
  // que la valeur différée : sinon chaque caractère déclenche un scan agrégé
  // cloud→agent→SQL.
  const recherche = useDebouncedValue(search, 250);
  const client = useApolloClient();
  // Dernière réponse de premier niveau : totaux affichés dans les indicateurs
  const [res, setRes] = useState<ReponseDistante<StatStockLigne> | null>(null);
  // Tri, filtres, recherche, pagination et groupes faits par le serveur
  const distant = useMemo<DataGridDistant<StatStockLigne>>(() => ({
    cle: JSON.stringify([recherche]),
    totaux: [
      { field: 'stock_value', type: 'sum' }, { field: 'sales_value', type: 'sum' },
      { field: 'initial_value', type: 'sum' }, { field: 'marge_potentielle', type: 'sum' },
    ],
    charger: async (grille) => {
      const { data } = await client.query({
        query: STAT_STOCK, fetchPolicy: 'network-only',
        variables: { search: recherche || undefined, grille },
      });
      const r = data.statStock as ReponseDistante<StatStockLigne>;
      if (!grille.groupe || grille.groupe.chemin.length === 0) setRes(r);
      return r;
    },
  }), [client, recherche]);

  const columns: Column<StatStockLigne>[] = [
    { key: 'code', header: 'Code', width: '90px', field: 'code_article', render: (a) => <span className="money">{a.code_article}</span> },
    { key: 'des', header: 'Désignation', field: 'designation', render: (a) => <b>{(a.designation ?? '').replace(/\s+/g, ' ').trim() || '—'}</b> },
    { key: 'fam', header: 'Famille', width: '120px', field: 'famille', render: (a) => <span className="text-ink-muted">{a.famille || '—'}</span> },
    { key: 'qte', header: 'Qté', align: 'right', width: '70px', field: 'qte_reale', type: 'number', render: (a) => (
      <span className="money font-medium" style={{ color: Number(a.qte_reale) <= 0 ? 'var(--danger-text)' : undefined }}>{fmtMoney(a.qte_reale, 2)}</span>
    ) },
    { key: 'pmp', header: 'PMP', align: 'right', width: '110px', field: 'pmp', render: (a) => <Money value={a.pmp} /> },
    { key: 'val', header: 'Valeur stock', align: 'right', width: '130px', field: 'stock_value', render: (a) => <Money value={a.stock_value} /> },
    { key: 'vente', header: 'Valeur vente', align: 'right', width: '130px', field: 'sales_value', render: (a) => <Money value={a.sales_value} /> },
    { key: 'marge', header: 'Marge pot.', align: 'right', width: '120px', field: 'marge_potentielle', render: (a) => <MargeCell value={a.marge_potentielle} /> },
  ];

  return (
    <>
      {res && (
        <div className="grid grid-cols-4 gap-3">
          <Kpi label="Articles en catalogue" icon="package" tone="neutral" value={String(res.total ?? 0)} />
          <Kpi label="Valeur du stock (PMP)" icon="inventory" value={`${fmtMoney(totalDistant(res, 'stock_value'))} DA`} />
          <Kpi label="Valeur de vente TTC" icon="tag" tone="violet" value={`${fmtMoney(totalDistant(res, 'sales_value'))} DA`} />
          <Kpi label="Marge potentielle" icon="trend" tone="success" value={`${fmtMoney(totalDistant(res, 'marge_potentielle'))} DA`}
               sub={`stock initial : ${fmtMoney(totalDistant(res, 'initial_value'))} DA`} />
        </div>
      )}
      <DataGrid titre="Valorisation article par article"
                  actions={<SearchField value={search} placeholder="Code, désignation…" label="Rechercher un article"
                                        onChange={setSearch} width={256} />}
                  exportCsv={{ nom: 'valorisation-stock', columns: csvStock }}
                  columns={columns} rowKey={(a) => a.id}
                  distant={distant} cleEtat="stat-valorisation-stock"
                  footer={(r) => ({ _label: `${r?.total ?? 0} article(s)`,
                            val: <Money value={totalDistant(r, 'stock_value')} />,
                            vente: <Money value={totalDistant(r, 'sales_value')} />,
                            marge: <Money value={totalDistant(r, 'marge_potentielle')} /> })} />
    </>
  );
}

/* ─── Colonnes CSV ──────────────────────────────────────────────────────────── */

const csvPeriode: ExportColumn<StatVenteLigne>[] = [
  { header: 'Période', value: (l) => l.periode },
  { header: 'Total HT', value: (l) => l.total_ht, numeric: true },
  { header: 'Total TTC', value: (l) => l.total_ttc, numeric: true },
  { header: 'Remises', value: (l) => l.remise, numeric: true },
  { header: 'Marge', value: (l) => l.total_marge, numeric: true },
];

const csvArticleVente: ExportColumn<StatArticleVente>[] = [
  { header: 'Code', value: (a) => a.code_article },
  { header: 'Désignation', value: (a) => (a.designation ?? '').replace(/\s+/g, ' ').trim() },
  { header: 'Famille', value: (a) => a.famille ?? '' },
  { header: 'Quantité', value: (a) => a.qte, numeric: true },
  { header: 'CA HT', value: (a) => a.total_ht, numeric: true },
  { header: 'CA TTC', value: (a) => a.total_ttc, numeric: true },
  { header: 'Marge', value: (a) => a.total_marge, numeric: true },
  { header: '% marge', value: (a) => a.pct_marge, numeric: true },
];

const csvClient: ExportColumn<StatClient>[] = [
  { header: 'Code', value: (c) => c.code_cli },
  { header: 'Client', value: (c) => c.raison },
  { header: 'Pièces', value: (c) => c.nb_factures, numeric: true },
  { header: 'CA HT', value: (c) => c.total_ht, numeric: true },
  { header: 'CA TTC', value: (c) => c.total_ttc, numeric: true },
  { header: 'Marge', value: (c) => c.total_marge, numeric: true },
  { header: '% marge', value: (c) => c.pct_marge, numeric: true },
];

const csvFamille: ExportColumn<StatParFamille>[] = [
  { header: 'Famille', value: (f) => f.famille ?? '' },
  { header: 'CA HT', value: (f) => f.total_ht, numeric: true },
  { header: 'CA TTC', value: (f) => f.total_ttc, numeric: true },
  { header: 'Marge', value: (f) => f.total_marge, numeric: true },
];

const csvAchatPeriode: ExportColumn<StatAchatLigne>[] = [
  { header: 'Période', value: (l) => l.periode },
  { header: 'Pièces', value: (l) => l.nb_factures, numeric: true },
  { header: 'Quantité', value: (l) => l.qte, numeric: true },
  { header: 'Achats HT', value: (l) => l.total_ht, numeric: true },
  { header: 'Achats TTC', value: (l) => l.total_ttc, numeric: true },
  { header: 'Retours HT', value: (l) => l.r_total_ht, numeric: true },
];

const csvFournisseur: ExportColumn<StatFournisseur>[] = [
  { header: 'Code', value: (f) => f.code_four },
  { header: 'Fournisseur', value: (f) => f.fournisseur },
  { header: 'Pièces', value: (f) => f.nb_factures, numeric: true },
  { header: 'Achats HT', value: (f) => f.total_ht, numeric: true },
  { header: 'Achats TTC', value: (f) => f.total_ttc, numeric: true },
  { header: 'Reste à payer', value: (f) => f.reste_a_payer, numeric: true },
];

const csvArticleAchat: ExportColumn<StatArticleAchat>[] = [
  { header: 'Code', value: (a) => a.code_article },
  { header: 'Désignation', value: (a) => (a.designation ?? '').replace(/\s+/g, ' ').trim() },
  { header: 'Famille', value: (a) => a.famille ?? '' },
  { header: 'Quantité', value: (a) => a.qte, numeric: true },
  { header: 'PMP moyen', value: (a) => a.pmp_moyen, numeric: true },
  { header: 'Achats HT', value: (a) => a.total_ht, numeric: true },
];

const csvBenefice: ExportColumn<BeneficeLigne>[] = [
  { header: 'Période', value: (l) => l.periode },
  { header: 'CA HT', value: (l) => l.total_ht, numeric: true },
  { header: 'Coût de revient', value: (l) => l.total_revien, numeric: true },
  { header: 'Bénéfice brut', value: (l) => l.benefice_brut, numeric: true },
  { header: 'Remises', value: (l) => l.remise, numeric: true },
  { header: 'Bénéfice après remises', value: (l) => l.benefice_avec_remise, numeric: true },
];

const csvStock: ExportColumn<StatStockLigne>[] = [
  { header: 'Code', value: (a) => a.code_article },
  { header: 'Désignation', value: (a) => (a.designation ?? '').replace(/\s+/g, ' ').trim() },
  { header: 'Famille', value: (a) => a.famille ?? '' },
  { header: 'Quantité', value: (a) => a.qte_reale, numeric: true },
  { header: 'PMP', value: (a) => a.pmp, numeric: true },
  { header: 'Valeur stock', value: (a) => a.stock_value, numeric: true },
  { header: 'Valeur vente', value: (a) => a.sales_value, numeric: true },
  { header: 'Marge potentielle', value: (a) => a.marge_potentielle, numeric: true },
];

/* ─── Petits composants ─────────────────────────────────────────────────────── */

function somme<T>(rows: T[], key: keyof T): number {
  return rows.reduce((t, r) => t + Number(r[key] ?? 0), 0);
}

function MargeCell({ value }: { value: unknown }) {
  return (
    <span className="money" style={{ color: Number(value) < 0 ? 'var(--danger-text)' : 'var(--success-text)' }}>
      {fmtMoney(value)}
    </span>
  );
}

function Pct({ value }: { value: unknown }) {
  const n = Number(value ?? 0);
  return <span className="money" style={{ color: n < 0 ? 'var(--danger-text)' : undefined }}>{fmtMoney(n, 1)} %</span>;
}



function Kpi({ label, value, sub, icon, tone = 'brand' }: { label: string; value: string; sub?: string; icon?: IconName; tone?: Tone }) {
  return <KpiTile label={label} value={value} sub={sub} icon={icon} tone={tone} />;
}
