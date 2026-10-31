import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client';
import { ARTICLE, FICHE_STOCK, LOTS, RECALCULER_STOCK_ARTICLE } from '../api/queries';
import { fmtDate, fmtQte } from '../lib/format';
import { D, useDroits } from '../lib/droits';
import DataGrid, { Column } from './ui/DataGrid';
import ConfirmDialog from './ui/ConfirmDialog';
import { useToast } from './ui/Toast';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Alert } from './ui/States';
import { TextInput } from './ui/Field';

type Mouvement = {
  date: string | null; origine: 'vente' | 'achat' | 'entree' | 'sortie' | 'production'; piece_id: number;
  nature: string; numero: string | null; tiers: string | null; lot: string | null;
  entree: number; sortie: number; stock: number;
};
type Fiche = {
  article: { id: number; code: string; stock_actuel: number };
  depart: { libelle: string; date: string | null; qte: number };
  ouverture: number; total_entrees: number; total_sorties: number; stock_calcule: number;
  lignes: Mouvement[];
};

const lienPiece = (m: Mouvement) => (m.origine === 'vente' ? `/ventes/${m.piece_id}` : m.origine === 'achat' ? `/achats/${m.piece_id}` : null);

/**
 * Fiche de stock (kardex) : tous les mouvements de l'article depuis son dernier
 * inventaire, avec le stock progressif — mêmes règles que la procédure qui calcule
 * le stock. Signale un stock enregistré qui ne correspond plus aux mouvements.
 */
