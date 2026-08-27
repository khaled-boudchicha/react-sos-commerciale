import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { COORDONNEES_SOCIETE, UPDATE_COORDONNEES, NUMEROTATION_DOCS, SET_NUMEROTATION } from '../api/queries';
import FormModal from '../components/ui/FormModal';
import { useSession } from '../store/session';
import { PageHeader } from '../components/ui/atoms';

export function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.dataset.theme = theme;
  void window.gc?.store.set('theme', theme);
}

export async function loadTheme() {
  const saved = (await window.gc?.store.get('theme')) as 'light' | 'dark' | undefined;
  if (saved) document.documentElement.dataset.theme = saved;
  return saved ?? 'light';
}

export default function Parametres() {
  const { cloudUrl, setCloudUrl, agent, dossier } = useSession();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [url, setUrl] = useState(cloudUrl);
  const { data, refetch } = useQuery(COORDONNEES_SOCIETE);
  const coord = (data?.coordonneesSociete ?? {}) as Record<string, unknown>;
  const [editCoord, setEditCoord] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [updateCoord, { loading: savingCoord }] = useMutation(UPDATE_COORDONNEES);

  const { data: numData, refetch: refetchNum } = useQuery(NUMEROTATION_DOCS);
  const [setNum, { loading: savingNum }] = useMutation(SET_NUMEROTATION);
  const [editNum, setEditNum] = useState<{ type: string; valeur: string } | null>(null);

  // getNumerotationDocs renvoie un tableau [{ type, format, compteur }]
  const numerotations = (Array.isArray(numData?.numerotationDocs) ? numData.numerotationDocs : [])
    .map((n: any) => ({
      type: String(n.type),
      masque: String(n.format ?? ''),
      compteur: Number(n.compteur ?? 0),
    }));

  useEffect(() => { void loadTheme().then(setTheme); }, []);

  return (
    <div className="flex flex-col gap-3.5 max-w-[720px]">
      <PageHeader title="Paramètres" />

      <section className="bg-surface border border-line-soft rounded-md shadow-soft p-4">
        <h2 className="font-bold text-[13px] mb-3">Apparence</h2>
        <div className="flex gap-2">
          {(['light', 'dark'] as const).map((t) => (
            <button key={t} onClick={() => { setTheme(t); applyTheme(t); }}
                    className={`px-4 py-2 rounded-md border text-[12px] font-bold ${theme === t ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line text-ink-label'}`}>
              {t === 'light' ? '☀️ Clair' : '🌙 Sombre'}
            </button>
          ))}
        </div>
      </section>

      <section className="bg-surface border border-line-soft rounded-md shadow-soft p-4">
        <h2 className="font-bold text-[13px] mb-3">Connexion</h2>
        <div className="text-[12px] text-ink-label flex flex-col gap-1.5">
          <div>Agent : <b>{agent?.label ?? agent?.agentId}</b></div>
          <div>Dossier : <b>{dossier}</b></div>
          <label className="mt-2 text-[11px] font-bold">
            Serveur cloud (GraphQL)
            <div className="flex gap-2 mt-1">
              <input className="flex-1 border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal" value={url}
                     onChange={(e) => setUrl(e.target.value)} />
              <button onClick={() => setCloudUrl(url)} className="px-4 rounded-md bg-brand-700 text-white font-bold">Appliquer</button>
            </div>
          </label>
        </div>
      </section>

      <section className="bg-surface border border-line-soft rounded-md shadow-soft p-4">
        <div className="flex items-center mb-3">
          <h2 className="font-bold text-[13px]">Coordonnées de la société</h2>
          <button onClick={() => { setErreur(null); setEditCoord(true); }}
                  className="ml-auto rounded-md px-3 py-1.5 font-bold text-[12px] border border-line text-ink-label">
            Modifier
          </button>
        </div>
        {erreur && <div className="text-[12px] mb-2" style={{ color: 'var(--danger)' }}>{erreur}</div>}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px]">
          {['raison_sociale', 'adresse', 'telephone', 'email', 'nif', 'nis', 'rc', 'art'].map((k) => (
            <div key={k} className="flex justify-between border-b border-line-soft py-1">
              <span className="text-ink-muted uppercase text-[10px] font-bold tracking-wide">{k.replace('_', ' ')}</span>
              <span className="font-semibold">{String(coord[k] ?? '—')}</span>
            </div>
          ))}
        </div>
      </section>

      {editCoord && (
        <FormModal
          title="Coordonnées de la société"
          width={760}
          loading={savingCoord}
          error={erreur}
          initial={coord}
          sections={[
            { title: 'Identité', fields: [
              { name: 'raison_sociale', label: 'Raison sociale', span: 8, required: true },
              { name: 'slogan', label: 'Slogan', span: 4 },
              { name: 'adresse', label: 'Adresse', span: 12 },
            ] },
            { title: 'Contacts', fields: [
              { name: 'telephone', label: 'Téléphone', span: 4 },
              { name: 'fax', label: 'Fax', span: 4 },
              { name: 'email', label: 'Email', span: 4 },
              { name: 'site_web', label: 'Site web', span: 12 },
            ] },
            { title: 'Identifiants fiscaux (imprimés sur les documents)', fields: [
              { name: 'rc', label: 'RC', span: 3 },
              { name: 'nif', label: 'NIF', span: 3 },
              { name: 'nis', label: 'NIS', span: 3 },
              { name: 'art', label: 'Art. Imp.', span: 3 },
            ] },
          ]}
          onCancel={() => setEditCoord(false)}
          onSubmit={async (values) => {
            setErreur(null);
            try {
              await updateCoord({ variables: { input: values } });
              setEditCoord(false);
              void refetch();
            } catch (e: any) { setErreur(e.message ?? 'Enregistrement impossible.'); }
          }}
        />
      )}

      <section className="bg-surface border border-line-soft rounded-md shadow-soft p-4">
        <h2 className="font-bold text-[13px] mb-1">Numérotation des documents</h2>
        <div className="text-[11px] text-ink-muted mb-3">
          Le compteur est le dernier numéro attribué : la prochaine pièce prendra la valeur suivante.
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px]">
          {numerotations.length === 0 && <div className="text-ink-muted">Aucune numérotation configurée.</div>}
          {numerotations.map((n: { type: string; masque: string; compteur: number }) => (
            <div key={n.type} className="flex items-center gap-2 border-b border-line-soft py-1.5">
              <span className="font-semibold flex-1">{n.type}</span>
              <span className="text-ink-muted money text-[11px]">{n.masque}</span>
              <span className="money font-bold">{n.compteur}</span>
              <button onClick={() => setEditNum({ type: n.type, valeur: String(n.compteur) })}
                      className="px-1.5 py-0.5 rounded-sm border border-line text-ink-muted text-[11px]" title="Modifier le compteur">✎</button>
            </div>
          ))}
        </div>
      </section>

      {editNum && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgb(15 26 46 / .45)' }}>
          <div className="w-[420px] bg-surface border border-line-soft rounded-lg shadow-lifted p-5">
            <div className="font-extrabold text-[15px] mb-1">Compteur — {editNum.type}</div>
            <div className="text-[11.5px] text-ink-muted mb-4">
              Attention : abaisser un compteur peut provoquer des numéros en double.
            </div>
            <input type="number" value={editNum.valeur} autoFocus
                   onChange={(e) => setEditNum({ ...editNum, valeur: e.target.value })}
                   className="w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink money text-right" />
            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditNum(null)} disabled={savingNum}
                      className="flex-1 border border-line rounded-md py-2.5 font-bold text-ink-label disabled:opacity-60">Annuler</button>
              <button disabled={savingNum}
                      onClick={async () => {
                        try {
                          await setNum({ variables: { type: editNum.type, valeur: Number(editNum.valeur) } });
                          setEditNum(null);
                          void refetchNum();
                        } catch (e: any) { setErreur(e.message ?? 'Erreur.'); setEditNum(null); }
                      }}
                      className="flex-[2] rounded-md py-2.5 font-bold text-white bg-brand-700 disabled:opacity-60">
                {savingNum ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
