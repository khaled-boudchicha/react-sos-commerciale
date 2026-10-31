import { ReactNode, useState } from 'react';
import Dialog, { KeyHints } from './Dialog';
import { Button } from './Button';
import { Checkbox, Field as FieldBox, Select, TextInput, Textarea } from './Field';
import { SectionTitle } from './Card';
import { Alert } from './States';

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
 * Clavier : Entrée enregistre (hors zone de texte), Échap annule. Champs requis signalés un par un.
 */
export default function FormModal({
  title, sections, initial, submitLabel, loading, error, onSubmit, onCancel, width = 720, renderExtra,
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
  /** Contenu additionnel réactif aux valeurs (ex. aperçu calculé). Rendu sous les sections. */
  renderExtra?: (values: Record<string, unknown>) => ReactNode;
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

  const missingFields = sections
    .flatMap((s) => s.fields)
    .filter((f) => f.required && !String(values[f.name] ?? '').trim());
  const missing = missingFields.map((f) => f.label);
  const isMissing = (f: Field) => touched && missingFields.includes(f);

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

  const set = (name: string, v: unknown) => setValues((cur) => ({ ...cur, [name]: v }));

  return (
    <Dialog title={title} onClose={() => { if (!loading) onCancel(); }} width={width} closeOnOverlay={false}
            icon={isEdit ? 'edit' : 'plus'}
            footerStart={<KeyHints items={[['Entrée', 'enregistrer'], ['Échap', 'annuler']]} />}
            footer={(
              <>
                <Button onClick={onCancel} disabled={loading}>Annuler</Button>
                <Button variant="primary" icon="check" onClick={submit} loading={loading}>
                  {loading ? 'Enregistrement…' : (submitLabel ?? 'Enregistrer')}
                </Button>
              </>
            )}>
      <form className="flex flex-col gap-5" noValidate
            onSubmit={(e) => { e.preventDefault(); submit(); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLButtonElement)) {
                e.preventDefault(); submit();
              }
            }}>
        {error && <Alert tone="danger">{error}</Alert>}
        {touched && missing.length > 0 && (
          <Alert tone="warning" compact>Champs obligatoires à compléter : {missing.join(', ')}</Alert>
        )}

        {sections.map((s) => (
          <section key={s.title}>
            <SectionTitle>{s.title}</SectionTitle>
            <div className="grid grid-cols-12 gap-x-3 gap-y-3.5">
              {s.fields.map((f) => {
                const disabled = isEdit && f.lockedOnEdit;
                const span = f.span ?? 6;
                if (f.type === 'checkbox') {
                  return (
                    <div key={f.name} className="flex items-end pb-1.5" style={{ gridColumn: `span ${span} / span ${span}` }}>
                      <Checkbox label={f.label} checked={!!values[f.name]} disabled={disabled}
                                onChange={(e) => set(f.name, e.target.checked)} />
                    </div>
                  );
                }
                return (
                  <FieldBox key={f.name} label={f.label} required={f.required} span={span}
                         error={isMissing(f) ? 'Champ obligatoire' : undefined}
                         hint={disabled ? 'non modifiable' : undefined}>
                    {f.type === 'select' ? (
                      <Select disabled={disabled} value={String(values[f.name] ?? '')} placeholder="—"
                              onChange={(e) => set(f.name, e.target.value)}>
                        {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </Select>
                    ) : f.type === 'textarea' ? (
                      <Textarea rows={2} disabled={disabled} value={String(values[f.name] ?? '')} placeholder={f.placeholder}
                                onChange={(e) => set(f.name, e.target.value)} />
                    ) : (
                      <TextInput type={f.type === 'number' ? 'number' : 'text'} step={f.step}
                                 disabled={disabled} placeholder={f.placeholder}
                                 value={String(values[f.name] ?? '')}
                                 onChange={(e) => set(f.name, e.target.value)}
                                 mono={f.type === 'number'} align={f.type === 'number' ? 'right' : undefined} />
                    )}
                  </FieldBox>
                );
              })}
            </div>
          </section>
        ))}
        {renderExtra?.(values)}
      </form>
    </Dialog>
  );
}