export default function FicheStockPanel({ articleId }: { articleId: number }) {
  const toast = useToast();
  const { peut } = useDroits();
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [confirmer, setConfirmer] = useState(false);
  const { data, loading, error, refetch } = useQuery(FICHE_STOCK, {
    variables: { article_id: articleId, date_debut: debut || undefined, date_fin: fin || undefined },
    fetchPolicy: 'cache-and-network',
  });
  const [recalculer, { loading: enCours }] = useMutation(RECALCULER_STOCK_ARTICLE, {
    refetchQueries: [{ query: ARTICLE, variables: { id: articleId } }, { query: LOTS, variables: { article_id: articleId } }],
  });
  const f: Fiche | undefined = data?.ficheStock;
  const ecart = f ? Math.round((f.stock_calcule - f.article.stock_actuel) * 1000) / 1000 : 0;

  async function lancerRecalcul() {
    try {
      const { data: r } = await recalculer({ variables: { article_id: articleId } });
      const res = r?.recalculerStockArticle;
      toast.success(`Stock recalculé : ${fmtQte(res?.avant)} → ${fmtQte(res?.apres)}.`);
      setConfirmer(false);
      void refetch();
    } catch (e: any) {
      setConfirmer(false);
      toast.error(e.message ?? 'Recalcul impossible.');
    }
  }

  const colonnes: Column<Mouvement>[] = [
    { key: 'date', header: 'Date', width: '95px', render: (m) => (m.date ? fmtDate(m.date) : '—') },
    { key: 'nature', header: 'Mouvement', width: '160px', render: (m) => <span className="font-semibold text-ink-label">{m.nature}</span> },
    { key: 'numero', header: 'N°', width: '120px', render: (m) => {
      const lien = lienPiece(m);
      return lien ? <Link to={lien} className="money text-brand-text hover:underline" onClick={(e) => e.stopPropagation()}>{m.numero ?? m.piece_id}</Link>
        : <span className="money">{m.numero ?? '—'}</span>;
    } },
    { key: 'tiers', header: 'Tiers / motif', render: (m) => <span>{m.tiers?.trim() || '—'}</span> },
    { key: 'lot', header: 'Lot', width: '100px', render: (m) => <span className="money text-ink-muted">{m.lot || ''}</span> },
    { key: 'entree', header: 'Entrée', align: 'right', width: '85px', render: (m) => (m.entree ? <span className="money" style={{ color: 'var(--success-text)' }}>+{fmtQte(m.entree)}</span> : null) },
    { key: 'sortie', header: 'Sortie', align: 'right', width: '85px', render: (m) => (m.sortie ? <span className="money" style={{ color: 'var(--danger-text)' }}>−{fmtQte(m.sortie)}</span> : null) },
    { key: 'stock', header: 'Stock', align: 'right', width: '85px', render: (m) => <span className="money font-bold" style={{ color: m.stock < 0 ? 'var(--danger-text)' : undefined }}>{fmtQte(m.stock)}</span> },
  ];

  return (
    <div className="flex flex-col gap-2">
      {f && (
        <Card padding="sm" className="grid grid-cols-5 gap-4 text-sm px-4">
          <Info label={debut ? 'Stock au début de la période' : 'Point de départ'}>
            <span className="money font-bold">{fmtQte(f.ouverture)}</span>
            <div className="text-xs text-ink-muted">{f.depart.libelle}{f.depart.date ? ` · ${fmtDate(f.depart.date)}` : ''}</div>
          </Info>
          <Info label="Entrées"><span className="money font-bold" style={{ color: 'var(--success-text)' }}>+{fmtQte(f.total_entrees)}</span></Info>
          <Info label="Sorties"><span className="money font-bold" style={{ color: 'var(--danger-text)' }}>−{fmtQte(f.total_sorties)}</span></Info>
          <Info label="Stock selon les mouvements"><span className="money font-extrabold text-md">{fmtQte(f.stock_calcule)}</span></Info>
          <Info label="Stock enregistré">
            <span className="money font-extrabold text-md" style={{ color: ecart ? 'var(--warning-text)' : undefined }}>{fmtQte(f.article.stock_actuel)}</span>
            {ecart !== 0 && <div className="text-xs font-semibold" style={{ color: 'var(--warning-text)' }}>écart {ecart > 0 ? '+' : ''}{fmtQte(ecart)}</div>}
          </Info>
        </Card>
      )}
      {f && ecart !== 0 && (
        <Alert tone="warning" compact
               action={peut('stock', D.stock.modifierArticle) && (
                 <Button size="sm" variant="primary" icon="refresh" onClick={() => setConfirmer(true)}>Recalculer le stock</Button>
               )}>
          Le stock enregistré ({fmtQte(f.article.stock_actuel)}) ne correspond pas aux mouvements ({fmtQte(f.stock_calcule)}) :
          il n&apos;a pas été recalculé depuis certaines opérations.
        </Alert>
      )}
      <DataGrid<Mouvement>
        complet
        titre="Fiche de stock"
        actions={(
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-label">
            Du <TextInput type="date" size="sm" value={debut} onChange={(e) => setDebut(e.target.value)} aria-label="Du" className="!w-auto" />
            au <TextInput type="date" size="sm" value={fin} onChange={(e) => setFin(e.target.value)} aria-label="Au" className="!w-auto" />
            {(debut || fin) && <Button variant="link" size="sm" onClick={() => { setDebut(''); setFin(''); }}>Tout</Button>}
          </span>
        )}
        columns={colonnes}
        rows={f?.lignes}
        rowKey={(m, i) => `${m.origine}-${m.piece_id}-${i}`}
        loading={loading && !f}
        error={error?.message}
        emptyMessage="Aucun mouvement depuis le point de départ."
        exportCsv={{
          nom: `fiche-stock-${f?.article.code ?? articleId}`,
          columns: [
            { header: 'Date', value: (m) => (m.date ? fmtDate(m.date) : '') },
            { header: 'Mouvement', value: (m) => m.nature },
            { header: 'N°', value: (m) => m.numero ?? '' },
            { header: 'Tiers / motif', value: (m) => m.tiers?.trim() ?? '' },
            { header: 'Lot', value: (m) => m.lot ?? '' },
            { header: 'Entrée', value: (m) => m.entree, numeric: true },
            { header: 'Sortie', value: (m) => m.sortie, numeric: true },
            { header: 'Stock', value: (m) => m.stock, numeric: true },
          ],
        }}
        footer={f ? { _label: `${f.lignes.length} mouvement(s)`, entree: <span className="money">+{fmtQte(f.total_entrees)}</span>, sortie: <span className="money">−{fmtQte(f.total_sorties)}</span> } : undefined}
        cleEtat="fiche-stock"
      />
      {confirmer && f && (
        <ConfirmDialog
          title="Recalculer le stock de l'article ?"
          message={<>Le stock sera recalculé à partir de ses mouvements (procédure standard, lots compris) : {fmtQte(f.article.stock_actuel)} → {fmtQte(f.stock_calcule)}.</>}
          confirmLabel="Recalculer" loading={enCours}
          onConfirm={() => void lancerRecalcul()} onCancel={() => setConfirmer(false)}
        />
      )}
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-2xs font-bold uppercase tracking-wide text-ink-muted mb-0.5">{label}</div>
      <div>{children}</div>
    </div>
  );
}
