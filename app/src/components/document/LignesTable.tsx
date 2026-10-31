import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { fmtDate, fmtMoney, fmtQte } from '../../lib/format';
import {
  LigneDoc, Sens, ColonneId, colonnesPour, useColonnesConfig,
  netHtLigne, totalTtcLigne, prixTtcUnitaire, remiseMontantLigne,
  depuisPrixTtc, depuisRemiseMontant,
} from './lignesDocument';
import {
  COLONNES_BASE, ColonneBaseId, Densite, LARGEUR, MODELES, ModeleId,
  colonnesDuModele, modeleActif, useColonnesBase, useDefilementHorizontal, useDensiteLignes,
} from './lignesAffichage';
import LotCell from './LotCell';
import { Button, IconButton } from '../ui/Button';
import { Checkbox, SegmentedControl } from '../ui/Field';
import { Icon, Kbd } from '../ui/Icon';
import { EmptyState } from '../ui/States';
import { cn } from '../ui/cn';

/** Cellule éditable : discrète au repos, contour au survol, champ plein au focus. */
const cellEdit = 'w-full bg-transparent text-ink border border-transparent rounded-sm '
  + 'hover:border-line focus:border-brand-500 focus:bg-surface';
const HAUTEUR: Record<Densite, string> = { compacte: 'h-control-sm text-sm', confort: 'h-control-md text-base' };

/** Nombre édité sans imposer un 0 collant : champ vide toléré pendant la saisie. */
function num(v: string): number { return parseFloat(v) || 0; }

/** Ombre de bord (reste des colonnes de ce côté) — voile thémé, aucun hex. */
const OMBRE: Record<'gauche' | 'droite', CSSProperties> = {
  gauche: { background: 'linear-gradient(to right, var(--overlay), transparent)' },
  droite: { background: 'linear-gradient(to left, var(--overlay), transparent)' },
};

type Colonne = {
  id: string;
  titre: ReactNode;
  /** Info-bulle de l'en-tête (abréviations). */
  aide?: string;
  /** Largeur fixe en px ; absente = colonne flexible (désignation). */
  largeur?: number;
  align?: 'right' | 'center';
  /** Cellule de saisie (padding réduit, le champ porte le sien). */
  champ?: boolean;
  fige?: { cote: 'gauche' | 'droite'; decalage: number; bord?: boolean };
  cellule: (l: LigneDoc, index: number) => ReactNode;
};

/** Colonne optionnelle : présente seulement si cochée. */
function si(visible: boolean, c: Colonne): Colonne[] { return visible ? [c] : []; }

