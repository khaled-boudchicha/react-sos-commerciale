import { useState } from 'react';
import { DocumentNode, useMutation } from '@apollo/client';
import FormModal, { Section } from '../components/ui/FormModal';
import ConfirmDialog from '../components/ui/ConfirmDialog';

type Entity = { id: number } & Record<string, unknown>;

/**
 * CRUD générique pour une entité (client / fournisseur / article).
 * Conventions serveur : create → input à plat ; update → { id, input } ; delete → { id }.
 *
 * Usage :
 *   const crud = useCrud({ label:'client', sections: CLIENT_SECTIONS, createDoc, updateDoc, deleteDoc, onDone: refetch });
 *   <button onClick={crud.openCreate}>Nouveau</button>
 *   … colonne actions : crud.rowActions(row) …
 *   {crud.modals}
 */
export function useCrud<T extends Entity>({
  label, createTitle, editTitle, deleteTitle, sections, createDoc, updateDoc, deleteDoc, onDone, labelOf, width,
}: {
  label: string;
  /** Titres si l'élision française diffère (ex. « Nouvel article », « Modifier l'article »). */
  createTitle?: string;
  editTitle?: string;
  deleteTitle?: string;
  sections: Section[];
  createDoc: DocumentNode;
  /** Absent = entité non modifiable (certains référentiels n'ont que create/delete). */
  updateDoc?: DocumentNode;
  deleteDoc: DocumentNode;
  onDone: () => void;
  /** Texte identifiant la ligne dans la confirmation de suppression. */
  labelOf: (row: T) => string;
  width?: number;
}) {
  const [editing, setEditing] = useState<T | null | 'new'>(null);
  const [deleting, setDeleting] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [create, { loading: creating }] = useMutation(createDoc);
  const [update, { loading: updating }] = useMutation(updateDoc ?? createDoc);
  const [remove, { loading: removing }] = useMutation(deleteDoc);

  async function submit(values: Record<string, unknown>) {
    setError(null);
    try {
      if (editing === 'new') {
        await create({ variables: { input: values } });
      } else if (editing && updateDoc) {
        // Le code n'est pas modifiable : on ne l'envoie pas en update
        const { code, ...rest } = values as Record<string, unknown> & { code?: unknown };
        await update({ variables: { id: editing.id, input: rest } });
      }
      setEditing(null);
      onDone();
    } catch (e: any) {
      setError(e.message ?? 'Erreur.');
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setError(null);
    try {
      await remove({ variables: { id: deleting.id } });
      setDeleting(null);
      onDone();
    } catch (e: any) {
      setDeleting(null);
      setError(e.message ?? 'Suppression impossible.');
    }
  }

  const modals = (
    <>
      {error && !editing && (
        <div className="text-[12px] rounded-md px-3 py-2"
             style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}
      {editing && (
        <FormModal
          title={editing === 'new' ? (createTitle ?? `Nouveau ${label}`) : (editTitle ?? `Modifier le ${label}`)}
          sections={sections}
          initial={editing === 'new' ? undefined : editing}
          loading={creating || updating}
          error={error}
          width={width}
          onSubmit={submit}
          onCancel={() => { setEditing(null); setError(null); }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={deleteTitle ?? `Supprimer ce ${label} ?`}
          message={<><b>{labelOf(deleting)}</b> sera définitivement supprimé. Action irréversible.</>}
          confirmLabel="Supprimer" danger loading={removing}
          onConfirm={confirmDelete} onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );

  /** Boutons d'action pour une ligne de grille (stoppent la propagation du clic). */
  function rowActions(row: T) {
    return (
      <span className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
        {updateDoc && (
          <button onClick={() => setEditing(row)} title="Modifier"
                  className="px-1.5 py-0.5 rounded-sm border border-line text-ink-muted hover:text-brand-700 text-[11px]">✎</button>
        )}
        <button onClick={() => setDeleting(row)} title="Supprimer"
                className="px-1.5 py-0.5 rounded-sm border border-line text-ink-muted text-[11px]"
                style={{ color: 'var(--danger)' }}>✕</button>
      </span>
    );
  }

  return { openCreate: () => { setError(null); setEditing('new'); }, rowActions, modals };
}
