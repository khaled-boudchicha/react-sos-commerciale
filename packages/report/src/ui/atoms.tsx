import type { ReactNode } from 'react';

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <h1 className="text-[18px] font-extrabold tracking-tight mr-auto">{title}</h1>
      {children}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void;
  options: readonly { code: T; label: string; count?: number }[];
}) {
  return (
    <div className="flex gap-0.5 bg-surface border border-line-soft rounded-md p-0.5 w-max max-w-full flex-wrap" role="tablist">
      {options.map((o) => (
        <button key={o.code} onClick={() => onChange(o.code)} role="tab" aria-selected={value === o.code}
                className={`px-3 py-1.5 rounded-sm text-[11.5px] font-bold ${value === o.code ? 'text-white bg-brand-700' : 'text-ink-muted hover:text-ink-label'}`}>
          {o.label}
          {o.count != null && <span className="font-mono text-[10px] opacity-75 ml-1.5">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
