import { useCallback, useEffect, useMemo, useState } from 'react';
import { kindDe, listerTypes, typeDe } from '../registre';
import { ReportDef } from '../model';
import {
  ModeleInfo, chargerModele, cheminDossierModeles, definirModeleParDefaut, dupliquerModele, exporterModele, importerModeles,
  listerModeles, modeleParDefaut, ouvrirDossierModeles, peutOuvrirDossier, supprimerModele,
} from '../store';
import { rendreEtat } from '../engine/render';
import { PX_PAR_MM } from '../engine/measure';
import { REPORT_CSS_BASE } from '../engine/render';
import { useToast } from './toast';
import { ConfirmDialog } from './dialogs';
import { PageHeader, Tabs } from './atoms';
import { Ic } from './icons';
import ReportDesigner from './ReportDesigner';
import ReportPreview from './ReportPreview';
import { creerEtat } from '../model';
import { Racine } from './Racine';

const BTN = 'h-8 px-3 rounded-md border border-line text-ink-label font-bold text-[12px] inline-flex items-center gap-1.5 hover:bg-[var(--gcr-surface-sunken)] disabled:opacity-50';

/** Bibliothèque des modèles d'impression : miniatures, aperçu, personnalisation, import / export. */
function ModelesPageInterne() {
  const toast = useToast();
  const [liste, setListe] = useState<ModeleInfo[] | null>(null);
  const [filtre, setFiltre] = useState('tous');
  const [edition, setEdition] = useState<{ def: ReportDef; fichier?: string } | null>(null);
  const [apercu, setApercu] = useState<ReportDef | null>(null);
  const [aSupprimer, setASupprimer] = useState<ModeleInfo | null>(null);
  const [dossier, setDossier] = useState('');
  const [versionDefauts, setVersionDefauts] = useState(0);

  const recharger = useCallback(() => listerModeles().then(setListe), []);
  useEffect(() => { void recharger(); void cheminDossierModeles().then(setDossier); }, [recharger]);

  const types = useMemo(() => [{ code: 'tous', label: 'Tous', count: liste?.length }, ...listerTypes().map((k) => ({ code: k.id, label: k.label.split(' (')[0], count: liste?.filter((m) => m.kind === k.id).length }))], [liste]);
  const visibles = (liste ?? []).filter((m) => filtre === 'tous' || m.kind === filtre);

  async function ouvrir(m: ModeleInfo) {
    try { setEdition({ def: await chargerModele(m.ref), fichier: m.source === 'fichier' ? m.file : undefined }); } catch (e) { toast.error((e as Error).message); }
  }
  async function previsualiser(m: ModeleInfo) {
    try { setApercu(await chargerModele(m.ref)); } catch (e) { toast.error((e as Error).message); }
  }
  async function dupliquer(m: ModeleInfo) {
    try { const f = await dupliquerModele(m.ref); toast.success(`Copie créée : ${f}`); void recharger(); } catch (e) { toast.error((e as Error).message); }
  }
  async function exporter(m: ModeleInfo) {
    try { await exporterModele(await chargerModele(m.ref)); } catch (e) { toast.error((e as Error).message); }
  }
  async function importer() {
    const r = await importerModeles();
    if (r.importes.length) toast.success(`${r.importes.length} modèle(s) importé(s).`);
    r.erreurs.forEach((e) => toast.error(e));
    void recharger();
  }
  async function supprimer(m: ModeleInfo) {
    try { await supprimerModele(m.file); if (modeleParDefaut(m.kind) === m.ref) definirModeleParDefaut(m.kind, null); toast.success('Modèle supprimé.'); void recharger(); } catch (e) { toast.error((e as Error).message); }
    setASupprimer(null);
  }

  if (edition) {
    return <ReportDesigner initial={edition.def} fichier={edition.fichier} onClose={() => { setEdition(null); void recharger(); }} onSaved={() => void recharger()} />;
  }

  return (
    <div className="gcr-ui flex flex-col gap-4 p-5">
      <PageHeader title="Modèles d’impression">
        <button className={BTN} onClick={() => setEdition({ def: creerEtat(filtre === 'tous' ? kindDe('').id : filtre, 'Nouvel état') })} style={{ background: 'var(--gcr-brand-700)', color: '#fff', borderColor: 'transparent' }}>
          <Ic n="plus" size={14} /> Nouveau modèle
        </button>
        <button className={BTN} onClick={() => void importer()}><Ic n="upload" size={14} /> Importer…</button>
        {peutOuvrirDossier() && <button className={BTN} onClick={() => void ouvrirDossierModeles()}><Ic n="folder" size={14} /> Dossier</button>}
      </PageHeader>

      <p className="text-[12px] text-ink-muted -mt-2">
        Concevez vos propres documents imprimables : factures, bons, tickets, relevés, étiquettes… Chaque modèle est un fichier <span className="font-mono">.gcr</span> que vous pouvez copier, sauvegarder ou partager.
        {dossier && <> Dossier : <span className="font-mono">{dossier}</span></>}
      </p>

      <Tabs value={filtre} onChange={setFiltre} options={types} />

      {liste === null ? <div className="text-ink-muted text-[12px]">Chargement…</div> : visibles.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-10 text-center text-ink-muted text-[13px]">Aucun modèle pour ce type de document.</div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }} data-version={versionDefauts}>
          {visibles.map((m) => (
            <Carte key={m.ref} m={m} defaut={modeleParDefaut(m.kind) === m.ref}
                   surApercu={() => void previsualiser(m)} surModifier={() => void ouvrir(m)} surDupliquer={() => void dupliquer(m)}
                   surExporter={() => void exporter(m)} surSupprimer={() => setASupprimer(m)}
                   surDefaut={() => { definirModeleParDefaut(m.kind, modeleParDefaut(m.kind) === m.ref ? null : m.ref); setVersionDefauts((v) => v + 1); }} />
          ))}
        </div>
      )}

      {apercu && <ReportPreview def={apercu} data={kindDe(apercu.kind).sample} titre={`${apercu.name} — exemple`} onClose={() => setApercu(null)} onEdit={() => { setEdition({ def: apercu }); setApercu(null); }} />}
      {aSupprimer && <ConfirmDialog title="Supprimer ce modèle ?" message={<>Le fichier « <b>{aSupprimer.file}</b> » sera supprimé définitivement.</>} confirmLabel="Supprimer" danger
                                    onConfirm={() => void supprimer(aSupprimer)} onCancel={() => setASupprimer(null)} />}
    </div>
  );
}

