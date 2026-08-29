import { useEffect, useMemo, useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Article, Fournisseur, TYPES_ACHAT } from '../api/types';
import { fmtMoney, fmtQte, isoToday } from '../lib/format';
import { DocBadge, PageHeader, Tabs } from '../components/ui/atoms';
import ArticleSearch from '../components/ArticleSearch';
import FournisseurSearch from '../components/FournisseurSearch';
import LignesTable from '../components/document/LignesTable';
import { LigneDoc, ligneDepuisArticle, totauxDocument } from '../components/document/lignesDocument';
import { useToast } from '../components/ui/Toast';

const CREATE_ACHAT = gql`
  mutation CreateAchat($input: JSON!) { createAchat(input: $input) }
`;
const MODES = gql`
  query ModesPayementAchat { modesPayement }
`;

export default function AchatEditor() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const initialType = (params.get('type') as (typeof TYPES_ACHAT)[number]['code']) || 'BR';

  const [type, setType] = useState<(typeof TYPES_ACHAT)[number]['code']>(initialType);
  const [fournisseur, setFournisseur] = useState<Fournisseur | null>(null);
  const [date, setDate] = useState(isoToday());
  const [mode, setMode] = useState('Espece');
  const [remiseGlobale, setRemiseGlobale] = useState(0);
  const [observation, setObservation] = useState('');
  const [lignes, setLignes] = useState<LigneDoc[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: refs } = useQuery(MODES);
  const modes: any[] = Array.isArray(refs?.modesPayement) ? refs.modesPayement : [];
  const [create, { loading: saving }] = useMutation(CREATE_ACHAT);

  const affecteStock = type === 'FA' || type === 'BR';

  function addArticle(a: Article) {
    setLignes((ls) => {
      const idx = ls.findIndex((l) => l.code_article === a.code);
      if (idx >= 0) {
        const next = [...ls];
        next[idx] = { ...next[idx], qte: next[idx].qte + 1 };
        return next;
      }
      return [...ls, ligneDepuisArticle(a, 'achat')];
    });
  }

  function patchLigne(key: number, patch: Partial<LigneDoc>) {
    setLignes((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function removeLigne(key: number) {
    setLignes((ls) => ls.filter((l) => l.key !== key));
  }

  const totaux = useMemo(() => totauxDocument(lignes, remiseGlobale), [lignes, remiseGlobale]);

  // Raccourcis : F2 = recherche article, F3 = recherche fournisseur
  useEffect(() => {
    function focusPlaceholder(prefixe: string) {
      const el = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').startsWith(prefixe));
      if (el) { el.focus(); (el as HTMLInputElement).select?.(); }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'F2') { e.preventDefault(); focusPlaceholder('Article'); }
      if (e.key === 'F3') { e.preventDefault(); focusPlaceholder('Fournisseur'); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function save() {
    setError(null);
    if (lignes.length === 0) { setError('Ajoutez au moins une ligne.'); return; }
    try {
      const { data } = await create({
        variables: {
          input: {
            type_doc: type,
            code_four: fournisseur?.code ?? undefined,
            date,
            mode_payement: mode || undefined,
            remise: remiseGlobale || 0,
            observation: observation || undefined,
            lignes: lignes.map((l) => ({
              id_article: l.id_article,
              code_article: l.code_article,
              designation: l.designation,
              qte: l.qte,
              prix_ht: l.prix_ht,
              tva: l.tva,
              remise: l.remise || 0,
              n_lot: l.n_lot || undefined,
              date_peremption: l.date_peremption || undefined,
              colis: l.colis || undefined,
            })),
          },
        },
      });
      const created = data?.createAchat;
      toast.success(`Pièce ${created?.numero ?? ''} enregistrée${affecteStock ? ' · stock mis à jour' : ''}.`.replace('  ', ' '));
      if (created?.id) navigate(`/achats/${created.id}`);
      else navigate('/achats');
    } catch (e: any) {
      setError(e.message ?? 'Erreur à l’enregistrement.');
      toast.error(`Enregistrement échoué : ${e.message ?? 'erreur'}`);
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title="Nouvelle pièce d'achat">
        <Link to="/achats" className="text-[12px] font-bold text-brand-700">← Annuler</Link>
      </PageHeader>

      <Tabs value={type} onChange={setType} options={TYPES_ACHAT} />
      {!affecteStock && (
        <div className="text-[11px] text-ink-muted">Ce type de document n'affecte pas le stock (seuls Facture d'achat et Bon de réception le font).</div>
      )}

      {error && (
        <div className="text-[12px] rounded-md px-3 py-2"
             style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' }}>{error}</div>
      )}

      <div className="bg-surface border border-line-soft rounded-md shadow-soft p-4 grid grid-cols-[2fr_1fr_1fr_1fr] gap-3">
        <label className="text-[11px] font-bold text-ink-label">Fournisseur
          <div className="mt-1 font-normal"><FournisseurSearch value={fournisseur} onSelect={setFournisseur} /></div>
        </label>
        <label className="text-[11px] font-bold text-ink-label">Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                 className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal" />
        </label>
        <label className="text-[11px] font-bold text-ink-label">Mode de paiement
          <select value={mode} onChange={(e) => setMode(e.target.value)}
                  className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal">
            <option value="Espece">Espèces</option>
            {modes.map((m: any, i) => {
              const v = String(m.nom ?? m.name ?? m.mode ?? m);
              return v.toLowerCase() === 'espece' ? null : <option key={i} value={v}>{v}</option>;
            })}
          </select>
        </label>
        <label className="text-[11px] font-bold text-ink-label">Remise globale %
          <input type="number" min="0" max="100" step="0.5" value={remiseGlobale}
                 onChange={(e) => setRemiseGlobale(parseFloat(e.target.value) || 0)}
                 className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink money text-right font-normal" />
        </label>
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-3.5 items-start">
        <div className="flex flex-col gap-2.5">
          <ArticleSearch onSelect={addArticle} autoFocus />
          <LignesTable sens="achat" lignes={lignes} patch={patchLigne} remove={removeLigne} />
          <label className="text-[11px] font-bold text-ink-label">Note
            <input value={observation} onChange={(e) => setObservation(e.target.value)}
                   className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal" />
          </label>
        </div>

        <div className="bg-surface border border-line-soft rounded-md shadow-soft overflow-hidden sticky top-4">
          <TotRow label="Total HT" value={totaux.ht} />
          <TotRow label="Remises lignes" value={-totaux.remLignes} />
          <TotRow label="TVA" value={totaux.tva} />
          <TotRow label={`Remise globale (${fmtQte(remiseGlobale)} %)`} value={-totaux.remGlob} />
          <div className="px-4 py-3.5 flex justify-between items-center text-white font-extrabold" style={{ background: 'var(--gradient-hero)' }}>
            <span>Net à payer</span>
            <span className="money text-[16px]">{fmtMoney(totaux.net)} DA</span>
          </div>
          <div className="p-3 flex flex-col gap-2">
            <button onClick={save} disabled={saving || lignes.length === 0}
                    className="rounded-md py-2.5 font-bold text-white bg-brand-700 disabled:opacity-50">
              {saving ? 'Enregistrement…' : 'Enregistrer la pièce'}
            </button>
            <div className="text-[10.5px] text-ink-muted text-center flex items-center justify-center gap-1.5">
              <DocBadge code={type === 'FA' ? 'BR' : type} /> {affecteStock ? 'entre en stock' : 'sans impact stock'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TotRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between px-4 py-2 text-[12px] text-ink-label border-b border-dashed border-line-soft">
      <span>{label}</span>
      <span className="money" style={{ color: value < 0 ? 'var(--danger)' : undefined }}>{fmtMoney(value)}</span>
    </div>
  );
}
