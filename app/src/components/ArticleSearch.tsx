import { useEffect, useRef, useState } from 'react';
import { useLazyQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { ARTICLES } from '../api/queries';
import { Article } from '../api/types';
import { fmtMoney, fmtQte } from '../lib/format';
import { useDebouncedValue } from '../lib/useDebounce';

const ARTICLE_PAR_CODE_BARRE = gql`
  query ArticleParCodeBarre($code: String!) { articleParCodeBarre(code: $code) }
`;

/** Recherche d'article clavier-first (équivalent F2 / ArticleSelects du Delphi).
 *  ↑/↓ pour naviguer, Entrée pour choisir, Échap pour fermer.
 *
 *  **Scan de code-barres** : une douchette tape très vite puis envoie Entrée.
 *  À la validation, si aucun résultat n'est surligné (ou si la saisie est un
 *  code numérique), on tente d'abord une correspondance EXACTE par code-barres
 *  — l'article est alors ajouté directement, sans passer par la liste. */
export default function ArticleSearch({ onSelect, autoFocus }: {
  onSelect: (a: Article) => void;
  autoFocus?: boolean;
}) {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [scanErreur, setScanErreur] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, { data, loading }] = useLazyQuery(ARTICLES, { fetchPolicy: 'network-only' });
  const [chercherCodeBarre, { loading: scanning }] = useLazyQuery(ARTICLE_PAR_CODE_BARRE, { fetchPolicy: 'network-only' });

  const results: Article[] = data?.articles?.data ?? [];
  const termDiffere = useDebouncedValue(term, 250);

  useEffect(() => {
    const t = termDiffere.trim();
    if (t.length < 2) { setOpen(false); return; }
    void search({ variables: { search: t, limit: 10, offset: 0 } });
    setOpen(true);
    setHi(0);
  }, [termDiffere, search]);

  function choose(a: Article) {
    onSelect(a);
    setTerm('');
    setOpen(false);
    setScanErreur(null);
    inputRef.current?.focus();
  }

  /** Validation : code-barres exact d'abord, sinon l'élément surligné de la liste. */
  async function valider() {
    const code = term.trim();
    if (!code) return;
    const surligne = results[hi];
    // Une saisie purement numérique d'au moins 6 caractères = code-barres scanné
    const ressembleCodeBarre = /^[0-9]{6,}$/.test(code);
    if (ressembleCodeBarre || !surligne) {
      setScanErreur(null);
      try {
        const { data: d } = await chercherCodeBarre({ variables: { code } });
        const trouve = d?.articleParCodeBarre as Article | null;
        if (trouve) { choose(trouve); return; }
        if (ressembleCodeBarre) {
          setScanErreur(`Code-barres « ${code} » inconnu`);
          return;
        }
      } catch {
        /* pas de correspondance → on retombe sur la liste */
      }
    }
    if (surligne) choose(surligne);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); void valider(); return; }
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Escape') { setOpen(false); }
  }

  return (
    <div className="relative">
      <input ref={inputRef} value={term} autoFocus={autoFocus}
             onChange={(e) => setTerm(e.target.value)} onKeyDown={onKey}
             placeholder="Article : code, désignation ou code-barres… (F2)"
             className="w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink text-[12.5px]" />
      {scanning && <div className="absolute right-3 top-2.5 text-[11px] text-ink-muted">…</div>}
      {scanErreur && (
        <div className="mt-1 text-[11.5px]" style={{ color: 'var(--danger)' }}>{scanErreur}</div>
      )}
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-surface border border-line rounded-md shadow-lifted max-h-[300px] overflow-auto">
          {loading && <div className="px-3 py-2.5 text-[12px] text-ink-muted">Recherche…</div>}
          {!loading && results.length === 0 && <div className="px-3 py-2.5 text-[12px] text-ink-muted">Aucun article.</div>}
          {results.map((a, i) => (
            <button key={a.id} onMouseEnter={() => setHi(i)} onClick={() => choose(a)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-3 border-b border-line-soft last:border-b-0 ${i === hi ? 'bg-brand-50' : ''}`}>
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-[12.5px] truncate">{a.designation}</span>
                <span className="block money text-[10.5px] text-ink-muted">{a.code}{a.famille ? ` · ${a.famille}` : ''}</span>
              </span>
              <span className="money text-[11px]" style={{ color: Number(a.qte_reale) <= 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                stock {fmtQte(a.qte_reale)}
              </span>
              <span className="money text-[12px] font-bold">{fmtMoney(a.prix_vente_ttc)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