function Carte({ m, defaut, surApercu, surModifier, surDupliquer, surExporter, surSupprimer, surDefaut }: {
  m: ModeleInfo; defaut: boolean; surApercu: () => void; surModifier: () => void; surDupliquer: () => void; surExporter: () => void; surSupprimer: () => void; surDefaut: () => void;
}) {
  const [mini, setMini] = useState<{ html: string; w: number; h: number } | null>(null);
  useEffect(() => {
    let vivant = true;
    chargerModele(m.ref).then((def) => {
      const r = rendreEtat(def, kindDe(def.kind).sample);
      if (vivant) setMini({ html: r.pages[0] ?? '', w: r.widthMm * PX_PAR_MM, h: r.heightMm * PX_PAR_MM });
    }).catch(() => { /* miniature indisponible */ });
    return () => { vivant = false; };
  }, [m.ref]);

  const largeurMini = 214;
  const echelle = mini ? largeurMini / mini.w : 1;
  const hauteurMax = 250;
  const hauteur = mini ? Math.min(mini.h * echelle, hauteurMax) : 150;

  return (
    <div className="bg-surface border border-line-soft rounded-lg shadow-soft overflow-hidden flex flex-col group">
      <style>{REPORT_CSS_BASE}</style>
      <button type="button" onClick={surApercu} aria-label={`Aperçu de ${m.name}`} className="relative block w-full p-2 text-left" style={{ background: '#E8EDF6', height: hauteur + 16 }}>
        {mini ? (
          <div style={{ width: largeurMini, height: hauteur, overflow: 'hidden', background: '#fff', boxShadow: '0 2px 8px rgb(10 18 34 / .25)', margin: '0 auto', position: 'relative' }}>
            <div style={{ transform: `scale(${echelle})`, transformOrigin: '0 0', width: mini.w, height: mini.h, pointerEvents: 'none' }} dangerouslySetInnerHTML={{ __html: mini.html }} />
          </div>
        ) : <div className="h-full flex items-center justify-center text-ink-muted"><Ic n="page" size={28} /></div>}
        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgb(15 26 46 / .35)' }}>
          <span className="px-3 h-8 rounded-md bg-white text-[12px] font-bold inline-flex items-center gap-1.5 text-[#0F1A2E]"><Ic n="eye" size={14} /> Aperçu</span>
        </span>
      </button>
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-extrabold text-[13px] text-ink truncate" title={m.name}>{m.name}</div>
            <div className="text-[11px] text-ink-muted truncate">{typeDe(m.kind)?.label.split(' (')[0] ?? m.kind}</div>
          </div>
          <button type="button" onClick={surDefaut} aria-pressed={defaut} title={defaut ? 'Modèle par défaut pour ce type de document' : 'Définir comme modèle par défaut'}
                  className="h-7 w-7 rounded inline-flex items-center justify-center hover:bg-[var(--gcr-surface-sunken)]" style={{ color: defaut ? '#D97706' : 'var(--gcr-text-muted)' }}>
            <Ic n="star" size={16} />
          </button>
        </div>
        {m.description && <p className="text-[11px] text-ink-label leading-snug line-clamp-2">{m.description}</p>}
        <div className="flex items-center gap-1 mt-auto pt-1">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded mr-auto" style={{ background: m.source === 'integre' ? 'var(--gcr-surface-sunken)' : 'rgb(36 80 224 / .1)', color: m.source === 'integre' ? 'var(--gcr-text-muted)' : 'var(--gcr-brand-700)' }}>
            {m.source === 'integre' ? 'Intégré' : 'Mes modèles'}
          </span>
          <button type="button" onClick={surModifier} className="h-7 px-2 rounded border border-line text-[11.5px] font-bold text-ink-label hover:bg-[var(--gcr-surface-sunken)] inline-flex items-center gap-1" title={m.source === 'integre' ? 'Ouvrir une copie dans le designer' : 'Modifier dans le designer'}>
            <Ic n="settings" size={12} /> {m.source === 'integre' ? 'Personnaliser' : 'Modifier'}
          </button>
          <button type="button" onClick={surDupliquer} title="Dupliquer" aria-label="Dupliquer" className="h-7 w-7 rounded hover:bg-[var(--gcr-surface-sunken)] text-ink-label inline-flex items-center justify-center"><Ic n="copy" size={13} /></button>
          <button type="button" onClick={surExporter} title="Exporter (.gcr)" aria-label="Exporter" className="h-7 w-7 rounded hover:bg-[var(--gcr-surface-sunken)] text-ink-label inline-flex items-center justify-center"><Ic n="download" size={13} /></button>
          {m.source === 'fichier' && <button type="button" onClick={surSupprimer} title="Supprimer" aria-label="Supprimer" className="h-7 w-7 rounded hover:bg-[var(--gcr-surface-sunken)] inline-flex items-center justify-center" style={{ color: 'var(--gcr-danger)' }}><Ic n="trash" size={13} /></button>}
        </div>
      </div>
    </div>
  );
}

export default function ModelesPage() {
  return <Racine><ModelesPageInterne /></Racine>;
}
