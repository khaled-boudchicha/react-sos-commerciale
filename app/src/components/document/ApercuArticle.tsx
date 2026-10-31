import { type ReactNode } from 'react';
import { useQuery } from '@apollo/client';
import { LOTS } from '../../api/queries';
import type { Article } from '../../api/types';
import { D, useDroits } from '../../lib/droits';
import { fmtDate, fmtQte } from '../../lib/format';
import { Badge, Money, StatusPill } from '../ui/atoms';
import { Button } from '../ui/Button';
import { DescriptionList, SectionTitle } from '../ui/Card';
import { Alert, Skeleton } from '../ui/States';
import ApercuCadre, { ApercuEnteteSimple, ApercuInvite, BoutonFermerApercu } from './ApercuCadre';

/** Nombre de lots montrés dans l'aperçu. */
const LOTS_MAX = 5;

type Lot = { id: number; n_lot: string; date_fabrication?: string | null; date_peremption?: string | null; qte: number };

/** Jours restants avant la péremption (négatif = périmé) — même calcul que l'écran de détail. */
const joursAvant = (date: string) => Math.round((new Date(date).getTime() - Date.now()) / 86_400_000);

/**
 * Aperçu rapide d'un article dans le panneau latéral de la liste du stock : identité, prix, stock
 * et lots les plus proches de la péremption. Lecture seule ; « Ouvrir la fiche » mène au détail.
 * Les données de l'article viennent de la ligne de la liste ; les lots, de la requête `LOTS` du
 * détail (mêmes variables, même cache Apollo), seulement avec le droit « accès Lot » comme ArticleDetail.
 */
