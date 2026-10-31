import { useQuery } from '@apollo/client';
import { DASHBOARD } from '../api/dashboard';
import { LOTS_EXPIRANT } from '../api/queries';
import { StatVentesResult, DebiteursResult, StatParFamille } from '../api/types';
import { fmtMoney, isoFirstOfMonth, isoToday } from '../lib/format';
import { D, useDroits } from '../lib/droits';
import { useSession } from '../store/session';
import { C, TEINTE_TON, commandeDeChemin, type Commande } from '../navigation/commandes';
import { useRecents, ilYA } from '../navigation/recents';
import { Link } from 'react-router-dom';
import { usePageTitle } from '../components/ui/atoms';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { KpiTile, BarList } from '../components/ui/Kpi';
import { Alert, EmptyState, Skeleton } from '../components/ui/States';
import { Icon, TONE_VARS, type IconName } from '../components/ui/Icon';

type SoldeCompte = { compte: string | null; compte_id: number | null; solde: number; total_entrees: number; total_sorties: number };

const ACTIONS_RAPIDES: { cmd: Commande; icon: IconName }[] = [
  { cmd: C.nouvelleFA, icon: 'invoice' },
  { cmd: C.comptoir, icon: 'counter' },
  { cmd: C.nouveauBR, icon: 'package' },
  { cmd: C.clients, icon: 'users' },
];

function salutation() {
  const h = new Date().getHours();
  return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
}

