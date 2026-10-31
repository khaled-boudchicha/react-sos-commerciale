import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { INVENTAIRE, UPDATE_LIGNE_INVENTAIRE, CLOTURER_INVENTAIRE, COORDONNEES_SOCIETE } from '../api/queries';
import { fmtDate, fmtQte } from '../lib/format';
import { Badge, Money, PageHeader, StatusPill, Toolbar } from '../components/ui/atoms';
import { Button } from '../components/ui/Button';
import { Card, DescriptionList, TotalsPanel } from '../components/ui/Card';
import { Checkbox, SearchField } from '../components/ui/Field';
import { Alert, EmptyState, Loading, Skeleton } from '../components/ui/States';
import { Menu } from '../components/ui/Menu';
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

  const titre = inv?.designation || `Inventaire #${id}`;
  const ecartTone = (v: number) => (v < 0 ? 'var(--danger-text)' : v > 0 ? 'var(--success-text)' : undefined);

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title={titre} backTo="/stock/inventaires" backLabel="Retour aux inventaires"
                  breadcrumb={[{ label: 'Stock', to: '/stock' }, { label: 'Inventaires', to: '/stock/inventaires' }, { label: titre }]}
                  meta={inv && (closed ? <StatusPill tone="ok">Clôturé</StatusPill> : <StatusPill tone="warn">Brouillon</StatusPill>)}>
        {inv && (
          <Menu label="Imprimer" width={220} items={[
            { label: 'Feuille de comptage', icon: 'printer', hint: 'vierge', onSelect: () => imprimer(true) },
            { label: "Imprimer l'état", icon: 'printer', onSelect: () => imprimer(false) },
          ]} />
        )}
        {inv && !closed && (
          <Button variant="primary" icon="lock" onClick={() => setConfirmCloture(true)}>Clôturer l'inventaire</Button>
        )}
      </PageHeader>
      {printDoc && <ImprimerDocument demande={printDoc} onClose={() => setPrintDoc(null)} />}

      {error && <Alert tone="danger">{error}</Alert>}
      {qError && (
        <Alert tone="danger" action={<Button size="sm" icon="refresh" onClick={() => refetch()}>Réessayer</Button>}>
          {qError.message}
        </Alert>
      )}
      {loading && !inv && <Card><Skeleton lines={2} /></Card>}

      {inv && (
        <div className="grid grid-cols-[1fr_300px] gap-3.5 items-stretch">
          <Card className="flex items-center">
            <DescriptionList columns={3} className="w-full" items={[
              { label: 'Date', value: fmtDate(inv.date) },
              { label: 'Articles', value: inv.nb_articles ?? lignes.length, mono: true },
              { label: 'Écarts', value: nbEcarts
                ? <Badge tone="warning" size="md" className="money">{nbEcarts}</Badge>
                : <span className="money">{nbEcarts}</span> },
            ]} />
          </Card>
          <TotalsPanel
            rows={[
              { label: 'Valeur théorique', value: Number(inv.valeur_theorique ?? 0) },
              { label: 'Valeur comptée', value: Number(inv.valeur_reale ?? 0) },
              { label: <b className="text-ink">Écart de valorisation (DA)</b>, value: Number(inv.ecart_valeur ?? 0),
                tone: Number(inv.ecart_valeur) > 0 ? 'success' : undefined },
            ]}
          />
        </div>
      )}

      <Toolbar>
        <SearchField value={filtre} onChange={setFiltre} placeholder="Filtrer par code ou désignation…" width={300} />
        <Checkbox checked={ecartsOnly} onChange={(e) => setEcartsOnly(e.target.checked)} label="Écarts seulement" />
        {!closed && <span className="text-xs text-ink-muted ml-auto">Saisissez la quantité comptée — enregistrée en quittant la case (ou Entrée).</span>}
      </Toolbar>

      <Card padding="none" className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              {['Code', 'Désignation', 'Dépôt', 'Théorique', 'Compté', 'Écart', 'PMP', 'Valeur comptée'].map((h, i) => (
                <th key={h} className={`text-2xs font-bold uppercase tracking-wider text-ink-muted bg-sunken border-b border-line-soft px-3 py-2 ${i >= 3 ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && lignes.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center"><Loading /></td></tr>
            )}
            {!loading && lignes.length === 0 && (
              <tr><td colSpan={8}><EmptyState size="sm" icon="inventory" title="Aucune ligne." /></td></tr>
            )}
            {lignes.map((l) => {
              const draft = drafts[l.id];
              const shown = draft !== undefined ? draft : String(l.qte_reale);
              return (
                <tr key={l.id} className="border-b border-line-soft last:border-b-0 hover:bg-hover">
                  <td className="px-3 py-1 money">{l.code_article}</td>
                  <td className="px-3 py-1"><b>{l.designation}</b>{l.unite ? <span className="text-ink-muted"> · {l.unite}</span> : null}</td>
                  <td className="px-3 py-1 text-ink-muted">{l.depot ?? '—'}</td>
                  <td className="px-3 py-1 text-right money">{fmtQte(l.qte_theorique)}</td>
                  <td className="w-[110px] px-2">
                    {closed ? (
                      <div className="text-right money font-semibold">{fmtQte(l.qte_reale)}</div>
                    ) : (
                      <input type="number" step="any" value={shown}
                             aria-label={`Quantité comptée ${l.code_article}`}
                             disabled={!!saving[l.id]}
                             onChange={(e) => setDrafts((d) => ({ ...d, [l.id]: e.target.value }))}
                             onBlur={(e) => void commit(l, e.target.value)}
                             onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                             className="w-full bg-transparent text-right money text-sm px-2 py-1.5 border border-line-soft rounded-sm hover:border-line focus:border-brand-500 focus:bg-surface disabled:opacity-50" />
                    )}
                  </td>
                  <td className="px-3 py-1 text-right money font-semibold" style={{ color: ecartTone(l.ecart) }}>
                    {l.ecart > 0 ? '+' : ''}{fmtQte(l.ecart)}
                  </td>
                  <td className="px-3 py-1 text-right"><Money value={l.prix_pmp} /></td>
                  <td className="px-3 py-1 text-right"><Money value={l.valeur_reale} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

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
