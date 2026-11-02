import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReportData, ReportDef } from '../../model';
import { kindDe } from '../../registre';
import { evaluerExpression, resoudreTexte } from '../../expr/eval';
import { expressionsDuTexte, validerExpression } from '../../expr/parser';
import { porteeApercu } from '../../engine/render';
import { Ic } from '../icons';
import DataPanel from './DataPanel';

const OPERATEURS = ['+', '-', '*', '/', '(', ')', '&', '=', '<>', '<', '>', '>=', '<=', 'and', 'or', ',', "'texte'"];

/**
 * Éditeur d'expression : arbre de champs et de fonctions, saisie avec insertion au curseur,
 * validation de la syntaxe et résultat calculé en direct sur les données d'exemple du type de document.
 * `multiple` = texte libre contenant des expressions entre crochets ; sinon une seule expression.
 */
export default function ExprEditor({ def, titre, valeur, multiple, donnees, surValider, surFermer }: {
  def: ReportDef; titre: string; valeur: string; multiple?: boolean;
  /** Données de l'aperçu (vraies données de la pièce imprimée) ; sinon le jeu d'exemple du type de document. */
  donnees?: ReportData;
  surValider: (v: string) => void; surFermer: () => void;
}) {
  const [texte, setTexte] = useState(valeur);
  const zone = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { zone.current?.focus(); }, []);

  const kind = kindDe(def.kind);
  const jeu = donnees ?? kind.sample;
  const apercu = useMemo(() => {
    const scope = porteeApercu(def, jeu);
    if (multiple) {
      const r = resoudreTexte(texte, scope);
      return { valeur: r.texte, erreurs: r.erreurs, type: 'texte' };
    }
    if (!texte.trim()) return { valeur: '', erreurs: [] as string[], type: '' };
    const r = evaluerExpression(texte, scope);
    if (r.erreur) return { valeur: '', erreurs: [r.erreur], type: '' };
    const v = r.valeur;
    return { valeur: v instanceof Date ? v.toLocaleDateString('fr-FR') : v == null ? '(vide)' : String(v), erreurs: [] as string[], type: v instanceof Date ? 'date' : v === null ? 'vide' : typeof v === 'number' ? 'nombre' : typeof v === 'boolean' ? 'booléen' : 'texte' };
  }, [texte, def, jeu, multiple]);

  const erreursSyntaxe = multiple
    ? expressionsDuTexte(texte).map((e) => validerExpression(e)).filter((x): x is string => !!x)
    : texte.trim() ? [validerExpression(texte)].filter((x): x is string => !!x) : [];
  const erreurs = [...new Set([...erreursSyntaxe, ...apercu.erreurs])];
  const valide = erreursSyntaxe.length === 0;
  const modifie = texte !== valeur;

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); surFermer(); }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        // Même règle que le bouton « Valider » : une expression invalide n'est jamais enregistrée dans le modèle
        e.preventDefault();
        if (valide) { surValider(texte); surFermer(); }
      }
    };
    window.addEventListener('keydown', touche, true);
    return () => window.removeEventListener('keydown', touche, true);
  }, [texte, valide, surValider, surFermer]);

  function inserer(brut: string) {
    const el = zone.current;
    const debut = el?.selectionStart ?? texte.length, fin = el?.selectionEnd ?? texte.length;
    const suite = texte.slice(0, debut) + brut + texte.slice(fin);
    setTexte(suite);
    requestAnimationFrame(() => { el?.focus(); const p = debut + brut.length; el?.setSelectionRange(p, p); });
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6" style={{ background: 'rgb(15 26 46 / .55)' }}
         onPointerDown={() => { if (!modifie) surFermer(); /* une saisie modifiée ne se perd pas sur un clic à côté */ }} role="dialog" aria-modal="true" aria-label={titre}>
      <div className="bg-surface border border-line-soft rounded-lg shadow-lifted w-[920px] max-w-full h-[600px] max-h-full flex flex-col overflow-hidden" onPointerDown={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-line-soft flex items-center gap-2 flex-none">
          <Ic n="fx" size={16} />
          <div className="font-extrabold text-[14px] text-ink">{titre}</div>
          <div className="text-[11.5px] text-ink-muted">{multiple ? 'Texte libre : mettez les expressions entre crochets, ex. Total [Facture.total_ttc] DA' : 'Une expression, sans crochets'}</div>
          <button onClick={surFermer} aria-label="Fermer" className="ml-auto h-7 w-7 rounded hover:bg-[var(--gcr-surface-sunken)] inline-flex items-center justify-center"><Ic n="close" size={16} /></button>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="w-[270px] flex-none border-r border-line-soft">
            <DataPanel def={def} compact onInserer={(c) => inserer(multiple ? c.texte : c.texte.replace(/^\[|\]$/g, ''))} />
          </div>

          <div className="flex-1 flex flex-col min-w-0 p-4 gap-3">
            <div className="flex flex-wrap gap-1">
              {OPERATEURS.map((o) => (
                <button key={o} type="button" onClick={() => inserer(o === "'texte'" ? "''" : /^[a-z]/.test(o) ? ` ${o} ` : ` ${o} `.replace(/^ ([()]) $/, '$1'))}
                        className="h-6 px-2 rounded border border-line text-[11.5px] font-mono font-bold text-ink-label hover:bg-[var(--gcr-surface-sunken)]">{o}</button>
              ))}
            </div>

            <textarea ref={zone} value={texte} onChange={(e) => setTexte(e.target.value)} spellCheck={false} aria-label="Expression"
                      className="flex-1 min-h-[140px] rounded border bg-surface text-ink font-mono text-[13px] p-3 resize-none focus:outline-none"
                      style={{ borderColor: erreurs.length ? 'var(--gcr-danger)' : 'var(--gcr-line)' }}
                      placeholder={multiple ? 'Facture N° [Facture.numero] du [FORMAT(Facture.date, "dd/MM/yyyy")]' : 'SUM(Lignes.total_ht) * 1.19'} />

            <div className="rounded border border-line-soft p-3 flex-none" style={{ background: 'var(--gcr-surface-sunken)' }}>
              <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-ink-muted mb-1.5">{donnees ? 'Résultat sur les données du document' : 'Résultat sur les données d’exemple'}</div>
              {erreurs.length > 0
                ? <ul className="text-[12px] space-y-0.5" style={{ color: 'var(--gcr-danger)' }}>{erreurs.map((e) => <li key={e} className="flex gap-1.5"><Ic n="warning" size={13} /> {e}</li>)}</ul>
                : <div className="text-[13px] text-ink break-words whitespace-pre-wrap money">{apercu.valeur === '' ? <span className="text-ink-muted">—</span> : apercu.valeur}{apercu.type && !multiple && <span className="ml-2 text-[10.5px] text-ink-muted font-sans">({apercu.type})</span>}</div>}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-line-soft flex items-center gap-2 flex-none">
          <span className="text-[11px] text-ink-muted">{valide ? 'Ctrl+Entrée pour valider · Échap pour annuler' : 'Corrigez l’expression pour pouvoir la valider · Échap pour annuler'}</span>
          <button onClick={surFermer} className="ml-auto h-8 px-4 rounded-md border border-line text-ink-label font-bold text-[12px]">Annuler</button>
          <button onClick={() => { surValider(texte); surFermer(); }} disabled={!valide}
                  className="h-8 px-4 rounded-md text-white font-bold text-[12px] disabled:opacity-50" style={{ background: 'var(--gcr-brand-700)' }}>Valider</button>
        </div>
      </div>
    </div>
  );
}
