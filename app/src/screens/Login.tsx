import { useEffect, useRef, useState } from 'react';
import { useMutation, useLazyQuery } from '@apollo/client';
import { LOGIN_IDENTIFY, LOGIN_WITH_AGENT, DOSSIERS, DOSSIER_USERS, LOGIN_DOSSIER_USER, LOGIN_WITH_API_KEY } from '../api/auth';
import { useSession, getDeviceId, AgentInfo, dossierUserDepuisLogin } from '../store/session';
import { Button, IconButton } from '../components/ui/Button';
import { Field, Select, TextInput } from '../components/ui/Field';
import { Alert } from '../components/ui/States';
import { Badge } from '../components/ui/atoms';
import { Icon, IconBadge } from '../components/ui/Icon';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { messageErreur } from '../api/erreurs';
import { lireCodeAppairage } from '../lib/appairage';

type Step = 'credentials' | 'agent' | 'dossier';

const STATUT_MESSAGES: Record<string, string> = {
  mauvais_mdp: 'Identifiant ou mot de passe incorrect.',
  expire: 'Abonnement expiré — contactez SOFTLY.',
  suspendu: 'Abonnement suspendu — contactez SOFTLY.',
  bloque: 'Compte bloqué — contactez SOFTLY.',
  agent_offline: "Cet agent est hors ligne. Démarrez l'agent sur le PC de l'établissement.",
  agent_invalide: "Code d'appairage invalide ou révoqué — recopiez-le depuis l'agent.",
  max_appareils_atteint: "Nombre maximum d'appareils atteint pour ce compte.",
};

