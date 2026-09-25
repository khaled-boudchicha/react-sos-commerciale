import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { DOSSIERS, DOSSIER_USERS, LOGIN_DOSSIER_USER } from '../api/auth';
import { apollo } from '../api/client';
import { useSession, dossierUserDepuisLogin } from '../store/session';

/**
 * Changement de dossier (exercice) sans se déconnecter du cloud.
 *
 * Un dossier = une base de données : les utilisateurs dossier sont propres à
 * chacun, il faut donc se ré-identifier après le changement. Le cache Apollo est
 * vidé pour ne pas mélanger les données de deux dossiers.
 */
export default function DossierSwitcher({ onClose }: { onClose: () => void }) {
  // Sélecteurs ciblés (pas tout le store) : la modale ne se re-rend que si le
  // dossier / l'utilisateur de session change, pas à chaque veille ou refresh.
  const sessionDossier = useSession((s) => s.dossier);
  const sessionDossierUser = useSession((s) => s.dossierUser);
  const setSessionDossier = useSession((s) => s.setDossier);
  const setSessionDossierUser = useSession((s) => s.setDossierUser);

  const [dossier, setDossier] = useState(sessionDossier ?? '');
  const [username, setUsername] = useState(String(sessionDossierUser?.username ?? ''));
  const [password, setPassword] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);

  const { data: dossiersData, loading: loadingDossiers } = useQuery(DOSSIERS, { fetchPolicy: 'network-only' });
  const [loginDossierUser, { loading }] = useMutation(LOGIN_DOSSIER_USER);

  const dossiers: any[] = Array.isArray(dossiersData?.dossiers) ? dossiersData.dossiers : [];

  // Le nom stocké en session peut différer de la liste par la casse
  // (« bon 2026 » vs « BON 2026 ») : sans réalignement, le <select> retomberait
  // silencieusement sur la première entrée et on changerait de dossier par erreur.
  useEffect(() => {
    if (!dossiers.length) return;
    const exact = dossiers.some((d: any) => d.name === dossier);
    if (exact) return;
    const equivalent = dossiers.find(
      (d: any) => String(d.name).toLowerCase() === String(sessionDossier ?? '').toLowerCase(),
    );
    setDossier(equivalent?.name ?? dossiers[0]?.name ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossiersData]);

  // Les utilisateurs sont propres à chaque dossier : on (re)charge la liste du
  // dossier SÉLECTIONNÉ (et non celui de la session) via un override d'en-tête,
  // pour que le menu propose les utilisateurs de la base cible.
  useEffect(() => {
    if (!dossier) { setUsers([]); return; }
    let annule = false;
    apollo
      .query({ query: DOSSIER_USERS, fetchPolicy: 'network-only', context: { dossierOverride: dossier } })
      .then(({ data }) => {
        if (annule) return;
        const list: any[] = Array.isArray(data?.dossierUsers) ? data.dossierUsers : [];
        setUsers(list);
        // Un utilisateur sélectionné absent du dossier cible est réinitialisé.
        setUsername((u) => (list.some((x: any) => String(x.username ?? x.UserName ?? '') === u) ? u : ''));
      })
      .catch(() => { if (!annule) setUsers([]); });
    return () => { annule = true; };
  }, [dossier]);

  async function valider() {
    setErreur(null);
    if (!dossier) { setErreur('Choisissez un dossier.'); return; }
    if (!username) { setErreur('Choisissez un utilisateur.'); return; }
    // Le dossier est envoyé par en-tête à chaque requête : on l'applique avant
    // d'authentifier l'utilisateur, pour viser la bonne base.
    const ancien = sessionDossier;
    setSessionDossier(dossier);
    try {
      const { data } = await loginDossierUser({ variables: { username, password } });
      const res = data?.loginDossierUser;
      if (!res?.ok) {
        if (ancien) setSessionDossier(ancien);   // restauration en cas d'échec
        setErreur(res?.message ?? 'Utilisateur ou mot de passe incorrect.');
        return;
      }
      setSessionDossierUser(dossierUserDepuisLogin(res));
      // resetStore (et non clearStore) : vide le cache ET relance les requêtes
      // actives, pour que l'écran sous la modale recharge depuis la bonne base.
      // Le changement a réussi : une erreur de refetch ne doit PAS déclencher la
      // restauration du dossier précédent, on l'isole donc du catch ci-dessous.
      try { await apollo.resetStore(); } catch { /* refetch en erreur : l'écran se recharge à la navigation */ }
      onClose();
    } catch (e: any) {
      if (ancien) setSessionDossier(ancien);
      setErreur(e.message ?? 'Changement impossible.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgb(15 26 46 / .45)' }}>
      <div className="w-[460px] bg-surface border border-line-soft rounded-lg shadow-lifted p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="font-extrabold text-[15px]">Changer de dossier</div>
          <button onClick={onClose} className="text-ink-muted text-[18px] px-2">✕</button>
        </div>
        <div className="text-[11.5px] text-ink-muted mb-4">
          Chaque dossier est une base distincte : ré-identifiez-vous pour y accéder.
        </div>

        {erreur && (
          <div className="text-[12px] rounded-md px-3 py-2 mb-3"
               style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' }}>{erreur}</div>
        )}

        <div className="flex flex-col gap-3">
          <label className="text-[11px] font-bold text-ink-label">Dossier / exercice
            <select value={dossier} onChange={(e) => setDossier(e.target.value)}
                    className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal">
              {loadingDossiers && <option>Chargement…</option>}
              {dossiers.map((d: any) => (
                <option key={d.name} value={d.name}>{d.name}{d.isDefault ? ' (défaut)' : ''}</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-bold text-ink-label">Utilisateur du dossier
            {users.length > 0 ? (
              <select value={username} onChange={(e) => setUsername(e.target.value)}
                      className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal">
                <option value="">— choisir —</option>
                {users.map((u: any, i: number) => {
                  const v = String(u.username ?? u.UserName ?? '');
                  return <option key={i} value={v}>{v}</option>;
                })}
              </select>
            ) : (
              <input value={username} onChange={(e) => setUsername(e.target.value)}
                     className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal" />
            )}
          </label>
          <label className="text-[11px] font-bold text-ink-label">Mot de passe
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                   onKeyDown={(e) => { if (e.key === 'Enter') void valider(); }}
                   className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal" />
          </label>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} disabled={loading}
                  className="flex-1 border border-line rounded-md py-2.5 font-bold text-ink-label disabled:opacity-60">Annuler</button>
          <button onClick={() => void valider()} disabled={loading}
                  className="flex-[2] rounded-md py-2.5 font-bold text-white bg-brand-700 disabled:opacity-60">
            {loading ? 'Ouverture…' : 'Ouvrir le dossier'}
          </button>
        </div>
      </div>
    </div>
  );
}
