import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { DOSSIERS, DOSSIER_USERS, LOGIN_DOSSIER_USER } from '../api/auth';
import { apollo } from '../api/client';
import { useSession, dossierUserDepuisLogin } from '../store/session';
import Dialog from './ui/Dialog';
import { Button } from './ui/Button';
import { Field, Select, TextInput } from './ui/Field';
import { Alert } from './ui/States';

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
    <Dialog title="Changer de dossier" subtitle="Chaque dossier est une base distincte : ré-identifiez-vous pour y accéder."
            icon="folder" size="sm" onClose={onClose} closeOnOverlay={false}
            footer={(
              <>
                <Button onClick={onClose} disabled={loading}>Annuler</Button>
                <Button variant="primary" icon="folder" onClick={() => void valider()} loading={loading}>
                  {loading ? 'Ouverture…' : 'Ouvrir le dossier'}
                </Button>
              </>
            )}>
      <div className="flex flex-col gap-4">
        {erreur && <Alert tone="danger" compact>{erreur}</Alert>}
        <Field label="Dossier / exercice">
          <Select value={dossier} onChange={(e) => setDossier(e.target.value)}>
            {loadingDossiers && <option>Chargement…</option>}
            {dossiers.map((d: any) => (
              <option key={d.name} value={d.name}>{d.name}{d.isDefault ? ' (défaut)' : ''}</option>
            ))}
          </Select>
        </Field>
        <Field label="Utilisateur du dossier">
          {users.length > 0 ? (
            <Select value={username} onChange={(e) => setUsername(e.target.value)}>
              <option value="">— choisir —</option>
              {users.map((u: any, i: number) => {
                const v = String(u.username ?? u.UserName ?? '');
                return <option key={i} value={v}>{v}</option>;
              })}
            </Select>
          ) : (
            <TextInput leading="user" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          )}
        </Field>
        <Field label="Mot de passe">
          <TextInput type="password" leading="lock" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
                     onKeyDown={(e) => { if (e.key === 'Enter') void valider(); }} />
        </Field>
      </div>
    </Dialog>
  );
}