export default function Dashboard() {
  usePageTitle('Tableau de bord');
  const droits = useDroits();
  const { peut, comptesAutorises } = droits;
  const user = useSession((s) => s.dossierUser);
  // « Reprendre où vous en étiez » : écrans récents du poste (hors tableau de bord)
  const recents = useRecents((s) => s.recents).filter((r) => r.chemin !== '/').slice(0, 5);
  // Indicateurs sensibles masqués selon les droits (parité desktop)
  const voitMarge = peut('vente', D.vente.benefice) || peut('autre', D.autre.beneficeStat);
  const voitCaisse = peut('autre', D.autre.tresorerie);
  const voitLots = peut('stock', D.stock.lots);
  // Requête séparée : un agent ancien sans « lotsExpirant » ne casse pas le tableau de bord
  const { data: lotsData } = useQuery(LOTS_EXPIRANT, { variables: { jours: 90 }, skip: !voitLots });
  const lotsExp: { perime: boolean; valeur: number }[] = Array.isArray(lotsData?.lotsExpirant) ? lotsData.lotsExpirant : [];
  const { data, loading, error, refetch } = useQuery(DASHBOARD, {
    variables: { debutMois: isoFirstOfMonth(), aujourdhui: isoToday() },
  });

  const stat: StatVentesResult | undefined = data?.statVentes;
  // Même calcul que l'écran Trésorerie (validé contre Delphi) ; droit PrevilegeBank : comptes autorisés
  const soldes: SoldeCompte[] = comptesAutorises(Array.isArray(data?.soldesComptes) ? data.soldesComptes : [], (c: SoldeCompte) => c.compte);
  const totalCaisse = soldes.reduce((s, c) => s + Number(c.solde ?? 0), 0);
  const deb: DebiteursResult | undefined = data?.debiteurs;
  const alertes: unknown[] = Array.isArray(data?.alertesStock) ? data.alertesStock : [];

  const lignes = stat?.lignes ?? [];
  const maxJour = Math.max(1, ...lignes.map((l) => Number(l.total_ttc ?? 0)));

  const famillesBrutes: StatParFamille[] = Array.isArray(data?.statVentesParFamille) ? data.statVentesParFamille : [];
  // Classement par CA décroissant puis top 6 (le serveur trie par nom, pas par valeur)
  const familles = [...famillesBrutes].sort((a, b) => Number(b.total_ttc ?? 0) - Number(a.total_ttc ?? 0)).slice(0, 6);

  const actions = ACTIONS_RAPIDES.filter((a) => !a.cmd.si || a.cmd.si(droits));
  const nomUtilisateur = String(user?.name || user?.username || '');
  const dateDuJour = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const moisCourant = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-col gap-5">
      {/* Bandeau d'accueil */}
      <section className="rounded-lg text-ink-inverse px-6 py-5 relative overflow-hidden shadow-card" style={{ background: 'var(--gradient-hero)' }}>
        <span aria-hidden="true" className="absolute -right-16 -top-20 w-72 h-72 rounded-full" style={{ background: 'rgb(255 255 255 / .07)' }} />
        <span aria-hidden="true" className="absolute right-24 -bottom-28 w-56 h-56 rounded-full" style={{ background: 'rgb(255 255 255 / .05)' }} />
        <div className="relative flex flex-wrap items-end gap-6">
          <div className="flex-1 min-w-[280px]">
            <div className="text-sm font-semibold opacity-85 first-letter:uppercase">{dateDuJour}</div>
            <h1 className="text-2xl font-extrabold tracking-tight mt-0.5">{salutation()}{nomUtilisateur ? `, ${nomUtilisateur}` : ''}</h1>
            <div className="mt-4 text-xs font-bold uppercase tracking-wider opacity-80">Chiffre d’affaires — {moisCourant}</div>
            <div className="money text-display font-extrabold mt-0.5">
              {loading ? <Skeleton width={240} height={32} className="opacity-40" /> : <>{fmtMoney(stat?.total_ttc)} <span className="text-lg opacity-80">DA</span></>}
            </div>
            {voitMarge && (
              <div className="mt-1 inline-flex items-center gap-2 text-sm opacity-90">
                <Icon name="trend" size={16} />
                Marge brute <span className="money font-bold">{fmtMoney(stat?.total_marge)} DA</span>
                {stat != null && <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: 'rgb(255 255 255 / .18)' }}>{fmtMoney(stat.pct_marge_global, 1)} %</span>}
              </div>
            )}
          </div>
          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {actions.map(({ cmd, icon }) => (
                <Button key={cmd.id} to={cmd.to} icon={icon} size="lg"
                        className="!bg-white/15 hover:!bg-white/25 !text-ink-inverse !border-white/25 backdrop-blur-sm">
                  {cmd.court ?? cmd.libelle}
                </Button>
              ))}
            </div>
          )}
        </div>
      </section>

      {error && (
        <Alert tone="danger" title="Indicateurs indisponibles"
               action={<Button size="sm" icon="refresh" onClick={() => void refetch()}>Réessayer</Button>}>
          {error.message}
        </Alert>
      )}

      {/* Indicateurs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiTile label="Trésorerie (tous comptes)" icon="wallet" tone="success" loading={loading}
                 to={voitCaisse ? '/tresorerie' : undefined}
                 locked={voitCaisse ? undefined : 'Réservé à la trésorerie'}
                 value={<>{fmtMoney(totalCaisse)} <span className="text-sm text-ink-muted">DA</span></>}
                 sub={`${soldes.length} compte(s)`} />
        <KpiTile label="Créances clients" icon="debtors" tone="danger" valueTone="danger" loading={loading} to="/tiers?vue=debiteurs"
                 value={<>{fmtMoney(deb?.total_creances)} <span className="text-sm text-ink-muted">DA</span></>}
                 sub={deb ? `${deb.total_clients} débiteur(s) · +60 j : ${fmtMoney(deb.bucket_60_plus)} DA` : undefined} />
        <KpiTile label="Alertes stock" icon="alert" tone="warning" valueTone={alertes.length ? 'warning' : undefined} loading={loading}
                 to="/stock?vue=alerte" value={`${alertes.length} article(s)`} sub="sous le stock minimum" />
        {voitLots ? (
          <KpiTile label="Péremption ≤ 90 jours" icon="expiry" tone="orange" valueTone={lotsExp.length ? 'danger' : undefined}
                   to="/stock?vue=peremption" value={`${lotsExp.length} lot(s)`}
                   sub={`dont ${lotsExp.filter((l) => l.perime).length} périmé(s) · ${fmtMoney(lotsExp.reduce((s, l) => s + Number(l.valeur ?? 0), 0))} DA`} />
        ) : (
          <KpiTile label="Péremption ≤ 90 jours" icon="expiry" tone="neutral" locked="Réservé à la gestion des lots" />
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4 items-start">
        <Card>
          <CardHeader title="CA par jour" description={`Ventes TTC — ${moisCourant}`} icon="stats"
                      actions={C.statistiques.si(droits) ? <Button size="sm" variant="ghost" iconRight="arrowRight" to="/statistiques">Statistiques</Button> : undefined} />
          {loading ? (
            <div className="flex items-end gap-1.5 h-[150px]">
              {Array.from({ length: 18 }, (_, i) => <Skeleton key={i} height={`${30 + ((i * 37) % 60)}%`} rounded="xs" className="flex-1" />)}
            </div>
          ) : lignes.length === 0 ? (
            <EmptyState size="sm" icon="stats" title="Aucune vente sur la période" description="Les ventes du mois apparaîtront ici jour par jour." />
          ) : (
            <div className="relative">
              <div className="absolute left-0 right-0 top-0 border-t border-dashed border-line-soft" aria-hidden="true" />
              <div className="absolute left-0 top-0 -translate-y-full pb-0.5 text-2xs money text-ink-muted">max {fmtMoney(maxJour, 0)}</div>
              <div className="flex items-end gap-1 h-[150px] border-b border-line" role="img" aria-label="Histogramme du chiffre d’affaires par jour">
                {lignes.map((l) => (
                  <div key={l.periode} className="group flex-1 min-w-[6px] h-full flex items-end">
                    <div className="w-full rounded-t-xs transition-[filter] duration-fast group-hover:brightness-110"
                         title={`${l.periode} : ${fmtMoney(l.total_ttc)} DA`}
                         style={{ height: `${Math.max(2, (Number(l.total_ttc) / maxJour) * 100)}%`, background: 'var(--chart-1)' }} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1.5 text-2xs money text-ink-muted">
                <span>{lignes[0]?.periode}</span><span>{lignes[lignes.length - 1]?.periode}</span>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Top familles" description="CA TTC du mois" icon="pie" iconTone="violet" />
          {loading
            ? <Skeleton lines={6} height={12} />
            : <BarList tone="violet" empty={<EmptyState size="sm" icon="pie" title="Aucune donnée" />}
                       items={familles.map((f) => ({ key: f.famille || '—', label: f.famille || '(sans famille)', value: Number(f.total_ttc ?? 0) }))} />}
        </Card>
      </div>

      {recents.length > 0 && (
        <Card>
          <CardHeader title="Reprendre où vous en étiez" description="Derniers écrans ouverts sur ce poste" icon="history" iconTone="neutral" />
          <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
            {recents.map((r) => {
              const [chemin, recherche = ''] = r.chemin.split('?');
              const cmd = commandeDeChemin(chemin, recherche ? `?${recherche}` : '');
              const teinte = TONE_VARS[cmd ? TEINTE_TON[cmd.ton] : 'neutral'];
              return (
                <li key={r.chemin}>
                  <Link to={r.chemin}
                        className="group flex items-center gap-3 rounded-md border border-line-soft px-3 py-2.5 hover:border-brand-line hover:bg-hover transition-colors min-w-0">
                    <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-sm"
                          style={{ background: teinte.soft, color: teinte.text }}>
                      <Icon name={cmd?.icone ?? 'history'} size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink truncate group-hover:text-brand-text">{r.titre || chemin}</span>
                      <span className="block text-xs text-ink-muted truncate">{ilYA(r.date)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
