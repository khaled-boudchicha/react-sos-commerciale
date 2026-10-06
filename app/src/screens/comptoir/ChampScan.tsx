import { useEffect, useRef, useState } from 'react';
import { gql, useLazyQuery } from '@apollo/client';
import { ARTICLES } from '../../api/queries';
import { Article } from '../../api/types';
import Icon, { Kbd } from '../../components/ui/Icon';
import { fmtMoney, fmtQte } from '../../lib/format';
import { useDebouncedValue } from '../../lib/useDebounce';

const PAR_CODE_BARRE = gql`query ArticleParCodeBarreComptoir($code: String!) { articleParCodeBarre(code: $code) }`;
const PAR_CODE = gql`query ArticleParCodeComptoir($code: String!) { articleParCode(code: $code) }`;

export type ModeRecherche = 'designation' | 'code';

/**
 * Champ de scan / recherche du comptoir (PanelCodeBarre de ComptoirMixts) — gabarit maquette :
 * 62 px, bordure 2 px + halo, icône de scan, bascule Désignation / Code (RechercheType), touche F6.
 *
 * Entrée : code-barres exact d'abord (douchette), puis code article exact en mode « Code »,
 * sinon l'article surligné dans la liste. ↑/↓ naviguent dans la liste, Échap la ferme.
 */
export default function ChampScan({ id, retour, onArticle }: {
  id: string;
  retour: boolean;
  onArticle: (a: Article) => void;
}) {
  const [term, setTerm] = useState('');
  const [mode, setMode] = useState<ModeRecherche>('designation');
  const [ouvert, setOuvert] = useState(false);
  const [hi, setHi] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [chercher, { data, loading }] = useLazyQuery(ARTICLES, { fetchPolicy: 'network-only' });
  const [parCodeBarre] = useLazyQuery(PAR_CODE_BARRE, { fetchPolicy: 'network-only' });
  const [parCode] = useLazyQuery(PAR_CODE, { fetchPolicy: 'network-only' });

  const resultats: Article[] = data?.articles?.data ?? [];
  const differe = useDebouncedValue(term, 250);

  useEffect(() => {
    const t = differe.trim();
    // Saisie numérique longue = scan en cours : pas de liste
    if (t.length < 2 || /^[0-9]{8,}$/.test(t)) { setOuvert(false); return; }
    void chercher({ variables: { search: t, limit: 12, offset: 0 } });
    setOuvert(true);
    setHi(0);
  }, [differe, chercher]);

  function choisir(a: Article) {
    onArticle(a);
    setTerm('');
    setOuvert(false);
    setErreur(null);
    inputRef.current?.focus();
  }

  async function valider() {
    const code = term.trim();
    if (!code) return;
    const surligne = ouvert ? resultats[hi] : undefined;
    const numerique = /^[0-9]{6,}$/.test(code);
    if (numerique || !surligne || mode === 'code') {
      try {
        const { data: d } = await parCodeBarre({ variables: { code } });
        if (d?.articleParCodeBarre) { choisir(d.articleParCodeBarre as Article); return; }
        if (mode === 'code') {
          const { data: c } = await parCode({ variables: { code } });
          if (c?.articleParCode) { choisir(c.articleParCode as Article); return; }
        }
      } catch { /* pas de correspondance exacte → liste */ }
      if (numerique || (mode === 'code' && !surligne)) {
        setErreur(`${numerique ? 'Code-barres' : 'Code'} « ${code} » inconnu`);
        inputRef.current?.select();
        return;
      }
    }
    if (surligne) choisir(surligne);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); void valider(); return; }
    // « + » / « − » tapés dans le champ pilotent la quantité (gérés par l'écran), jamais du texte
    if (e.key === '+' || e.key === '-') { if (!/[a-z]/i.test(term)) e.preventDefault(); }
    if (!ouvert) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); setHi((h) => Math.min(h + 1, resultats.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Escape') { e.stopPropagation(); setOuvert(false); }
  }

  const accent = retour ? 'var(--pos-return)' : 'var(--brand-500)';
  const halo = retour ? 'rgb(194 65 12 / .12)' : 'rgb(59 102 245 / .12)';

  return (
    <div className="relative flex-none">
      <label className="flex items-center gap-3 h-[62px] pl-[18px] pr-2.5 rounded-xl bg-surface"
             style={{ border: `2px solid ${accent}`, boxShadow: `0 0 0 4px ${halo}` }}>
        <span style={{ color: accent }}><Icon name="scan" size={24} /></span>
        <input ref={inputRef} id={id} value={term} autoFocus autoComplete="off" spellCheck={false}
               aria-label="Scanner ou rechercher un article"
               onChange={(e) => { setTerm(e.target.value); setErreur(null); }} onKeyDown={onKey}
               onBlur={() => setOuvert(false)}
               placeholder={retour ? 'RETOUR — scanner l’article rendu par le client' : 'Scanner un code-barres ou rechercher un article…'}
               className="flex-1 min-w-0 border-0 outline-none bg-transparent text-[17px] font-semibold text-ink placeholder:font-semibold"
               style={{ boxShadow: 'none' }} />
        <div role="group" aria-label="Recherche par" className="flex p-[3px] rounded-[9px] bg-bg border border-line-soft">
          {(['designation', 'code'] as const).map((m) => (
            <button key={m} type="button" onClick={() => { setMode(m); inputRef.current?.focus(); }} aria-pressed={mode === m}
                    className={`h-[30px] px-3 rounded-[7px] text-[12px] ${mode === m ? 'bg-surface font-bold text-ink shadow-[0_1px_3px_rgb(15_26_46/.1)]' : 'font-semibold'}`}
                    style={mode === m ? undefined : { color: 'var(--text-secondary)' }}>
              {m === 'designation' ? 'Désignation' : 'Code'}
            </button>
          ))}
        </div>
        <span className="[&>kbd]:border-b-2 [&>kbd]:bg-surface"><Kbd size="md">F6</Kbd></span>
      </label>

      {erreur && (
        <div role="alert" className="mt-2 px-3 py-[7px] rounded-lg text-[12px] font-bold"
             style={{ background: 'var(--pos-alert-soft)', color: 'var(--pos-alert)' }}>
          {erreur}
        </div>
      )}

      {ouvert && (
        <div className="absolute z-30 left-0 right-0 mt-2 bg-surface border border-line rounded-xl shadow-lifted max-h-[360px] overflow-auto">
          {loading && <div className="px-4 py-3 text-[13px]" style={{ color: 'var(--text-secondary)' }}>Recherche…</div>}
          {!loading && resultats.length === 0 && <div className="px-4 py-3 text-[13px]" style={{ color: 'var(--text-secondary)' }}>Aucun article.</div>}
          {resultats.map((a, i) => {
            const epuise = Number(a.qte_reale) <= 0;
            return (
              <button key={a.id} type="button" onMouseEnter={() => setHi(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => choisir(a)}
                      className={`w-full text-left px-4 min-h-[52px] flex items-center gap-4 border-b border-line-soft last:border-b-0 ${i === hi ? 'bg-brand-50' : ''}`}>
                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-[14px] font-bold truncate">{a.designation}</span>
                  <span className="money text-[11px]" style={{ color: 'var(--text-secondary)' }}>{a.code}{a.famille ? ` · ${a.famille}` : ''}</span>
                </span>
                <span className="money text-[12px] font-semibold" style={{ color: epuise ? 'var(--pos-alert)' : 'var(--text-secondary)' }}>
                  stock {fmtQte(a.qte_reale)}
                </span>
                <span className="money text-[14px] font-extrabold w-[100px] text-right">{fmtMoney(a.prix_vente_ttc)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