export default function Login() {
  const session = useSession();
  // Jeton cloud encore valide (ex. session d'avant les droits serveur) : on reprend au choix du dossier
  const [step, setStep] = useState<Step>(session.token ? 'dossier' : 'credentials');
  const [username, setUsername] = useState('');
  // Déconnexion subie (jeton expiré, session fermée ailleurs) : expliquée en haut du formulaire
  const motifDeconnexion = useSession((s) => s.motifDeconnexion);
  const effacerMotif = useSession((s) => s.effacerMotifDeconnexion);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tokenTemp, setTokenTemp] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null);
  const [needsForce, setNeedsForce] = useState(false);
  // Confirmation explicite avant d'éjecter la session ouverte sur un autre poste
  const [confirmerForce, setConfirmerForce] = useState(false);
  // Connexion alternative : code d'appairage copié depuis le tray de l'agent
  const [modeAppairage, setModeAppairage] = useState(false);
  const [codeAppairage, setCodeAppairage] = useState('');
  const [voirCode, setVoirCode] = useState(false);
  const fichierRef = useRef<HTMLInputElement>(null);
  // Affichage du mot de passe en clair (bouton œil)
  const [voirMdp, setVoirMdp] = useState(false);

  const [dossierName, setDossierName] = useState('');
  const [dossierUsername, setDossierUsername] = useState('');
  const [dossierPassword, setDossierPassword] = useState('');

  const [identify, { loading: identifying }] = useMutation(LOGIN_IDENTIFY);
  const [loginWithAgent, { loading: connecting }] = useMutation(LOGIN_WITH_AGENT);
  const [loadDossiers, { data: dossiersData, loading: loadingDossiers }] = useLazyQuery(DOSSIERS, { fetchPolicy: 'network-only' });
  const [loadDossierUsers, { data: dossierUsersData }] = useLazyQuery(DOSSIER_USERS, { fetchPolicy: 'network-only' });
  const [loginDossierUser, { loading: loggingDossierUser }] = useMutation(LOGIN_DOSSIER_USER);
  const [loginWithApiKey, { loading: appairage }] = useMutation(LOGIN_WITH_API_KEY);

  /**
   * Code d'appairage = contenu du QR du tray : JSON { u, k, a }. Évite le
   * compte cloud (poste dédié à une pharmacie) ; même flux ensuite (dossier).
   */
  async function handleAppairage(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    effacerMotif();
    // Tolérant aux copies abîmées par les messageries (guillemets typographiques, texte autour…)
    const code = lireCodeAppairage(codeAppairage);
    if (!code) { setError("Code d'appairage illisible : utilisez « Copier le code d'appairage » dans l'agent, ou importez le fichier d'appairage."); return; }
    try {
      const { data } = await loginWithApiKey({ variables: { input: { apiKey: code.k, agent_id: code.a } } });
      const res = data?.loginWithApiKey;
      if (!res?.success || !res.access_token) {
        setError(STATUT_MESSAGES[res?.statut ?? ''] ?? res?.message ?? 'Appairage refusé.');
        return;
      }
      const agent: AgentInfo = { agentId: code.a, label: code.a, isOnline: true };
      session.setAuth(res.access_token, agent);
      // Le code contient la clé d'API : on ne le laisse ni à l'écran ni dans le presse-papiers
      void viderPressePapiers(codeAppairage);
      setCodeAppairage('');
      setVoirCode(false);
      setSelectedAgent(agent);
      setStep('dossier');
      void loadDossiers();
      void loadDossierUsers();
    } catch (err: any) {
      setError(messageErreur(err, 'Serveur injoignable.'));
    }
  }

  /** Fichier d'appairage (exporté par l'agent, ou code enregistré dans un .txt) : lu localement. */
  async function importerFichier(f: File) {
    setError(null);
    if (f.size > 64 * 1024) { setError('Fichier trop volumineux pour un code d’appairage.'); return; }
    try {
      const texte = await f.text();
      if (!lireCodeAppairage(texte)) { setError(`Aucun code d’appairage lisible dans « ${f.name} ».`); return; }
      setCodeAppairage(texte.trim());
    } catch {
      setError(`Lecture impossible de « ${f.name} ».`);
    }
  }

  async function handleIdentify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    effacerMotif();
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
      setError(messageErreur(err, 'Serveur injoignable.'));
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
        setError('Ce compte est déjà connecté à cet établissement sur un autre poste. Chaque personne doit utiliser son propre compte ; sinon, vous pouvez forcer la connexion.');
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
      setError(messageErreur(err, 'Serveur injoignable.'));
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
      session.setDossierUser(dossierUserDepuisLogin(res));
    } catch (err: any) {
      setError(messageErreur(err, 'Erreur de connexion.'));
    }
  }

  // Reprise directe à l'étape dossier : charger listes et dossier courant
  useEffect(() => {
    if (step === 'dossier' && session.token && !dossiersData) {
      if (session.dossier) setDossierName(session.dossier);
      void loadDossiers();
      void loadDossierUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step === 'dossier' && !dossierName) {
      const list: any[] = Array.isArray(dossiersData?.dossiers) ? dossiersData.dossiers : [];
      const def = list.find((d) => d.isDefault) ?? list[0];
      if (def?.name) setDossierName(def.name);
    }
  }, [dossiersData, step, dossierName]);

  const dossiers: any[] = Array.isArray(dossiersData?.dossiers) ? dossiersData.dossiers : [];
  const dossierUsers: any[] = Array.isArray(dossierUsersData?.dossierUsers) ? dossierUsersData.dossierUsers : [];

  const ETAPES: { id: Step; libelle: string }[] = [
    { id: 'credentials', libelle: 'Compte' },
    { id: 'agent', libelle: 'Établissement' },
    { id: 'dossier', libelle: 'Dossier' },
  ];
  const indexEtape = ETAPES.findIndex((e) => e.id === step);

  return (
    <div className="min-h-screen flex bg-bg">
      {/* Panneau de marque */}
      <aside className="hidden lg:flex w-[44%] max-w-[620px] flex-col justify-between p-10 text-ink-inverse relative overflow-hidden"
             style={{ background: 'var(--gradient-hero)' }}>
        <span aria-hidden="true" className="absolute -right-24 -top-24 w-96 h-96 rounded-full" style={{ background: 'rgb(255 255 255 / .07)' }} />
        <span aria-hidden="true" className="absolute -left-20 bottom-10 w-72 h-72 rounded-full" style={{ background: 'rgb(255 255 255 / .05)' }} />
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-md font-extrabold text-lg flex items-center justify-center" style={{ background: 'rgb(255 255 255 / .18)' }}>GC</div>
          <div>
            <div className="font-extrabold text-lg leading-tight">Gestion Commerciale</div>
            <div className="text-2xs font-bold uppercase tracking-widest" style={{ color: 'var(--gold-400)' }}>SOFTLY · Desktop</div>
          </div>
        </div>
        <div className="relative">
          <h1 className="text-3xl font-extrabold tracking-tight leading-tight">Ventes, stock et trésorerie,<br />au même endroit.</h1>
          <ul className="mt-6 flex flex-col gap-3 text-base opacity-95">
            {([
              ['receipt', 'Factures, bons de livraison et comptoir en quelques touches'],
              ['package', 'Stock, lots et péremptions suivis en temps réel'],
              ['wallet', 'Caisses, banques, échéances et recouvrement'],
              ['keyboard', 'Pensé pour le clavier : F2, F3, F10, Ctrl+K'],
            ] as const).map(([icone, texte]) => (
              <li key={texte} className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-md flex items-center justify-center flex-none" style={{ background: 'rgb(255 255 255 / .14)' }}>
                  <Icon name={icone} size={16} />
                </span>
                {texte}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative text-xs opacity-75">Connexion sécurisée au serveur SOFTLY · vos données restent sur le PC de l’établissement.</div>
      </aside>

      {/* Formulaire */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-md text-ink-inverse font-extrabold flex items-center justify-center" style={{ background: 'var(--gradient-hero)' }}>GC</div>
            <div className="font-extrabold text-lg">Gestion Commerciale</div>
          </div>

          {/* Étapes */}
          <ol className="flex items-center gap-2 mb-6" aria-label="Étapes de connexion">
            {ETAPES.map((e, i) => {
              const fait = i < indexEtape;
              const courant = i === indexEtape;
              return (
                <li key={e.id} className="flex items-center gap-2 flex-1 min-w-0" aria-current={courant ? 'step' : undefined}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-2xs font-extrabold flex-none transition-colors ${
                    fait ? 'bg-success-solid text-ink-inverse' : courant ? 'bg-brand-700 text-ink-inverse' : 'bg-line-soft text-ink-muted'}`}>
                    {fait ? <Icon name="check" size={12} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className={`text-xs font-semibold truncate ${courant ? 'text-ink' : 'text-ink-muted'}`}>{e.libelle}</span>
                  {i < ETAPES.length - 1 && <span className={`h-px flex-1 ${fait ? 'bg-success-solid' : 'bg-line'}`} />}
                </li>
              );
            })}
          </ol>

          <div className="bg-surface border border-line-soft rounded-lg shadow-card p-7">
            <h2 className="text-xl font-extrabold text-ink">
              {step === 'credentials' && (modeAppairage ? 'Code d’appairage' : 'Connexion à votre compte')}
              {step === 'agent' && 'Choisissez l’établissement'}
              {step === 'dossier' && 'Ouvrir un dossier'}
            </h2>
            <p className="text-sm text-ink-muted mt-1 mb-5">
              {step === 'credentials' && (modeAppairage ? 'Pour un poste dédié, sans compte cloud.' : 'Identifiants de votre compte SOFTLY.')}
              {step === 'agent' && 'Le PC (agent) qui héberge les données de l’établissement.'}
              {step === 'dossier' && 'Exercice comptable et utilisateur du dossier.'}
            </p>

            {motifDeconnexion && step === 'credentials' && !error && (
              <Alert tone="warning" compact className="mb-4" onClose={effacerMotif}>{motifDeconnexion}</Alert>
            )}
            {error && <Alert tone="danger" compact className="mb-4">{error}</Alert>}

            {step === 'credentials' && modeAppairage && (
              <form onSubmit={handleAppairage} className="flex flex-col gap-4"
                    onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
                    onDrop={(e) => { const f = e.dataTransfer.files?.[0]; if (f) { e.preventDefault(); void importerFichier(f); } }}>
                <Field label="Code d’appairage" help="Dans l’agent de l’établissement, cliquez sur « Copier le code d’appairage », puis collez-le ici — ou importez / glissez le fichier d’appairage.">
                  <TextInput size="lg" leading="lock" mono type={voirCode ? 'text' : 'password'}
                             autoComplete="off" spellCheck={false}
                             value={codeAppairage} onChange={(e) => setCodeAppairage(e.target.value)} autoFocus
                             placeholder="Collez le code ici (Ctrl+V)"
                             trailing={<IconButton icon={voirCode ? 'eyeOff' : 'eye'} size="xs" label={voirCode ? 'Masquer le code' : 'Afficher le code'}
                                                   onClick={() => setVoirCode((v) => !v)} />} />
                </Field>
                <input ref={fichierRef} type="file" accept=".druxamed-pairing,.json,.txt" className="sr-only" tabIndex={-1} aria-hidden="true"
                       onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importerFichier(f); }} />
                <Button icon="upload" block onClick={() => fichierRef.current?.click()}>Importer un fichier d’appairage</Button>
                <Button type="submit" variant="primary" size="lg" block loading={appairage} disabled={!codeAppairage.trim()} iconRight="arrowRight">
                  {appairage ? 'Connexion…' : 'Se connecter'}
                </Button>
                <Button variant="link" icon="arrowLeft" onClick={() => { setModeAppairage(false); setError(null); }} className="self-center">
                  Connexion avec un compte cloud
                </Button>
              </form>
            )}

            {step === 'credentials' && !modeAppairage && (
              <form onSubmit={handleIdentify} className="flex flex-col gap-4">
                <Field label="Identifiant">
                  <TextInput size="lg" leading="user" autoComplete="username"
                             value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
                </Field>
                <Field label="Mot de passe">
                  <TextInput size="lg" leading="lock" type={voirMdp ? 'text' : 'password'} autoComplete="current-password"
                             value={password} onChange={(e) => setPassword(e.target.value)}
                             trailing={<IconButton icon={voirMdp ? 'eyeOff' : 'eye'} size="xs" label={voirMdp ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                                                   onClick={() => setVoirMdp((v) => !v)} />} />
                </Field>
                <Button type="submit" variant="primary" size="lg" block loading={identifying} iconRight="arrowRight" className="mt-1">
                  {identifying ? 'Connexion…' : 'Continuer'}
                </Button>
                <div className="flex items-center gap-3 text-xs text-ink-muted"><span className="h-px flex-1 bg-line-soft" />ou<span className="h-px flex-1 bg-line-soft" /></div>
                <Button icon="scanBarcode" block onClick={() => { setModeAppairage(true); setError(null); }}>
                  Se connecter avec un code d’appairage
                </Button>
              </form>
            )}

            {step === 'agent' && (
              <div className="flex flex-col gap-2.5">
                <div role="radiogroup" aria-label="Établissement" className="flex flex-col gap-2 max-h-[320px] overflow-auto">
                  {agents.map((a) => {
                    const sel = selectedAgent?.agentId === a.agentId;
                    return (
                      <button key={a.agentId} role="radio" aria-checked={sel}
                              onClick={() => { setSelectedAgent(a); setNeedsForce(false); setError(null); }}
                              className={`flex items-center gap-3 border rounded-md px-3 py-2.5 text-left transition-colors ${sel ? 'border-brand-line bg-brand-soft' : 'border-line-soft hover:border-line-strong hover:bg-hover'}`}>
                        <IconBadge name="server" tone={a.isOnline ? 'brand' : 'neutral'} size="md" />
                        <span className="flex-1 min-w-0">
                          <span className="block font-bold text-base text-ink truncate">{a.label || a.agentId}</span>
                          <span className="block text-xs text-ink-muted truncate">{a.agentId}{a.lastDossier ? ` · ${a.lastDossier}` : ''}</span>
                        </span>
                        <Badge tone={a.isOnline ? 'success' : 'neutral'} dot>{a.isOnline ? 'En ligne' : 'Hors ligne'}</Badge>
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-3">
                  <Button icon="arrowLeft" onClick={() => setStep('credentials')} size="lg">Retour</Button>
                  <Button variant={needsForce ? 'danger-solid' : 'primary'} size="lg" block iconRight="arrowRight"
                          onClick={() => (needsForce ? setConfirmerForce(true) : void handleConnectAgent())}
                          disabled={!selectedAgent} loading={connecting}>
                    {connecting ? 'Connexion…' : needsForce ? 'Forcer la connexion' : 'Continuer'}
                  </Button>
                </div>
              </div>
            )}

            {step === 'dossier' && (
              <form onSubmit={handleDossierLogin} className="flex flex-col gap-4">
                <Field label="Dossier / exercice">
                  <Select size="lg" value={dossierName} onChange={(e) => setDossierName(e.target.value)}>
                    {loadingDossiers && <option>Chargement…</option>}
                    {dossiers.map((d: any) => (
                      <option key={d.name} value={d.name}>{d.name}{d.isDefault ? ' (défaut)' : ''}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Utilisateur du dossier">
                  {dossierUsers.length > 0 ? (
                    <Select size="lg" value={dossierUsername} onChange={(e) => setDossierUsername(e.target.value)}>
                      <option value="">— choisir —</option>
                      {dossierUsers.map((u: any) => (
                        <option key={u.id ?? u.username} value={u.username ?? u.UserName}>{u.username ?? u.UserName}</option>
                      ))}
                    </Select>
                  ) : (
                    <TextInput size="lg" leading="user" autoComplete="username"
                               value={dossierUsername} onChange={(e) => setDossierUsername(e.target.value)} />
                  )}
                </Field>
                <Field label="Mot de passe">
                  <TextInput size="lg" leading="lock" type={voirMdp ? 'text' : 'password'} autoComplete="current-password"
                             value={dossierPassword} onChange={(e) => setDossierPassword(e.target.value)}
                             trailing={<IconButton icon={voirMdp ? 'eyeOff' : 'eye'} size="xs" label={voirMdp ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                                                   onClick={() => setVoirMdp((v) => !v)} />} />
                </Field>
                <Button type="submit" variant="primary" size="lg" block loading={loggingDossierUser} icon="folder" className="mt-1">
                  {loggingDossierUser ? 'Ouverture…' : 'Ouvrir le dossier'}
                </Button>
              </form>
            )}
          </div>
          <p className="text-center text-xs text-ink-muted mt-5">Besoin d’aide ? Contactez le support SOFTLY.</p>
        </div>
      </main>

      {confirmerForce && (
        <ConfirmDialog danger title="Forcer la connexion ?" confirmLabel="Forcer la connexion" cancelLabel="Annuler"
                       loading={connecting}
                       message={(
                         <>
                           <p>Une autre session utilise déjà <strong>{selectedAgent?.label || selectedAgent?.agentId}</strong>.</p>
                           <p className="mt-2">Si vous continuez, l’autre poste sera <strong>déconnecté</strong> : une vente ou une saisie en cours y sera interrompue.</p>
                           <p className="mt-2 text-sm text-ink-muted">Deux caisses ouvertes avec le même compte se déconnectent mutuellement : créez un compte par personne.</p>
                         </>
                       )}
                       onCancel={() => setConfirmerForce(false)}
                       onConfirm={() => { setConfirmerForce(false); void handleConnectAgent(true); }} />
      )}
    </div>
  );
}

/**
 * Vide le presse-papiers s'il contient encore le code d'appairage (clé d'API) qui vient d'être utilisé.
 * Sans effet si l'utilisateur a copié autre chose entre-temps ou si l'accès est refusé.
 */
async function viderPressePapiers(code: string) {
  try {
    const actuel = await navigator.clipboard.readText();
    if (actuel.trim() && actuel.trim() === code.trim()) await navigator.clipboard.writeText('');
  } catch { /* presse-papiers inaccessible : rien à faire */ }
}
