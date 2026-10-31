import { useCallback, useEffect, useState } from 'react';
import { gql, useApolloClient } from '@apollo/client';
import { MY_AGENTS, REFRESH_TOKEN } from '../api/auth';
import { useSession } from '../store/session';
import { PageHeader } from '../components/ui/atoms';
import { Button } from '../components/ui/Button';
import { Card, DescriptionList } from '../components/ui/Card';
import { IconBadge, type IconName, type Tone } from '../components/ui/Icon';
import { useToast } from '../components/ui/Toast';

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
          { label: 'Agent associé', value: agent?.label ?? agent?.agentId ?? '—' },
          { label: 'Dossier', value: dossier ?? '—' },
          { label: 'Utilisateur du dossier', value: dossierUser?.username ?? '—' },
        ]} />
      </Card>
    </div>
  );
}
