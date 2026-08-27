import { useEffect, useState } from 'react';
import { useMutation, useLazyQuery } from '@apollo/client';
import { LOGIN_IDENTIFY, LOGIN_WITH_AGENT, DOSSIERS, DOSSIER_USERS, LOGIN_DOSSIER_USER } from '../api/auth';
import { useSession, getDeviceId, AgentInfo } from '../store/session';

type Step = 'credentials' | 'agent' | 'dossier';

const STATUT_MESSAGES: Record<string, string> = {
  mauvais_mdp: 'Identifiant ou mot de passe incorrect.',
  expire: 'Abonnement expiré — contactez SOFTLY.',
  suspendu: 'Abonnement suspendu — contactez SOFTLY.',
  bloque: 'Compte bloqué — contactez SOFTLY.',
  agent_offline: "Cet agent est hors ligne. Démarrez l'agent sur le PC de la pharmacie.",
  max_appareils_atteint: "Nombre maximum d'appareils atteint pour ce compte.",
};

export default function Login() {
  const session = useSession();
  const [step, setStep] = useState<Step>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tokenTemp, setTokenTemp] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null);
  const [needsForce, setNeedsForce] = useState(false);

  const [dossierName, setDossierName] = useState('');
  const [dossierUsername, setDossierUsername] = useState('');
  const [dossierPassword, setDossierPassword] = useState('');

  const [identify, { loading: identifying }] = useMutation(LOGIN_IDENTIFY);
  const [loginWithAgent, { loading: connecting }] = useMutation(LOGIN_WITH_AGENT);
  const [loadDossiers, { data: dossiersData, loading: loadingDossiers }] = useLazyQuery(DOSSIERS, { fetchPolicy: 'network-only' });
  const [loadDossierUsers, { data: dossierUsersData }] = useLazyQuery(DOSSIER_USERS, { fetchPolicy: 'network-only' });
  const [loginDossierUser, { loading: loggingDossierUser }] = useMutation(LOGIN_DOSSIER_USER);

  async function handleIdentify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { data } = await identify({ variables: { username, password } });
      const res = data?.loginIdentify;
      if (!res?.success) {
        setError(STATUT_MESSAGES[res?.statut ?? ''] ?? res?.message ?? 'Connexion refusée.');
        return;
      }
      setTokenTemp(res.token_temp);
      setAgents(res.agents ?? []);
      if ((res.agents ?? []).length === 1) setSelectedAgent(res.agents[0]);
      setStep('agent');
    } catch (err: any) {
      setError(err.message ?? 'Serveur injoignable.');
    }
  }

  async function handleConnectAgent(force = false) {
    if (!selectedAgent || !tokenTemp) return;
    setError(null);
    try {
    const deviceId = await getDeviceId();
    const { data } = await loginWithAgent({
      variables: {
        input: {
          token_temp: tokenTemp,
          agentId: selectedAgent.agentId,
          force,
          deviceId,
          deviceName: `Desktop ${window.gc?.platform ?? ''}`.trim(),
          platform: 'desktop',
        },
      },
    });
    const res = data?.loginWithAgent;
    if (!res?.success) {
      if (res?.statut === 'agent_conflit') {
        setNeedsForce(true);
        setError('Une autre session utilise déjà cet agent. Forcer la connexion ?');
        return;
      }
      setError(STATUT_MESSAGES[res?.statut ?? ''] ?? res?.message ?? 'Connexion refusée.');
      return;
    }
    session.setAuth(res.access_token, selectedAgent);
    if (selectedAgent.lastDossier) setDossierName(selectedAgent.lastDossier);
    setStep('dossier');
    void loadDossiers();
    void loadDossierUsers();
    } catch (err: any) {
      setError(err.message ?? 'Serveur injoignable.');
    }
  }

  async function handleDossierLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!dossierName) { setError('Choisissez un dossier.'); return; }
    session.setDossier(dossierName);
    try {
      const { data } = await loginDossierUser({ variables: { username: dossierUsername, password: dossierPassword } });
      // Retour agent : { ok, message, user_id, username } (dossier-users.service.ts)
      const res = data?.loginDossierUser;
      if (!res?.ok) {
        setError(res?.message ?? 'Utilisateur dossier incorrect.');
        return;
      }
      session.setDossierUser({ id: res.user_id, username: res.username });
    } catch (err: any) {
      setError(err.message ?? 'Erreur de connexion.');
    }
  }

  useEffect(() => {
    if (step === 'dossier' && !dossierName) {
      const list: any[] = Array.isArray(dossiersData?.dossiers) ? dossiersData.dossiers : [];
      const def = list.find((d) => d.isDefault) ?? list[0];
      if (def?.name) setDossierName(def.name);
    }
  }, [dossiersData, step, dossierName]);

  const dossiers: any[] = Array.isArray(dossiersData?.dossiers) ? dossiersData.dossiers : [];
  const dossierUsers: any[] = Array.isArray(dossierUsersData?.dossierUsers) ? dossierUsersData.dossierUsers : [];

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="w-[400px] bg-surface border border-line-soft rounded-lg shadow-card p-7">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-md text-white font-extrabold flex items-center justify-center"
               style={{ background: 'var(--gradient-hero)' }}>GC</div>
          <div>
            <div className="font-extrabold text-[15px]">Gestion Commerciale</div>
            <div className="text-[11px] text-ink-muted">
              {step === 'credentials' && 'Étape 1/3 — Compte cloud'}
              {step === 'agent' && 'Étape 2/3 — Choix de la pharmacie'}
              {step === 'dossier' && 'Étape 3/3 — Dossier et utilisateur'}
            </div>
          </div>
        </div>
        <div className="flex gap-1.5 my-4">
          {(['credentials', 'agent', 'dossier'] as Step[]).map((s, i) => (
            <div key={s} className="h-1 flex-1 rounded-full"
                 style={{ background: ['credentials', 'agent', 'dossier'].indexOf(step) >= i ? 'var(--brand-700)' : 'var(--line-soft)' }} />
          ))}
        </div>

        {error && (
          <div className="text-[12px] rounded-md px-3 py-2 mb-3"
               style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        {step === 'credentials' && (
          <form onSubmit={handleIdentify} className="flex flex-col gap-3">
            <label className="text-[11px] font-bold text-ink-label">
              Identifiant
              <input className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink"
                     value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
            </label>
            <label className="text-[11px] font-bold text-ink-label">
              Mot de passe
              <input type="password" className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink"
                     value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <button type="submit" disabled={identifying}
                    className="mt-2 rounded-md py-2.5 font-bold text-white bg-brand-700 disabled:opacity-60">
              {identifying ? 'Connexion…' : 'Continuer'}
            </button>
          </form>
        )}

        {step === 'agent' && (
          <div className="flex flex-col gap-2">
            {agents.map((a) => (
              <button key={a.agentId} onClick={() => { setSelectedAgent(a); setNeedsForce(false); setError(null); }}
                      className={`flex items-center gap-3 border rounded-md px-3 py-2.5 text-left ${selectedAgent?.agentId === a.agentId ? 'border-brand-500 bg-brand-50' : 'border-line'}`}>
                <span className="w-8 h-8 rounded-sm bg-brand-100 text-brand-700 font-extrabold text-[11px] flex items-center justify-center">PC</span>
                <span className="flex-1">
                  <span className="block font-bold text-[12.5px]">{a.label || a.agentId}</span>
                  <span className="block text-[10.5px] text-ink-muted">{a.agentId}{a.lastDossier ? ` · ${a.lastDossier}` : ''}</span>
                </span>
                <span className="text-[10px] font-bold" style={{ color: a.isOnline ? 'var(--success)' : 'var(--text-muted)' }}>
                  {a.isOnline ? 'En ligne' : 'Hors ligne'}
                </span>
              </button>
            ))}
            <div className="flex gap-2 mt-2">
              <button onClick={() => setStep('credentials')} className="flex-1 border border-line rounded-md py-2 font-bold text-ink-label">Retour</button>
              <button onClick={() => handleConnectAgent(needsForce)} disabled={!selectedAgent || connecting}
                      className="flex-[2] rounded-md py-2 font-bold text-white bg-brand-700 disabled:opacity-60">
                {connecting ? 'Connexion…' : needsForce ? 'Forcer la connexion' : 'Continuer'}
              </button>
            </div>
          </div>
        )}

        {step === 'dossier' && (
          <form onSubmit={handleDossierLogin} className="flex flex-col gap-3">
            <label className="text-[11px] font-bold text-ink-label">
              Dossier / exercice
              <select className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink"
                      value={dossierName} onChange={(e) => setDossierName(e.target.value)}>
                {loadingDossiers && <option>Chargement…</option>}
                {dossiers.map((d: any) => (
                  <option key={d.name} value={d.name}>{d.name}{d.isDefault ? ' (défaut)' : ''}</option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-bold text-ink-label">
              Utilisateur du dossier
              {dossierUsers.length > 0 ? (
                <select className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink"
                        value={dossierUsername} onChange={(e) => setDossierUsername(e.target.value)}>
                  <option value="">— choisir —</option>
                  {dossierUsers.map((u: any) => (
                    <option key={u.id ?? u.username} value={u.username ?? u.UserName}>{u.username ?? u.UserName}</option>
                  ))}
                </select>
              ) : (
                <input className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink"
                       value={dossierUsername} onChange={(e) => setDossierUsername(e.target.value)} />
              )}
            </label>
            <label className="text-[11px] font-bold text-ink-label">
              Mot de passe
              <input type="password" className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink"
                     value={dossierPassword} onChange={(e) => setDossierPassword(e.target.value)} />
            </label>
            <button type="submit" disabled={loggingDossierUser}
                    className="mt-2 rounded-md py-2.5 font-bold text-white bg-brand-700 disabled:opacity-60">
              {loggingDossierUser ? 'Ouverture…' : 'Ouvrir le dossier'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