export default function ApercuArticle({ article, onOuvrir, onFermer }: {
  /** Ligne sélectionnée ; `null` → invite à sélectionner une ligne. */
  article: Article | null | undefined;
  onOuvrir: () => void;
  onFermer: () => void;
}) {
  const { peut } = useDroits();
  const enveloppe = (entete: ReactNode, contenu: ReactNode) => (
    <ApercuCadre entete={entete} onFermer={onFermer} cle={article?.id}>{contenu}</ApercuCadre>
  );

  if (!article) {
    return enveloppe(<ApercuEnteteSimple titre="Aperçu" onFermer={onFermer} />,
      <ApercuInvite titre="Sélectionnez un article" ouvrir="la fiche" />);
  }

  const a = article;
  // État du stock : même règle que la colonne « État » de la liste
  const q = Number(a.qte_reale ?? 0), min = Number(a.stock_min ?? 0);
  const etat = q <= 0
    ? <StatusPill tone="bad">Rupture</StatusPill>
    : min > 0 && q <= min ? <StatusPill tone="warn">Stock bas</StatusPill> : <StatusPill tone="ok">OK</StatusPill>;

  const infos = [
    { label: 'Famille', value: a.famille ?? null },
    ...(a.unite_mesure ? [{ label: 'Unité', value: a.unite_mesure }] : []),
    ...(a.depot ? [{ label: 'Dépôt', value: a.depot }] : []),
    ...(a.code_bare ? [{ label: 'Code-barres', value: a.code_bare, mono: true }] : []),
  ];

  return enveloppe(
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <Badge tone="neutral" shape="square" className="money" title={a.code}>{a.code}</Badge>
        {etat}
        <span className="ml-auto flex items-center gap-1 flex-none">
          <Button size="sm" icon="externalLink" onClick={onOuvrir} title="Ouvrir la fiche (double-clic ou Entrée dans la liste)">Ouvrir la fiche</Button>
          <BoutonFermerApercu onFermer={onFermer} />
        </span>
      </div>
      <div className="font-bold text-md text-ink line-clamp-2" title={a.designation}>{a.designation}</div>
    </div>,
    <>
      <DescriptionList columns={2} items={infos} />

      <section aria-label="Prix">
        <SectionTitle icon="tag">Prix</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <Chiffre label="PMP"><Money value={a.pmp} /></Chiffre>
          <Chiffre label="P.V. TTC"><Money value={a.prix_vente_ttc} /></Chiffre>
          <Chiffre label="Marge %">
            <Money value={a.margep} digits={1} colorNeg={false} tone={Number(a.margep) < 0 ? 'danger' : 'success'} />
          </Chiffre>
        </div>
      </section>

      <section aria-label="Stock">
        <SectionTitle icon="package">Stock</SectionTitle>
        <div className="rounded-md border border-line-soft bg-sunken px-3 py-2.5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-ink-muted">Stock réel</div>
            <div className="flex items-baseline gap-2">
              <span className="money font-extrabold text-xl"
                    style={{ color: q <= 0 ? 'var(--danger-text)' : min > 0 && q <= min ? 'var(--warning-text)' : undefined }}>
                {fmtQte(a.qte_reale)}
              </span>
              {a.unite_mesure && <span className="text-xs text-ink-muted">{a.unite_mesure}</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold text-ink-muted">Stock min</div>
            <div className="money font-semibold text-base text-ink-label">{fmtQte(a.stock_min)}</div>
          </div>
        </div>
        {q <= 0 && <Alert tone="danger" compact className="mt-2">Article en rupture de stock.</Alert>}
        {q > 0 && min > 0 && q <= min && <Alert tone="warning" compact className="mt-2">Stock sous le minimum d'alerte.</Alert>}
      </section>

      {/* Lots : même condition d'affichage que la fiche article (droit « accès Lot ») */}
      {peut('stock', D.stock.lots) && <LotsArticle articleId={Number(a.id)} onOuvrir={onOuvrir} />}
    </>,
  );
}

function Chiffre({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border border-line-soft px-2.5 py-2">
      <div className="text-xs font-semibold text-ink-muted truncate">{label}</div>
      <div className="text-base font-semibold text-ink truncate">{children}</div>
    </div>
  );
}

function LotsArticle({ articleId, onOuvrir }: { articleId: number; onOuvrir: () => void }) {
  // Même requête et mêmes variables que ArticleDetail
  const { data, loading, error, refetch } = useQuery(LOTS, {
    variables: { article_id: articleId }, fetchPolicy: 'cache-and-network', nextFetchPolicy: 'cache-first',
  });
  const lots: Lot[] = Array.isArray(data?.lots) ? data.lots : [];
  // Lots en stock les plus proches de la péremption d'abord ; les lots sans date à la fin
  const enStock = lots.filter((l) => Number(l.qte ?? 0) > 0);
  const tries = [...enStock].sort((x, y) => {
    if (!x.date_peremption) return y.date_peremption ? 1 : 0;
    if (!y.date_peremption) return -1;
    return String(x.date_peremption).localeCompare(String(y.date_peremption));
  });
  const premiers = tries.slice(0, LOTS_MAX);

  return (
    <section aria-label="Lots et péremption">
      <SectionTitle icon="expiry">Lots & péremption{enStock.length > 0 ? ` (${enStock.length})` : ''}</SectionTitle>
      {error && !data ? (
        <Alert tone="danger" compact action={<Button size="sm" icon="refresh" onClick={() => void refetch()}>Réessayer</Button>}>
          {error.message}
        </Alert>
      ) : loading && !data ? (
        <div role="status" aria-label="Chargement des lots"><Skeleton lines={3} height={14} /></div>
      ) : premiers.length === 0 ? (
        <div className="text-sm text-ink-muted">Aucun lot en stock.</div>
      ) : (
        <>
          <ul className="flex flex-col">
            {premiers.map((l) => {
              const jours = l.date_peremption ? joursAvant(l.date_peremption) : null;
              return (
                <li key={l.id} className="flex items-center gap-2 py-1.5 border-b border-line-soft text-sm last:border-b-0">
                  <span className="flex-1 min-w-0 truncate money font-semibold text-ink" title={l.n_lot}>{l.n_lot}</span>
                  <span className="money text-ink-label flex-none">{l.date_peremption ? fmtDate(l.date_peremption) : '—'}</span>
                  {jours !== null && (
                    <StatusPill tone={jours < 0 ? 'bad' : jours <= 60 ? 'warn' : 'ok'}>{jours < 0 ? 'Périmé' : `J-${jours}`}</StatusPill>
                  )}
                  <span className="money font-semibold text-ink w-14 text-right flex-none">{fmtQte(l.qte)}</span>
                </li>
              );
            })}
          </ul>
          {enStock.length > LOTS_MAX && (
            <Button variant="link" size="sm" className="mt-1.5" onClick={onOuvrir}>
              + {enStock.length - LOTS_MAX} autre{enStock.length - LOTS_MAX > 1 ? 's' : ''} lot{enStock.length - LOTS_MAX > 1 ? 's' : ''}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
