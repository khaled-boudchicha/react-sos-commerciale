import { useEffect, useState } from 'react';
import { useLazyQuery } from '@apollo/client';
import { CLIENTS } from '../api/queries';
import { Client } from '../api/types';
import { fmtMoney } from '../lib/format';
import { IconButton, Spinner } from './ui/Button';
import { TextInput } from './ui/Field';
import { Icon } from './ui/Icon';
import { cn } from './ui/cn';

/** Recherche de client (équivalent F3). */
export default function ClientSearch({ value, onSelect }: {
  value: Client | null;
  onSelect: (c: Client | null) => void;
}) {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [search, { data, loading }] = useLazyQuery(CLIENTS, { fetchPolicy: 'network-only' });
  const results: Client[] = data?.clients?.data ?? [];

  useEffect(() => {
    if (term.trim().length < 2) { setOpen(false); return; }
    const t = setTimeout(() => { void search({ variables: { search: term.trim(), limit: 8, offset: 0 } }); setOpen(true); }, 250);
    return () => clearTimeout(t);
  }, [term, search]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 h-control-md border border-line rounded-sm pl-3 pr-1 bg-surface text-base min-w-0">
        <span className="flex items-center gap-2 min-w-0">
          <Icon name="user" size={16} className="text-ink-muted flex-none" />
          <b className="truncate">{value.nom}</b> <span className="money text-xs text-ink-muted">{value.code}</span>
        </span>
        <span className="flex items-center gap-2 flex-none">
          <span className="text-xs text-ink-muted">Solde : <span className="money" style={{ color: Number(value.credit) > 0 ? 'var(--warning-text)' : undefined }}>{fmtMoney(value.credit)}</span></span>
          <IconButton icon="close" label="Retirer le client" size="sm" onClick={() => onSelect(null)} />
        </span>
      </div>
    );
  }

  return (
    <div className="relative">
      <TextInput value={term} onChange={(e) => setTerm(e.target.value)} leading="search" autoComplete="off"
                 placeholder="Client : nom ou code… (F3) — vide = comptoir"
                 aria-expanded={open} aria-autocomplete="list" />
      {open && (
        <div className="absolute z-dropdown left-0 right-0 mt-1 bg-raised border border-line-soft rounded-md shadow-lifted max-h-[260px] overflow-auto py-1 animate-pop-in">
          {loading && <div className="px-3 py-2.5 flex items-center gap-2 text-sm text-ink-muted" role="status"><Spinner size={14} className="text-brand-text" />Recherche…</div>}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2.5 flex items-center gap-2 text-sm text-ink-muted"><Icon name="search" size={14} />Aucun client.</div>
          )}
          {results.map((c) => (
            <button key={c.id} onClick={() => { onSelect(c); setTerm(''); setOpen(false); }}
                    className={cn('w-full text-left px-3 py-2 flex justify-between items-center gap-3 border-b border-line-soft last:border-b-0',
                      'hover:bg-hover focus:bg-brand-soft')}>
              <span><b className="text-base text-ink">{c.nom}</b> <span className="money text-xs text-ink-muted">{c.code}</span></span>
              <span className="money text-xs" style={{ color: Number(c.credit) > 0 ? 'var(--warning-text)' : 'var(--text-muted)' }}>
                {fmtMoney(c.credit)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
