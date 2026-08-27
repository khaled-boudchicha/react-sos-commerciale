import { useEffect, useState } from 'react';
import { useLazyQuery } from '@apollo/client';
import { FOURNISSEURS } from '../api/queries';
import { Fournisseur } from '../api/types';
import { fmtMoney } from '../lib/format';

/** Recherche de fournisseur (pendant de ClientSearch pour les achats). */
export default function FournisseurSearch({ value, onSelect }: {
  value: Fournisseur | null;
  onSelect: (f: Fournisseur | null) => void;
}) {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [search, { data, loading }] = useLazyQuery(FOURNISSEURS, { fetchPolicy: 'network-only' });
  const results: Fournisseur[] = data?.fournisseurs?.data ?? [];

  useEffect(() => {
    if (term.trim().length < 2) { setOpen(false); return; }
    const t = setTimeout(() => { void search({ variables: { search: term.trim(), limit: 8, offset: 0 } }); setOpen(true); }, 250);
    return () => clearTimeout(t);
  }, [term, search]);

  if (value) {
    return (
      <div className="flex items-center justify-between border border-line rounded-sm px-3 py-2 bg-surface text-[12.5px]">
        <span><b>{value.nom}</b> <span className="money text-[10.5px] text-ink-muted">{value.code}</span></span>
        <span className="flex items-center gap-3">
          <span className="text-[11px] text-ink-muted">Solde : <span className="money">{fmtMoney(value.ancien_credit)}</span></span>
          <button onClick={() => onSelect(null)} className="text-ink-muted font-bold">✕</button>
        </span>
      </div>
    );
  }

  return (
    <div className="relative">
      <input value={term} onChange={(e) => setTerm(e.target.value)}
             placeholder="Fournisseur : nom ou code…"
             className="w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink text-[12.5px]" />
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-surface border border-line rounded-md shadow-lifted max-h-[260px] overflow-auto">
          {loading && <div className="px-3 py-2.5 text-[12px] text-ink-muted">Recherche…</div>}
          {!loading && results.length === 0 && <div className="px-3 py-2.5 text-[12px] text-ink-muted">Aucun fournisseur.</div>}
          {results.map((f) => (
            <button key={f.id} onClick={() => { onSelect(f); setTerm(''); setOpen(false); }}
                    className="w-full text-left px-3 py-2 flex justify-between items-center border-b border-line-soft last:border-b-0 hover:bg-brand-50">
              <span><b className="text-[12.5px]">{f.nom}</b> <span className="money text-[10.5px] text-ink-muted">{f.code}</span></span>
              <span className="money text-[11px] text-ink-muted">{fmtMoney(f.ancien_credit)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
