import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { gql, useApolloClient } from '@apollo/client';
import { MY_AGENTS, REFRESH_TOKEN } from '../api/auth';
import { useSession } from '../store/session';
import { PageHeader } from '../components/ui/atoms';
import { useToast } from '../components/ui/Toast';

const PING = gql`query DiagPing { __typename }`;
const SESSION_STATUS = gql`query DiagSession { sessionStatus }`;
const DOSSIER_DATA = gql`query DiagDossier { modesPayement }`;

type Etat = 'ok' | 'ko' | 'warn' | 'run';
type Check = { cle: string; libelle: string; etat: Etat; detail: string; ms?: number };

const PASTILLE: Record<Etat, { c: string; t: string }> = {
  ok:   { c: 'var(--success)', t: '✓' },
  ko:   { c: 'var(--danger)',  t: '✕' },
  warn: { c: 'var(--warning)', t: '!' },
  run:  { c: 'var(--ink-muted)', t: '…' },
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
      <PageHeader title="Diagnostic de connexion">
        <Link to="/parametres" className="text-[12px] font-bold text-brand-700">← Paramètres</Link>
      </PageHeader>

      <div className="bg-surface border border-line-soft rounded-md shadow-soft p-4 flex items-center gap-4 flex-wrap">
        <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-extrabold text-[18px]"
             style={{ background: PASTILLE[global].c }}>{PASTILLE[global].t}</div>
        <div>
          <div className="font-extrabold text-[15px]">
            {global === 'ok' ? 'Tout fonctionne' : global === 'warn' ? 'Fonctionnel avec réserves' : global === 'ko' ? 'Problème détecté' : 'Test en cours…'}
          </div>
          <div className="text-[11.5px] text-ink-muted money">{cloudUrl}</div>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => void rafraichirJeton()}
                  className="rounded-md px-3 py-2 font-bold text-[12px] border border-line text-ink-label">
            Renouveler le jeton
          </button>
          <button onClick={() => void lancer()} disabled={running}
                  className="rounded-md px-4 py-2 font-bold text-[12px] text-white bg-brand-700 disabled:opacity-60">
            {running ? 'Test…' : 'Retester'}
          </button>
        </div>
      </div>

      <div className="bg-surface border border-line-soft rounded-md shadow-soft divide-y divide-line-soft">
        {['cloud', 'agent', 'session', 'donnees'].map((cle) => {
          const c = checks.find((x) => x.cle === cle);
          const etat: Etat = c?.etat ?? 'run';
          return (
            <div key={cle} className="flex items-center gap-3 px-4 py-3">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[12px]"
                    style={{ background: PASTILLE[etat].c }}>{PASTILLE[etat].t}</span>
              <div className="flex-1">
                <div className="font-semibold text-[12.5px]">{c?.libelle ?? cle}</div>
                <div className="text-[11px] text-ink-muted">{c?.detail ?? 'en attente…'}</div>
              </div>
              {c?.ms != null && <span className="money text-[11px] text-ink-muted">{c.ms} ms</span>}
            </div>
          );
        })}
      </div>

      <div className="bg-surface border border-line-soft rounded-md shadow-soft p-4 text-[12px] text-ink-label flex flex-col gap-1.5">
        <div>Agent associé : <b>{agent?.label ?? agent?.agentId ?? '—'}</b></div>
        <div>Dossier : <b>{dossier ?? '—'}</b></div>
        <div>Utilisateur du dossier : <b>{dossierUser?.username ?? '—'}</b></div>
      </div>
    </div>
  );
}
