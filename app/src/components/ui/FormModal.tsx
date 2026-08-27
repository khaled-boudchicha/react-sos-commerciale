import { useState } from 'react';

export type Field = {
  /** Clé envoyée au serveur (doit correspondre à l'input GraphQL). */
  name: string;
  label: string;
  type?: 'text' | 'number' | 'select' | 'checkbox' | 'textarea';
  /** Largeur dans la grille 12 colonnes (défaut 6 = demi-largeur). */
  span?: number;
  required?: boolean;
  /** Non modifiable en édition (ex. le code d'un tiers/article). */
  lockedOnEdit?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  step?: string;
};

export type Section = { title: string; fields: Field[] };

/**
 * Formulaire modal générique piloté par un schéma de sections/champs.
 * Sert les CRUD clients, fournisseurs et articles (mêmes conventions serveur :
 * create → input à plat ; update → { id, input }).
 */
export default function FormModal({
  title, sections, initial, submitLabel, loading, error, onSubmit, onCancel, width = 720,
}: {
  title: string;
  sections: Section[];
  initial?: Record<string, unknown>;
  submitLabel?: string;
  loading?: boolean;
  error?: string | null;
  onSubmit: (values: Record<string, unknown>) => void;
  onCancel: () => void;
  width?: number;
}) {
  const isEdit = !!initial;
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {};
    for (const s of sections) {
      for (const f of s.fields) {
        const raw = initial?.[f.name];
        v[f.name] = raw ?? (f.type === 'checkbox' ? false : '');
      }
    }
    return v;
  });
  const [touched, setTouched] = useState(false);

  const missing = sections
    .flatMap((s) => s.fields)
    .filter((f) => f.required && !String(values[f.name] ?? '').trim())
    .map((f) => f.label);

  function submit() {
    setTouched(true);
    if (missing.length > 0) return;
    // Nettoyage : chaînes vides → undefined, nombres castés
    const out: Record<string, unknown> = {};
    for (const s of sections) {
      for (const f of s.fields) {
        const raw = values[f.name];
        if (f.type === 'checkbox') { out[f.name] = !!raw; continue; }
        if (raw === '' || raw == null) continue;
        out[f.name] = f.type === 'number' ? Number(raw) : raw;
      }
    }
    onSubmit(out);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgb(15 26 46 / .45)' }}>
      <div className="bg-surface border border-line-soft rounded-lg shadow-lifted flex flex-col max-h-full"
           style={{ width }}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-soft flex-none">
          <div className="font-extrabold text-[15px]">{title}</div>
          <button onClick={onCancel} className="text-ink-muted text-[18px] px-2">✕</button>
        </div>

        <div className="px-5 py-4 overflow-auto flex flex-col gap-4">
          {error && (
            <div className="text-[12px] rounded-md px-3 py-2"
                 style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' }}>
              {error}
            </div>
          )}
          {touched && missing.length > 0 && (
            <div className="text-[12px] rounded-md px-3 py-2"
                 style={{ background: 'color-mix(in srgb, var(--warning) 12%, transparent)', color: 'var(--warning)' }}>
              Champs obligatoires : {missing.join(', ')}
            </div>
          )}

          {sections.map((s) => (
            <section key={s.title}>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-ink-muted mb-2">{s.title}</h3>
              <div className="grid grid-cols-12 gap-3">
                {s.fields.map((f) => {
                  const disabled = isEdit && f.lockedOnEdit;
                  const common = `w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink text-[12.5px] ${disabled ? 'opacity-60' : ''}`;
                  return (
                    <label key={f.name} className="text-[11px] font-bold text-ink-label"
                           style={{ gridColumn: `span ${f.span ?? 6} / span ${f.span ?? 6}` }}>
                      {f.label}{f.required ? ' *' : ''}
                      {f.type === 'select' ? (
                        <select disabled={disabled} value={String(values[f.name] ?? '')}
                                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                                className={`mt-1 font-normal ${common}`}>
                          <option value="">—</option>
                          {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : f.type === 'checkbox' ? (
                        <div className="mt-1.5">
                          <input type="checkbox" checked={!!values[f.name]} disabled={disabled}
                                 onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.checked }))} />
                        </div>
                      ) : f.type === 'textarea' ? (
                        <textarea rows={2} disabled={disabled} value={String(values[f.name] ?? '')}
                                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                                  className={`mt-1 font-normal ${common}`} />
                      ) : (
                        <input type={f.type === 'number' ? 'number' : 'text'} step={f.step}
                               disabled={disabled} placeholder={f.placeholder}
                               value={String(values[f.name] ?? '')}
                               onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                               className={`mt-1 font-normal ${common} ${f.type === 'number' ? 'money text-right' : ''}`} />
                      )}
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="flex gap-2 justify-end px-5 py-3.5 border-t border-line-soft flex-none">
          <button onClick={onCancel} disabled={loading}
                  className="px-4 py-2 rounded-md border border-line text-ink-label font-bold text-[12px] disabled:opacity-60">
            Annuler
          </button>
          <button onClick={submit} disabled={loading}
                  className="px-5 py-2 rounded-md bg-brand-700 text-white font-bold text-[12px] disabled:opacity-60">
            {loading ? 'Enregistrement…' : (submitLabel ?? 'Enregistrer')}
          </button>
        </div>
      </div>
    </div>
  );
}
