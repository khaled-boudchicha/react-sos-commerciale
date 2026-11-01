import { useCallback, useEffect, useState } from 'react';
import { gql, useApolloClient } from '@apollo/client';
import { MY_AGENTS, REFRESH_TOKEN } from '../api/auth';
import { useSession } from '../store/session';
import { PageHeader } from '../components/ui/atoms';
import { Button } from '../components/ui/Button';
import { Card, DescriptionList } from '../components/ui/Card';
import { IconBadge, type IconName, type Tone } from '../components/ui/Icon';
import { useToast } from '../components/ui/Toast';
import { EmptyState } from '../components/ui/States';
import { useReseau } from '../store/reseau';
import { useConnexion } from '../api/useSurveillanceReseau';
import { etatCacheHorsLigne, viderCacheHorsLigne, VALIDITE_ARTICLES_MS, VALIDITE_REFERENTIELS_MS } from '../api/cacheHorsLigne';

const PING = gql`query DiagPing { __typename }`;
const SESSION_STATUS = gql`query DiagSession { sessionStatus }`;
const DOSSIER_DATA = gql`query DiagDossier { modesPayement }`;

type Etat = 'ok' | 'ko' | 'warn' | 'run';
type Check = { cle: string; libelle: string; etat: Etat; detail: string; ms?: number };

const PASTILLE: Record<Etat, { tone: Tone; icon: IconName }> = {
  ok:   { tone: 'success', icon: 'check' },
  ko:   { tone: 'danger',  icon: 'close' },
  warn: { tone: 'warning', icon: 'alert' },
  run:  { tone: 'neutral', icon: 'clock' },
};

