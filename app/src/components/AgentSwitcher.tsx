import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { MY_AGENTS, SWITCH_AGENT } from '../api/auth';
import { apollo } from '../api/client';
import { AgentInfo, useSession } from '../store/session';
import Dialog from './ui/Dialog';
import { Alert, Loading } from './ui/States';
import { IconBadge } from './ui/Icon';
import { Badge } from './ui/atoms';

/**
 * Bascule entre les agents rattachés au compte (ex. deux pharmacies, ou le PC du
 * magasin et celui du dépôt). Nouveau jeton sur l'agent choisi, cache vidé, puis
 * choix du dossier de cet agent (l'écran de connexion reprend à cette étape).
 */
export default function AgentSwitcher({ onClose }: { onClose: () => void }) {
  const agentCourant = useSession((s) => s.agent);
  const { data, loading } = useQuery(MY_AGENTS, { fetchPolicy: 'network-only' });
  const [switchAgent, { loading: bascule }] = useMutation(SWITCH_AGENT);
  const [erreur, setErreur] = useState<string | null>(null);
  const agents: AgentInfo[] = Array.isArray(data?.myAgents) ? data.myAgents : [];

  async function choisir(a: AgentInfo) {
    setErreur(null);
    try {
      const { data: r } = await switchAgent({ variables: { newAgentId: a.agentId } });
      const res = r?.switchAgentMobile;
      if (!res?.success || !res.access_token) { setErreur(res?.message ?? 'Bascule impossible.'); return; }
      await apollo.clearStore();
      const s = useSession.getState();
      s.setAuth(res.access_token, { ...a, isOnline: true });
      // Les dossiers et utilisateurs sont propres à chaque agent : on les choisit à nouveau
      s.setDossier('');
      onClose();
    } catch (e: any) {
      setErreur(e?.message ?? 'Bascule impossible.');
    }
  }

  return (
    <Dialog title="Changer d’agent" subtitle="Agents rattachés à votre compte. Il faudra ensuite choisir le dossier."
            icon="server" size="sm" onClose={onClose}>
      <div className="flex flex-col gap-2">
        {erreur && <Alert tone="danger" compact>{erreur}</Alert>}
        {loading && <Loading />}
        {agents.map((a) => {
          const courant = a.agentId === agentCourant?.agentId;
          return (
            <button key={a.agentId} disabled={courant || !a.isOnline || bascule} onClick={() => void choisir(a)}
                    className={`flex items-center gap-3 text-left border rounded-md px-3 py-2.5 transition-colors ${courant ? 'border-brand-line bg-brand-soft' : 'border-line-soft hover:border-line-strong hover:bg-hover'} disabled:cursor-default disabled:hover:bg-transparent`}>
              <IconBadge name="server" tone={a.isOnline ? 'brand' : 'neutral'} />
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-base text-ink truncate">{a.label || a.agentId}</span>
                <span className="block text-xs text-ink-muted money truncate">{a.agentId}{a.lastDossier ? ` · ${a.lastDossier}` : ''}</span>
              </span>
              {courant ? <Badge tone="brand">actuel</Badge> : <Badge tone={a.isOnline ? 'success' : 'neutral'} dot>{a.isOnline ? 'En ligne' : 'Hors ligne'}</Badge>}
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}
