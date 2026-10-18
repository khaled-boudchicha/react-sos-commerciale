import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { INVENTAIRE, UPDATE_LIGNE_INVENTAIRE, CLOTURER_INVENTAIRE, COORDONNEES_SOCIETE } from '../api/queries';
import { fmtDate, fmtMoney, fmtQte } from '../lib/format';
import { PageHeader, StatusPill } from '../components/ui/atoms';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import ImprimerDocument from '../impression/ImprimerDocument';
import type { DemandeImpression } from '../impression/demandes';
import { demandeInventaire } from '../impression/demandes';

type LigneInv = {
  id: number; code_article: string; designation: string; unite?: string | null;
  qte_theorique: number; qte_reale: number; ecart: number;
  prix_pmp: number; valeur_theorique: number; valeur_reale: number; depot?: string | null;
};
type Inventaire = {
  id: number; date: string; designation?: string | null; is_closed?: number | null;
  nb_articles?: number; valeur_theorique?: number; valeur_reale?: number; ecart_valeur?: number;
  lignes?: LigneInv[];
};

/** Feuille de comptage : saisie des quantités réelles ligne par ligne, puis clôture
 *  (la clôture applique les quantités comptées au stock des articles). */
export default function InventaireDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [filtre, setFiltre] = useState('');
  const [ecartsOnly, setEcartsOnly] = useState(false);
  const [confirmCloture, setConfirmCloture] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Saisies locales en attente d'envoi (clé = id de ligne). */
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});

  const { data, loading, error: qError, refetch } = useQuery(INVENTAIRE, { variables: { id: Number(id) } });
  const inv: Inventaire | undefined = data?.inventaire ?? undefined;
  const closed = !!inv?.is_closed;

  const [updateLigne] = useMutation(UPDATE_LIGNE_INVENTAIRE);
  const [cloturer, { loading: cloturing }] = useMutation(CLOTURER_INVENTAIRE);
  const { data: socData } = useQuery(COORDONNEES_SOCIETE);
  const [printDoc, setPrintDoc] = useState<DemandeImpression | null>(null);

  function imprimer(vierge: boolean) {
    if (!inv) return;
    setPrintDoc(demandeInventaire(
      { inv, lignes: inv.lignes ?? [], vierge },
      (socData?.coordonneesSociete ?? {}) as Record<string, unknown>,
    ));
  }

  useEffect(() => { setDrafts({}); }, [id]);

  async function commit(ligne: LigneInv, raw: string) {
    const v = parseFloat(raw);
    if (!isFinite(v) || v === ligne.qte_reale) { setDrafts((d) => { const n = { ...d }; delete n[ligne.id]; return n; }); return; }
    setSaving((s) => ({ ...s, [ligne.id]: true }));
    try {
      await updateLigne({ variables: { id: ligne.id, qte_reale: v } });
      await refetch();
      setDrafts((d) => { const n = { ...d }; delete n[ligne.id]; return n; });
    } catch (e: any) {
      setError(e.message ?? 'Enregistrement impossible.');
    } finally {
      setSaving((s) => ({ ...s, [ligne.id]: false }));
    }
  }

  async function doCloture() {
    setError(null);
    try {
      await cloturer({ variables: { id: Number(id) } });
      setConfirmCloture(false);
      await refetch();
    } catch (e: any) {
      setConfirmCloture(false);
      setError(e.message ?? 'Clôture impossible.');
    }
  }

  const lignes = (inv?.lignes ?? []).filter((l) => {
    if (ecartsOnly && Math.abs(l.ecart) < 0.0001) return false;
    if (!filtre.trim()) return true;
    const t = filtre.toLowerCase();
    return l.designation?.toLowerCase().includes(t) || l.code_article?.toLowerCase().includes(t);
  });
  const nbEcarts = (inv?.lignes ?? []).filter((l) => Math.abs(l.ecart) > 0.0001).length;

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title={inv?.designation || `Inventaire #${id}`}>
        <Link to="/stock/inventaires" className="text-[12px] font-bold text-brand-700">← Inventaires</Link>
        {inv && (
          <button onClick={() => imprimer(true)}
                  className="rounded-md px-3 py-2 font-bold text-[12px] border border-line text-ink-label">
            Feuille de comptage
          </button>
        )}
        {inv && (
          <button onClick={() => imprimer(false)}
                  className="rounded-md px-3 py-2 font-bold text-[12px] border border-line text-ink-label">
            Imprimer l'état
          </button>
        )}
        {inv && !closed && (
          <button onClick={() => setConfirmCloture(true)}
                  className="rounded-md px-4 py-2 font-bold text-[12px] text-white bg-brand-700">
            Clôturer l'inventaire
          </button>
        )}
      </PageHeader>
      {printDoc && <ImprimerDocument demande={printDoc} onClose={() => setPrintDoc(null)} />}

      {error && <div className="text-[12px]" style={{ color: 'var(--danger)' }}>{error}</div>}
      {qError && <div className="text-[12px]" style={{ color: 'var(--danger)' }}>{qError.message}</div>}

      {inv && (
        <div className="bg-surface border border-line-soft rounded-md shadow-soft px-4 py-3.5 flex items-center gap-6 flex-wrap">
          <Head label="Date">{fmtDate(inv.date)}</Head>
          <Head label="Articles"><span className="money">{inv.nb_articles ?? lignes.length}</span></Head>
          <Head label="Écarts"><span className="money" style={{ color: nbEcarts ? 'var(--warning)' : undefined }}>{nbEcarts}</span></Head>
          <Head label="Valeur théorique"><span className="money">{fmtMoney(inv.valeur_theorique)}</span></Head>
          <Head label="Valeur comptée"><span className="money">{fmtMoney(inv.valeur_reale)}</span></Head>
          <div className="ml-auto text-right">
            <div className="text-[10px] font-bold uppercase text-ink-muted">Écart de valorisation</div>
            <div className="money text-[19px] font-extrabold"
                 style={{ color: Number(inv.ecart_valeur) < 0 ? 'var(--danger)' : Number(inv.ecart_valeur) > 0 ? 'var(--success)' : undefined }}>
              {fmtMoney(inv.ecart_valeur)} DA
            </div>
          </div>
          {closed ? <StatusPill tone="ok">Clôturé</StatusPill> : <StatusPill tone="warn">Brouillon</StatusPill>}
        </div>
      )}

      <div className="flex items-center gap-3">
        <input value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Filtrer par code ou désignation…"
               className="border border-line rounded-sm px-3 py-1.5 bg-surface text-ink text-[12px] min-w-[280px]" />
        <label className="text-[12px] font-semibold text-ink-label flex items-center gap-1.5">
          <input type="checkbox" checked={ecartsOnly} onChange={(e) => setEcartsOnly(e.target.checked)} />
          Écarts seulement
        </label>
        {!closed && <span className="text-[11px] text-ink-muted ml-auto">Saisissez la quantité comptée — enregistrée en quittant la case (ou Entrée).</span>}
      </div>

      <div className="bg-surface border border-line-soft rounded-md shadow-soft overflow-x-auto">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr>
              {['Code', 'Désignation', 'Dépôt', 'Théorique', 'Compté', 'Écart', 'PMP', 'Valeur comptée'].map((h, i) => (
                <th key={h} className={`text-[10px] font-bold uppercase tracking-wider text-ink-muted bg-bg border-b border-line-soft px-3 py-2 ${i >= 3 ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && lignes.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-ink-muted">Chargement…</td></tr>
            )}
            {!loading && lignes.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-ink-muted">Aucune ligne.</td></tr>
            )}
            {lignes.map((l) => {
              const draft = drafts[l.id];
              const shown = draft !== undefined ? draft : String(l.qte_reale);
              return (
                <tr key={l.id} className="border-b border-line-soft last:border-b-0">
                  <td className="px-3 py-1 money">{l.code_article}</td>
                  <td className="px-3 py-1"><b>{l.designation}</b>{l.unite ? <span className="text-ink-muted"> · {l.unite}</span> : null}</td>
                  <td className="px-3 py-1 text-ink-muted">{l.depot ?? '—'}</td>
                  <td className="px-3 py-1 text-right money">{fmtQte(l.qte_theorique)}</td>
                  <td className="w-[110px] px-2">
                    {closed ? (
                      <div className="text-right money font-semibold">{fmtQte(l.qte_reale)}</div>
                    ) : (
                      <input type="number" step="any" value={shown}
                             disabled={!!saving[l.id]}
                             onChange={(e) => setDrafts((d) => ({ ...d, [l.id]: e.target.value }))}
                             onBlur={(e) => void commit(l, e.target.value)}
                             onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                             className="w-full bg-transparent text-right money text-[12px] px-2 py-1.5 border border-transparent rounded-sm focus:border-brand-500 focus:bg-surface disabled:opacity-50" />
                    )}
                  </td>
                  <td className="px-3 py-1 text-right money font-semibold"
                      style={{ color: l.ecart < 0 ? 'var(--danger)' : l.ecart > 0 ? 'var(--success)' : undefined }}>
                    {l.ecart > 0 ? '+' : ''}{fmtQte(l.ecart)}
                  </td>
                  <td className="px-3 py-1 text-right money">{fmtMoney(l.prix_pmp)}</td>
                  <td className="px-3 py-1 text-right money">{fmtMoney(l.valeur_reale)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {confirmCloture && (
        <ConfirmDialog
          title="Clôturer l'inventaire ?"
          message={<>Les quantités comptées deviendront le <b>stock réel</b> des {inv?.nb_articles ?? lignes.length} article(s) ({nbEcarts} écart(s)). L'inventaire ne sera plus modifiable.</>}
          confirmLabel="Clôturer" loading={cloturing}
          onConfirm={doCloture} onCancel={() => setConfirmCloture(false)} />
      )}
    </div>
  );
}

function Head({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase text-ink-muted">{label}</div>
      <div className="text-[13px] font-semibold">{children}</div>
    </div>
  );
}