export default function Diagnostic() {
  const client = useApolloClient();
  const toast = useToast();
  const cloudUrl = useSession((s) => s.cloudUrl);
  const agent = useSession((s) => s.agent);
  const dossier = useSession((s) => s.dossier);
  const dossierUser = useSession((s) => s.dossierUser);
  const [checks, setChecks] = useState<Check[]>([]);
  const [running, setRunning] = useState(false);
  const connexion = useConnexion();
  const journal = useReseau((s) => s.journal);
  const viderJournal = useReseau((s) => s.viderJournal);
  const derniereReponse = useReseau((s) => s.derniereReponse);
  // Cache hors ligne du dossier courant (articles consultés, référentiels)
  const [cache, setCache] = useState<Awaited<ReturnType<typeof etatCacheHorsLigne>>>(null);
  const lireCache = useCallback(() => { void etatCacheHorsLigne().then(setCache); }, []);
  useEffect(lireCache, [lireCache]);
  // Protection de la session sur ce poste (application de bureau uniquement)
  const [protection, setProtection] = useState<string>('—');

  useEffect(() => {
    if (!window.gc?.securite) { setProtection('navigateur — non mémorisée'); return; }
    window.gc.securite()
      .then((r) => setProtection(!r ? '—' : r.chiffrement
        ? 'chiffrée (coffre du système)'
        : `non mémorisée — chiffrement indisponible${r.moteur ? ` (${r.moteur})` : ''}`))
      .catch(() => setProtection('—'));
  }, []);

  const lancer = useCallback(async () => {
    setRunning(true);
    const res: Check[] = [];

    const mesurer = async (cle: string, libelle: string, fn: () => Promise<string>): Promise<void> => {
      const t0 = performance.now();
      try {
        const detail = await fn();
        res.push({ cle, libelle, etat: 'ok', detail, ms: Math.round(performance.now() - t0) });
      } catch (e: any) {
        res.push({ cle, libelle, etat: 'ko', detail: e?.message ?? 'échec', ms: Math.round(performance.now() - t0) });
      }
      setChecks([...res]);
    };

    await mesurer('cloud', 'Serveur cloud (GraphQL)', async () => {
      await client.query({ query: PING, fetchPolicy: 'no-cache' });
      return 'joignable';
    });

    // Agent : succès de la requête mais statut hors-ligne → avertissement
    const t0 = performance.now();
    try {
      const { data } = await client.query({ query: MY_AGENTS, fetchPolicy: 'no-cache' });
      const list: any[] = Array.isArray(data?.myAgents) ? data.myAgents : [];
      const a = list.find((x) => x.agentId === agent?.agentId) ?? list[0];
      const enLigne = !!a?.isOnline;
      res.push({
        cle: 'agent', libelle: 'Agent PC (pharmacie)',
        etat: enLigne ? 'ok' : 'warn',
        detail: a ? (enLigne ? `en ligne — ${a.label ?? a.agentId}` : 'hors ligne') : 'aucun agent associé',
        ms: Math.round(performance.now() - t0),
      });
    } catch (e: any) {
      res.push({ cle: 'agent', libelle: 'Agent PC (pharmacie)', etat: 'ko', detail: e?.message ?? 'échec', ms: Math.round(performance.now() - t0) });
    }
    setChecks([...res]);

    await mesurer('session', 'Session (compte / abonnement)', async () => {
      await client.query({ query: SESSION_STATUS, fetchPolicy: 'no-cache' });
      return 'valide';
    });

    await mesurer('donnees', 'Données du dossier (cloud → agent → base)', async () => {
      const { data } = await client.query({ query: DOSSIER_DATA, fetchPolicy: 'no-cache' });
      const n = Array.isArray(data?.modesPayement) ? data.modesPayement.length : 0;
      return `réponse reçue (${n} mode(s) de paiement)`;
    });

    setRunning(false);
  }, [client, agent]);

  useEffect(() => { void lancer(); }, [lancer]);

  async function rafraichirJeton() {
    try {
      const { data } = await client.mutate({ mutation: REFRESH_TOKEN, fetchPolicy: 'no-cache' });
      const r = data?.refreshToken;
      const s = useSession.getState();
      if (r?.success && r.access_token && s.agent) {
        s.setAuth(r.access_token, s.agent);
        toast.success('Jeton de session renouvelé.');
        void lancer();
      } else {
        toast.error(r?.message ?? 'Renouvellement impossible.');
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Renouvellement impossible.');
    }
  }

  const global: Etat = checks.some((c) => c.etat === 'ko') ? 'ko'
    : checks.some((c) => c.etat === 'warn') ? 'warn'
    : checks.length && !running ? 'ok' : 'run';

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title="Diagnostic de connexion" icon="activity" backTo="/parametres" backLabel="Retour aux paramètres"
                  breadcrumb={[{ label: 'Paramètres', to: '/parametres' }, { label: 'Diagnostic de connexion' }]}>
        <Button icon="refresh" onClick={() => void rafraichirJeton()}>Renouveler le jeton</Button>
        <Button variant="primary" icon="activity" onClick={() => void lancer()} disabled={running} loading={running}>
          {running ? 'Test…' : 'Retester'}
        </Button>
      </PageHeader>

      <Card className="flex items-center gap-4 flex-wrap">
        <IconBadge name={PASTILLE[global].icon} tone={PASTILLE[global].tone} size="lg" />
        <div role="status" aria-live="polite">
          <div className="font-extrabold text-lg text-ink">
            {global === 'ok' ? 'Tout fonctionne' : global === 'warn' ? 'Fonctionnel avec réserves' : global === 'ko' ? 'Problème détecté' : 'Test en cours…'}
          </div>
          <div className="text-xs text-ink-muted money">{cloudUrl}</div>
        </div>
      </Card>

      <Card padding="none" className="divide-y divide-line-soft">
        {['cloud', 'agent', 'session', 'donnees'].map((cle) => {
          const c = checks.find((x) => x.cle === cle);
          const etat: Etat = c?.etat ?? 'run';
          return (
            <div key={cle} className="flex items-center gap-3 px-4 py-3">
              <IconBadge name={PASTILLE[etat].icon} tone={PASTILLE[etat].tone} size="sm" />
              <div className="flex-1">
                <div className="font-semibold text-base text-ink">{c?.libelle ?? cle}</div>
                <div className="text-xs text-ink-muted">{c?.detail ?? 'en attente…'}</div>
              </div>
              {c?.ms != null && <span className="money text-xs text-ink-muted">{c.ms} ms</span>}
            </div>
          );
        })}
      </Card>

      <Card>
        <DescriptionList columns={3} items={[
          { label: 'État de la connexion', value: connexion.libelle },
          { label: 'Dernière réponse du serveur', value: derniereReponse ? new Date(derniereReponse).toLocaleTimeString('fr-FR') : '—' },
          { label: 'Agent associé', value: agent?.label ?? agent?.agentId ?? '—' },
          { label: 'Dossier', value: dossier ?? '—' },
          { label: 'Utilisateur du dossier', value: dossierUser?.username ?? '—' },
          { label: 'Session sur ce poste', value: protection },
        ]} />
      </Card>

      <Card>
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="font-bold text-base text-ink">Cache hors ligne</div>
            <div className="text-xs text-ink-muted mt-0.5">
              Si le serveur est injoignable, la recherche d’articles et les référentiels utilisent les dernières données reçues sur ce poste
              (articles : {VALIDITE_ARTICLES_MS / 3600_000} h, référentiels : {VALIDITE_REFERENTIELS_MS / 86_400_000} jours). L’encaissement reste suspendu.
            </div>
          </div>
          <Button size="sm" icon="trash" disabled={!cache || (cache.articles === 0 && cache.reponses === 0)}
                  onClick={() => { void viderCacheHorsLigne().then(() => { lireCache(); toast.success('Cache hors ligne vidé.'); }); }}>
            Vider
          </Button>
        </div>
        <DescriptionList columns={3} className="mt-3" items={[
          { label: 'Articles disponibles hors ligne', value: cache ? String(cache.articles) : '—' },
          { label: 'Référentiels mémorisés', value: cache ? String(cache.reponses) : '—' },
          { label: 'Article le plus ancien', value: cache?.plusAncien ? new Date(cache.plusAncien).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—' },
        ]} />
      </Card>

      <Card padding="none">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-line-soft">
          <div className="flex-1">
            <div className="font-bold text-base text-ink">Journal des incidents réseau</div>
            <div className="text-xs text-ink-muted">Pannes de transport enregistrées sur ce poste (50 dernières, répétitions regroupées).</div>
          </div>
          <Button size="sm" icon="trash" onClick={viderJournal} disabled={journal.length === 0}>Vider</Button>
        </div>
        {journal.length === 0 ? (
          <EmptyState size="sm" icon="check" title="Aucun incident" description="Aucune panne de connexion n’a été relevée sur ce poste." />
        ) : (
          <ul className="divide-y divide-line-soft max-h-[320px] overflow-auto">
            {journal.map((j) => (
              <li key={`${j.debut}-${j.operation}`} className="flex items-start gap-3 px-4 py-2.5">
                <span className="money text-xs text-ink-muted w-[150px] flex-none pt-0.5">
                  {new Date(j.debut).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-ink">{j.message}</span>
                  <span className="block text-xs text-ink-muted truncate">
                    {j.operation}{j.n > 1 ? ` · ${j.n} échecs jusqu’à ${new Date(j.fin).toLocaleTimeString('fr-FR')}` : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