export default function LignesTable({ sens, lignes, patch, remove }: {
  sens: Sens;
  lignes: LigneDoc[];
  patch: (key: number, p: Partial<LigneDoc>) => void;
  remove: (key: number) => void;
}) {
  const { visibles, basculer, reinitialiser } = useColonnesConfig(sens);
  const base = useColonnesBase(sens);
  const [densite, setDensite] = useDensiteLignes();
  const [active, setActive] = useState<number | null>(null);
  const defil = useDefilementHorizontal([visibles, base.masquees, densite, lignes.length]);
  const vis = (id: ColonneId) => visibles.has(id);
  const prixLabel = sens === 'achat' ? 'Coût HT' : 'P.U. HT';
  const compacte = densite === 'compacte';
  const champ = cn(cellEdit, HAUTEUR[densite]);
  const champNum = cn(champ, 'text-right money px-2');

  const enRupture = (l: LigneDoc) => sens === 'vente' && l.stock !== undefined && l.qte > l.stock;

  // ── Colonnes (ordre d'affichage) : identification figée à gauche, totaux figés à droite ──
  const colonnes: Colonne[] = [
    {
      id: 'numero', titre: 'N°', aide: 'Numéro de ligne', largeur: LARGEUR.numero, align: 'center',
      fige: { cote: 'gauche', decalage: 0 },
      cellule: (l, index) => {
        const i = index + 1;
        return enRupture(l)
          ? <span className="inline-flex items-center gap-0.5 money text-xs font-semibold text-danger-text">
              <Icon name="alert" size={12} label="Quantité supérieure au stock" />{i}
            </span>
          : <span className="money text-xs text-ink-muted">{i}</span>;
      },
    },
    {
      id: 'article', titre: 'Article', fige: { cote: 'gauche', decalage: LARGEUR.numero, bord: true },
      cellule: (l) => <CelluleArticle l={l} compacte={compacte} rupture={enRupture(l)} remiseMasquee={base.masquees.has('remise')}
                                      lotMasque={!vis('lot')} peremptionMasquee={!vis('peremption')} />,
    },
    ...si(vis('tarif'), {
      id: 'tarif', titre: 'Tarif', aide: 'Niveau de tarif (1 à 4)', largeur: LARGEUR.tarif, align: 'right', champ: true,
      cellule: (l) => (
        <select value={l.tarif ?? 1}
                onChange={(e) => {
                  const t = Number(e.target.value);
                  const prix = l.prixTiers?.[t - 1];
                  patch(l.key, { tarif: t, ...(prix ? { prix_ht: prix } : {}) });
                }}
                aria-label="Tarif" className={cn(champ, 'money px-1 cursor-pointer')}>
          {[1, 2, 3, 4].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      ),
    }),
    {
      id: 'qte', titre: 'Qté', aide: 'Quantité', largeur: LARGEUR.qte, align: 'right', champ: true,
      cellule: (l) => <input type="number" min="0" step="any" value={l.qte} aria-label="Quantité"
                             onChange={(e) => patch(l.key, { qte: num(e.target.value) })}
                             className={cn(champNum, enRupture(l) && '!text-danger-text font-semibold')} />,
    },
    ...si(vis('colis'), {
      id: 'colis', titre: 'Colis', aide: 'Colisage', largeur: LARGEUR.colis, align: 'right', champ: true,
      cellule: (l) => <input type="number" min="0" step="1" value={l.colis ?? ''} aria-label="Colis"
                             placeholder="—" onChange={(e) => patch(l.key, { colis: num(e.target.value) })} className={champNum} />,
    }),
    {
      id: 'prix_ht', titre: prixLabel, aide: sens === 'achat' ? 'Coût unitaire HT' : 'Prix unitaire HT',
      largeur: LARGEUR.prix_ht, align: 'right', champ: true,
      cellule: (l) => <input type="number" min="0" step="0.01" value={l.prix_ht} aria-label={prixLabel}
                             onChange={(e) => patch(l.key, { prix_ht: num(e.target.value) })} className={champNum} />,
    },
    ...si(vis('prix_ttc'), {
      id: 'prix_ttc', titre: 'P.U. TTC', aide: 'Prix unitaire TTC', largeur: LARGEUR.prix_ttc, align: 'right', champ: true,
      cellule: (l) => <input type="number" min="0" step="0.01" value={round2(prixTtcUnitaire(l))} aria-label="P.U. TTC"
                             onChange={(e) => patch(l.key, depuisPrixTtc(l, num(e.target.value)))} className={champNum} />,
    }),
    ...si(!base.masquees.has('remise'), {
      id: 'remise', titre: 'Rem. %', aide: 'Remise en pourcentage', largeur: LARGEUR.remise, align: 'right', champ: true,
      cellule: (l) => <input type="number" min="0" max="100" step="0.5" value={l.remise} aria-label="Remise %"
                             onChange={(e) => patch(l.key, { remise: num(e.target.value) })} className={champNum} />,
    }),
    ...si(vis('remise_montant'), {
      id: 'remise_montant', titre: 'Rem. montant', aide: 'Remise en montant', largeur: LARGEUR.remise_montant, align: 'right', champ: true,
      cellule: (l) => <input type="number" min="0" step="0.01" value={round2(remiseMontantLigne(l))} aria-label="Remise en montant"
                             onChange={(e) => patch(l.key, depuisRemiseMontant(l, num(e.target.value)))} className={champNum} />,
    }),
    ...si(!base.masquees.has('tva'), {
      id: 'tva', titre: 'TVA %', aide: 'Taux de TVA', largeur: LARGEUR.tva, align: 'right',
      cellule: (l) => <span className="money">{fmtQte(l.tva)}</span>,
    }),
    ...si(vis('lot'), {
      id: 'lot', titre: 'N° lot', aide: 'Numéro de lot', largeur: LARGEUR.lot, champ: true,
      cellule: (l) => <LotCell sens={sens} line={l} patch={patch} />,
    }),
    ...si(vis('peremption'), {
      id: 'peremption', titre: 'Péremption', aide: 'Date de péremption', largeur: LARGEUR.peremption, champ: true,
      cellule: (l) => <input type="date" value={l.date_peremption ?? ''} aria-label="Date de péremption"
                             onChange={(e) => patch(l.key, { date_peremption: e.target.value })}
                             className={cn(champ, 'money px-2')} />,
    }),
    ...si(vis('total_ht'), {
      id: 'total_ht', titre: 'Total HT', aide: 'Total net HT de la ligne', largeur: LARGEUR.total_ht, align: 'right',
      cellule: (l) => <span className="money">{fmtMoney(netHtLigne(l))}</span>,
    }),
    {
      id: 'total_ttc', titre: 'Total TTC', aide: 'Total TTC de la ligne', largeur: LARGEUR.total_ttc, align: 'right',
      fige: { cote: 'droite', decalage: LARGEUR.suppr, bord: true },
      cellule: (l) => <span className="money font-semibold text-ink">{fmtMoney(totalTtcLigne(l))}</span>,
    },
    {
      id: 'suppr', titre: <span className="sr-only">Actions</span>, largeur: LARGEUR.suppr, align: 'center',
      fige: { cote: 'droite', decalage: 0 },
      cellule: (l) => <IconButton icon="trash" label="Supprimer la ligne" tone="danger" size="xs" onClick={() => remove(l.key)} />,
    },
  ];

  const largeurMin = colonnes.reduce((s, c) => s + (c.largeur ?? LARGEUR.article_min), 0);
  // Affichage seulement : somme des quantités déjà saisies sur les lignes.
  const qteTotale = lignes.reduce((s, l) => s + (Number(l.qte) || 0), 0);
  const nbRupture = lignes.filter(enRupture).length;
  const modele = modeleActif(visibles, base.masquees, sens);

  /** Classes d'une cellule figée (position, couche, séparateur visible quand du contenu défile derrière). */
  function fige(c: Colonne, entete: boolean): { className: string; style?: CSSProperties } {
    if (!c.fige) return { className: '' };
    const { cote, decalage, bord } = c.fige;
    const defile = cote === 'gauche' ? defil.gauche : defil.droite;
    return {
      className: cn('sticky', entete ? 'z-30' : 'z-10',
        bord && (cote === 'gauche' ? 'border-r' : 'border-l'),
        bord && (defile ? (cote === 'gauche' ? 'border-r-line' : 'border-l-line') : (cote === 'gauche' ? 'border-r-transparent' : 'border-l-transparent'))),
      style: cote === 'gauche' ? { left: decalage } : { right: decalage },
    };
  }

  function ombre(c: Colonne) {
    if (!c.fige?.bord) return null;
    const cote = c.fige.cote;
    if (!(cote === 'gauche' ? defil.gauche : defil.droite)) return null;
    return <span aria-hidden="true"
                 className={cn('pointer-events-none absolute inset-y-0 w-2 opacity-20', cote === 'gauche' ? 'left-full' : 'right-full')}
                 style={OMBRE[cote]} />;
  }

  return (
    <div className="bg-surface border border-line-soft rounded-md shadow-soft flex flex-col min-w-0">
      {/* ── Barre : titre + modèle courant · densité · colonnes ── */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-line-soft">
        <span className="inline-flex items-center gap-1.5 min-w-0 text-xs font-semibold text-ink-label">
          <Icon name="list" size={14} className="text-ink-muted" />Lignes
          <span className="font-normal text-ink-muted truncate">
            · {modele ? MODELES.find((m) => m.id === modele)!.label : 'Disposition personnalisée'}
          </span>
        </span>
        <div className="flex items-center gap-2 flex-none">
          <SegmentedControl<Densite> size="sm" label="Densité des lignes" value={densite} onChange={setDensite}
                                     options={[{ value: 'compacte', label: 'Compacte' }, { value: 'confort', label: 'Confort' }]} />
          <SelecteurColonnes sens={sens} visibles={visibles} basculer={basculer} reinitialiser={reinitialiser} modele={modele}
                             masquees={base.masquees} basculerBase={base.basculer} definirBase={base.definir} />
        </div>
      </div>

      {/* ── Grille : défilement horizontal maîtrisé, en-tête collant, colonnes figées ── */}
      <div ref={defil.ref} onScroll={defil.onScroll} onFocusCapture={defil.onFocusCapture}
           className="relative isolate overflow-auto max-h-[62vh] overscroll-x-contain">
        <table className="w-full table-fixed border-separate border-spacing-0 text-sm" style={{ minWidth: largeurMin }}>
          <colgroup>
            {colonnes.map((c) => <col key={c.id} style={c.largeur ? { width: c.largeur } : undefined} />)}
          </colgroup>
          <thead>
            <tr>
              {colonnes.map((c) => {
                const f = fige(c, true);
                return (
                  <th key={c.id} scope="col" title={c.aide} data-fige={c.fige?.cote}
                      className={cn('sticky top-0 z-20 bg-sunken border-b border-line-soft whitespace-nowrap',
                        'text-2xs font-bold uppercase tracking-wider text-ink-label',
                        compacte ? 'py-2' : 'py-2.5', c.champ ? 'px-2' : 'px-3',
                        c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                        f.className)}
                      style={f.style}>
                    <span className="block truncate">{c.titre}</span>
                    {ombre(c)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, n) => {
              const rupture = enRupture(l);
              const estActive = active === l.key;
              const fond = rupture ? 'bg-danger-soft' : estActive ? 'bg-brand-soft' : 'bg-surface group-hover:bg-hover';
              return (
                <tr key={l.key} className="group"
                    onFocus={() => setActive(l.key)}
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setActive((k) => (k === l.key ? null : k));
                    }}>
                  {colonnes.map((c, i) => {
                    const f = fige(c, false);
                    return (
                      <td key={c.id} data-fige={c.fige?.cote}
                          className={cn(fond, 'border-b border-line-soft align-middle text-ink',
                            compacte ? 'py-0.5' : 'py-1.5', c.champ ? 'px-1' : 'px-3',
                            c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                            i === 0 && estActive && 'shadow-[inset_3px_0_0_var(--brand-700)]',
                            i === 0 && !estActive && rupture && 'shadow-[inset_3px_0_0_var(--danger-solid)]',
                            f.className)}
                          style={f.style}>
                        {c.cellule(l, n)}
                        {ombre(c)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {lignes.length === 0 && (
        <EmptyState size="sm" icon="package" title="Aucune ligne"
                    description="Recherchez un article ci-dessus, ou scannez un code-barres. Entrée pour l'ajouter." />
      )}

      {/* ── Pied récapitulatif : collant en bas de la fenêtre tant que la carte dépasse ── */}
      <div className="sticky bottom-0 z-sticky flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-1.5 border-t border-line-soft bg-sunken rounded-b-md text-xs text-ink-muted">
        <span className="inline-flex items-center gap-3">
          <span><b className="money text-ink">{lignes.length}</b> ligne{lignes.length > 1 ? 's' : ''}</span>
          {lignes.length > 0 && (
            <span>Qté totale <b className="money text-ink">{fmtQte(qteTotale)}</b></span>
          )}
          {nbRupture > 0 && (
            <span className="inline-flex items-center gap-1 font-semibold text-danger-text">
              <Icon name="alert" size={12} />{nbRupture === 1 ? '1 ligne dépasse le stock' : `${nbRupture} lignes dépassent le stock`}
            </span>
          )}
        </span>
        <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1"><Kbd>F2</Kbd>Article</span>
          <span className="inline-flex items-center gap-1"><Kbd>Entrée</Kbd>Ajouter</span>
          <span className="inline-flex items-center gap-1"><Kbd>Tab</Kbd>Cellule suivante</span>
          {(defil.gauche || defil.droite) && (
            <span className="inline-flex items-center gap-1"><Kbd>Maj</Kbd>+ molette : autres colonnes</span>
          )}
        </span>
      </div>
    </div>
  );
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

/** Désignation tronquée (info-bulle complète) + sous-ligne discrète : code · stock · lot / péremption masqués. */
function CelluleArticle({ l, compacte, rupture, remiseMasquee, lotMasque, peremptionMasquee }: {
  l: LigneDoc; compacte: boolean; rupture: boolean; remiseMasquee: boolean; lotMasque: boolean; peremptionMasquee: boolean;
}) {
  const rem = remiseMasquee && l.remise ? `${fmtQte(l.remise)} %` : null;
  const lot = lotMasque && l.n_lot ? l.n_lot : null;
  const per = peremptionMasquee && l.date_peremption ? fmtDate(l.date_peremption) : null;
  const bulle = [
    l.designation,
    l.code_article,
    l.stock !== undefined ? `stock ${fmtQte(l.stock)}${rupture ? ' (dépassé)' : ''}` : null,
    `TVA ${fmtQte(l.tva)} %`,
    l.remise ? `remise ${fmtQte(l.remise)} %` : null,
    l.n_lot ? `lot ${l.n_lot}` : null,
    l.date_peremption ? `péremption ${fmtDate(l.date_peremption)}` : null,
  ].filter(Boolean).join(' · ');
  return (
    <div className="min-w-0" title={bulle}>
      <div className={cn('truncate font-semibold text-ink', compacte ? 'text-sm' : 'text-base')}>{l.designation}</div>
      <div className={cn('flex items-center gap-1 min-w-0 whitespace-nowrap overflow-hidden text-ink-muted', compacte ? 'text-2xs' : 'text-xs')}>
        <span className="money flex-none">{l.code_article}</span>
        {l.stock !== undefined && (
          <span className={cn('flex-none inline-flex items-center gap-0.5', rupture && 'font-semibold text-danger-text')}>
            · stock {fmtQte(l.stock)}
            {rupture && <><Icon name="alert" size={12} className="ml-0.5" />dépasse le stock</>}
          </span>
        )}
        {rem && <span className="flex-none">· rem. <span className="money">{rem}</span></span>}
        {lot && <span className="truncate">· lot <span className="money">{lot}</span></span>}
        {per && <span className="flex-none">· pér. <span className="money">{per}</span></span>}
      </div>
    </div>
  );
}

/** Bouton « Colonnes » + panneau : modèles, colonnes affichées, réinitialisation. */
function SelecteurColonnes({ sens, visibles, basculer, reinitialiser, modele, masquees, basculerBase, definirBase }: {
  sens: Sens; visibles: Set<ColonneId>; basculer: (id: ColonneId) => void; reinitialiser: () => void;
  modele: ModeleId | null;
  masquees: Set<ColonneBaseId>; basculerBase: (id: ColonneBaseId) => void; definirBase: (ids: ColonneBaseId[]) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [ouvert]);

  /** Applique un modèle = un jeu de colonnes visibles (mêmes ids, même persistance). */
  function appliquer(id: ModeleId) {
    const cible = colonnesDuModele(id, sens);
    definirBase(cible.masquees);
    if (id === 'standard') { reinitialiser(); return; }
    for (const c of colonnesPour(sens)) if (cible.visibles.has(c.id) !== visibles.has(c.id)) basculer(c.id);
  }
  function toutReinitialiser() { definirBase([]); reinitialiser(); }

  // Ordre de la grille : base (Remise %, TVA %) intercalées parmi les colonnes optionnelles
  const options: { id: string; label: string; coche: boolean; basculer: () => void }[] = [];
  for (const c of colonnesPour(sens)) {
    if (c.id === 'remise_montant') options.push(optionBase('remise'));
    if (c.id === 'lot') options.push(optionBase('tva'));
    options.push({ id: c.id, label: c.label, coche: visibles.has(c.id), basculer: () => basculer(c.id) });
  }
  function optionBase(id: ColonneBaseId) {
    const meta = COLONNES_BASE.find((b) => b.id === id)!;
    return { id, label: meta.label, coche: !masquees.has(id), basculer: () => basculerBase(id) };
  }

  return (
    <div className="relative" ref={ref}
         onKeyDown={(e) => { if (e.key === 'Escape' && ouvert) { e.stopPropagation(); setOuvert(false); bouton.current?.focus(); } }}>
      <Button ref={bouton} size="xs" variant="ghost" icon="columns" iconRight="chevronDown" onClick={() => setOuvert((v) => !v)}
              title="Choisir les colonnes affichées" aria-haspopup="true" aria-expanded={ouvert}
              className={ouvert ? '!bg-hover !text-ink' : undefined}>
        Colonnes
      </Button>
      {ouvert && (
        <div role="group" aria-label="Colonnes affichées"
             className="absolute right-0 mt-1 z-dropdown w-72 max-h-[70vh] overflow-y-auto bg-raised border border-line-soft rounded-md shadow-lifted py-1 animate-pop-in">
          <div className="px-3 pt-2 pb-1 text-2xs font-bold uppercase tracking-wider text-ink-muted">Modèle de colonnes</div>
          {MODELES.map((m) => {
            const sel = modele === m.id;
            return (
              <button key={m.id} type="button" aria-pressed={sel} onClick={() => appliquer(m.id)}
                      className={cn('w-full flex items-start gap-2 px-3 py-1.5 text-left outline-none hover:bg-hover focus-visible:bg-hover',
                        sel && 'text-brand-text')}>
                <span className="w-4 pt-0.5 flex-none">{sel && <Icon name="check" size={14} />}</span>
                <span className="flex flex-col min-w-0">
                  <span className={cn('text-base', sel ? 'font-semibold' : 'text-ink')}>{m.label}</span>
                  <span className="text-xs text-ink-muted">{m.description}</span>
                </span>
              </button>
            );
          })}
          <div className="my-1 border-t border-line-soft" role="separator" />
          <div className="px-3 pt-1 pb-1 text-2xs font-bold uppercase tracking-wider text-ink-muted">Colonnes affichées</div>
          {options.map((o) => (
            <Checkbox key={o.id} label={o.label} checked={o.coche} onChange={o.basculer}
                      className="w-full px-3 py-1.5 hover:bg-hover" />
          ))}
          <div className="my-1 border-t border-line-soft" role="separator" />
          <div className="px-3 py-1">
            <Button size="xs" variant="link" icon="refresh" onClick={toutReinitialiser}>Réinitialiser</Button>
          </div>
        </div>
      )}
    </div>
  );
}
