import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { MY_AGENTS, SWITCH_AGENT } from '../api/auth';
import { apollo } from '../api/client';
import { AgentInfo, useSession } from '../store/session';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgb(15 26 46 / .45)' }}>
      <div className="w-[440px] bg-surface border border-line-soft rounded-lg shadow-lifted p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="font-extrabold text-[15px]">Changer d&apos;agent</div>
          <button onClick={onClose} className="text-ink-muted text-[18px] px-2">✕</button>
        </div>
        <div className="text-[11.5px] text-ink-muted mb-4">Agents rattachés à votre compte. Il faudra ensuite choisir le dossier.</div>
        {erreur && (
          <div className="text-[12px] rounded-md px-3 py-2 mb-3"
               style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' }}>{erreur}</div>
        )}
        <div className="flex flex-col gap-2">
          {loading && <div className="text-[12px] text-ink-muted">Chargement…</div>}
          {agents.map((a) => {
            const courant = a.agentId === agentCourant?.agentId;
            return (
              <button key={a.agentId} disabled={courant || !a.isOnline || bascule} onClick={() => void choisir(a)}
                      className={`text-left border rounded-md px-3 py-2.5 ${courant ? 'border-brand-500 bg-brand-50' : 'border-line hover:border-brand-300'} disabled:cursor-default`}>
                <div className="flex items-center gap-2 font-bold text-[13px]">
                  <span className="w-2 h-2 rounded-full" style={{ background: a.isOnline ? 'var(--success)' : 'var(--danger)' }} />
                  {a.label || a.agentId}
                  {courant && <span className="ml-auto text-[10.5px] font-semibold text-brand-700">actuel</span>}
                  {!courant && !a.isOnline && <span className="ml-auto text-[10.5px] font-semibold text-ink-muted">hors ligne</span>}
                </div>
                <div className="text-[10.5px] text-ink-muted font-mono mt-0.5">{a.agentId}{a.lastDossier ? ` · ${a.lastDossier}` : ''}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
