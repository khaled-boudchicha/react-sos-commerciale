import type { ReportDef } from './model';
import { dimensionsPage } from './model';
import { kindDe } from './registre';
import { expressionsDuTexte, validerExpression } from './expr/parser';

export type Probleme = {
  niveau: 'erreur' | 'avertissement';
  message: string;
  bandeId?: string;
  objetId?: string;
};

/** Contrôle statique d'un modèle : expressions, sources de données, structure des bandes, débordements. */
export function verifierModele(def: ReportDef): Probleme[] {
  const p: Probleme[] = [];
  const kind = kindDe(def.kind);
  const datasets = new Set(kind.datasets.map((d) => d.name.toLowerCase()));
  const noms = new Set([...def.parameters.map((x) => x.name.toLowerCase()), ...def.variables.map((x) => x.name.toLowerCase())]);
  const { w } = dimensionsPage(def.page);
  const largeur = w - def.page.margins.left - def.page.margins.right;

  const expr = (src: string | undefined, contexte: string, bandeId: string, objetId?: string) => {
    if (!src?.trim()) return;
    const e = validerExpression(src);
    if (e) p.push({ niveau: 'erreur', message: `${contexte} : ${e}`, bandeId, objetId });
  };
  const modele = (src: string, contexte: string, bandeId: string, objetId: string) => {
    for (const e of expressionsDuTexte(src)) expr(e, contexte, bandeId, objetId);
  };

  for (const v of def.variables) {
    if (!v.expr.trim()) p.push({ niveau: 'avertissement', message: `Variable « ${v.name} » sans expression.` });
    else { const e = validerExpression(v.expr); if (e) p.push({ niveau: 'erreur', message: `Variable « ${v.name} » : ${e}` }); }
  }
  const vus = new Set<string>();
  for (const n of [...def.parameters.map((x) => x.name), ...def.variables.map((x) => x.name)]) {
    if (vus.has(n.toLowerCase())) p.push({ niveau: 'erreur', message: `Le nom « ${n} » est utilisé plusieurs fois (paramètre / variable).` });
    vus.add(n.toLowerCase());
  }

  const ids = new Set(def.bands.map((b) => b.id));
  for (const b of def.bands) {
    const nom = `Bande « ${b.name} »`;
    if (b.parent && !ids.has(b.parent)) p.push({ niveau: 'erreur', message: `${nom} : bande principale introuvable.`, bandeId: b.id });
    if (b.type === 'data' && !b.dataSource?.trim()) p.push({ niveau: 'erreur', message: `${nom} : aucune source de données.`, bandeId: b.id });
    if (b.dataSource) {
      const tete = b.dataSource.split('.')[0].toLowerCase();
      if (!b.parent && !datasets.has(tete)) p.push({ niveau: 'avertissement', message: `${nom} : la source « ${b.dataSource} » n’existe pas pour ce type de document.`, bandeId: b.id });
    }
    if (b.type === 'groupHeader' && !b.groupBy?.trim()) p.push({ niveau: 'erreur', message: `${nom} : expression de regroupement manquante.`, bandeId: b.id });
    expr(b.filter, `${nom} › filtre`, b.id);
    expr(b.visible, `${nom} › visibilité`, b.id);
    expr(b.groupBy, `${nom} › regroupement`, b.id);
    (b.sort ?? []).forEach((s) => expr(s.expr, `${nom} › tri`, b.id));
    if ((b.columns ?? 1) > 1 && b.type !== 'data') p.push({ niveau: 'avertissement', message: `${nom} : les colonnes ne s’appliquent qu’aux bandes de données.`, bandeId: b.id });

    for (const o of b.objects) {
      const ctx = `${nom} › ${o.name}`;
      expr(o.visible, `${ctx} › visibilité`, b.id, o.id);
      if (o.type === 'text') modele(o.text, ctx, b.id, o.id);
      if (o.type === 'barcode') modele(o.value, ctx, b.id, o.id);
      if (o.type === 'image') expr(o.expr, ctx, b.id, o.id);
      if (o.type === 'checkbox') expr(o.checked, ctx, b.id, o.id);
      if (o.x + o.w > largeur + 0.5) p.push({ niveau: 'avertissement', message: `${ctx} dépasse la largeur utile de la page (${Math.round(largeur)} mm).`, bandeId: b.id, objetId: o.id });
      if (o.y + o.h > b.height + 0.5 && !(b.canGrow ?? true)) p.push({ niveau: 'avertissement', message: `${ctx} dépasse le bas de la bande.`, bandeId: b.id, objetId: o.id });
      if (o.type === 'text' && o.text.trim() === '') p.push({ niveau: 'avertissement', message: `${ctx} est vide.`, bandeId: b.id, objetId: o.id });
    }
  }
  void noms;
  if (!def.bands.length) p.push({ niveau: 'avertissement', message: 'Le modèle ne contient aucune bande.' });
  return p;
}
