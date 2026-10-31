import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { TRANSFERT_STOCK, REFERENTIELS } from '../api/queries';
import { Article } from '../api/types';
import { fmtQte, isoToday } from '../lib/format';
import { useSession } from '../store/session';
import ArticleSearch from './ArticleSearch';
import { nomDepot } from './BonStockModal';
import { useToast } from './ui/Toast';
import Dialog from './ui/Dialog';
import { Button, IconButton } from './ui/Button';
import { Field, Select, TextInput } from './ui/Field';
import { Alert, EmptyState } from './ui/States';
import { Badge } from './ui/atoms';

type LigneSaisie = { article: Article; qte: string };

/**
 * Transfert de marchandise d'un dépôt à un autre. Côté serveur, il produit un
 * bon de sortie (dépôt source) et un bon d'entrée (dépôt destination) liés par
 * un même code : supprimer l'un supprime l'autre.
 */
export default function TransfertStockModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const user = useSession((s) => s.dossierUser);
  const toast = useToast();
  const [date, setDate] = useState(isoToday());
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [observation, setObservation] = useState('');
  const [lignes, setLignes] = useState<LigneSaisie[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: refs } = useQuery(REFERENTIELS);
  const depots: any[] = Array.isArray(refs?.depots) ? refs.depots : [];
  // Sans dépôt paramétré, on laisse la saisie libre (dossiers mono-dépôt anciens).
  const saisieLibre = depots.length === 0;
  const [transferer, { loading }] = useMutation(TRANSFERT_STOCK);

  function ajouter(a: Article) {
    setLignes((ls) => {
      const i = ls.findIndex((l) => l.article.id === a.id);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, qte: String((parseFloat(l.qte) || 0) + 1) } : l));
      return [...ls, { article: a, qte: '1' }];
    });
  }
  const maj = (i: number, qte: string) => setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, qte } : l)));
  const retirer = (i: number) => setLignes((ls) => ls.filter((_, j) => j !== i));
  const depassements = lignes.filter((l) => (parseFloat(l.qte) || 0) > Number(l.article.qte_reale ?? 0));

  // Résout le nom + l'id d'un dépôt à partir de la valeur du champ (id en mode liste, texte en saisie libre).
  function resoudre(v: string): { nom: string; id?: number } {
    if (saisieLibre) return { nom: v.trim() };
    const d = depots.find((x) => String(x.id) === v);
    return { nom: d ? nomDepot(d) : v, id: d?.id != null ? Number(d.id) : undefined };
  }

  async function valider() {
    setError(null);
    const src = resoudre(source);
    const dst = resoudre(destination);
    if (!src.nom || !dst.nom) { setError('Choisissez les dépôts source et destination.'); return; }
    if (src.nom === dst.nom) { setError('Les deux dépôts doivent être différents.'); return; }
    if (lignes.length === 0) { setError('Ajoutez au moins un article.'); return; }
    if (lignes.some((l) => !(parseFloat(l.qte) > 0))) { setError('Toutes les quantités doivent être positives.'); return; }
    try {
      const { data } = await transferer({ variables: { input: {
        date,
        depot_source: src.nom, depot_destination: dst.nom,
        depot_source_id: src.id, depot_destination_id: dst.id,
        observation: observation || undefined,
        agent: user?.username,
        lignes: lignes.map((l) => ({ id_article: l.article.id, qte: parseFloat(l.qte) })),
      } } });
      toast.success(`Transfert ${data?.transfertStock?.code ?? ''} enregistré.`);
      onDone();
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Erreur.');
    }
  }

  function champDepot(value: string, onChange: (v: string) => void, exclure?: string) {
    if (saisieLibre) {
      return <TextInput value={value} onChange={(e) => onChange(e.target.value)} placeholder="Nom du dépôt" />;
    }
    return (
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— choisir —</option>
        {depots.filter((d) => String(d?.id) !== exclure).map((d, i) => (
          <option key={d?.id ?? i} value={String(d?.id ?? '')}>{nomDepot(d)}</option>
        ))}
      </Select>
    );
  }

  return (
    <Dialog title="Nouveau transfert entre dépôts" subtitle="Génère un bon de sortie et un bon d'entrée liés"
            icon="movements" width={760} onClose={onClose} closeOnOverlay={false} closeOnEscape={false}
            footer={(
              <>
                <Button onClick={onClose} disabled={loading}>Annuler</Button>
                <Button variant="primary" icon="check" onClick={() => void valider()} disabled={lignes.length === 0} loading={loading}>
                  {loading ? 'Enregistrement…' : 'Valider le transfert'}
                </Button>
              </>
            )}>
      <div className="flex flex-col gap-3.5">
        {error && <Alert tone="danger">{error}</Alert>}

        <div className="grid grid-cols-12 gap-3">
          <Field label="Date" required span={3}>
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Dépôt source" required span={4}>
            {champDepot(source, setSource)}
          </Field>
          <Field label="Dépôt destination" required span={5}>
            {champDepot(destination, setDestination, saisieLibre ? undefined : source)}
          </Field>
          <Field label="Observation" span={12}>
            <TextInput value={observation} onChange={(e) => setObservation(e.target.value)} />
          </Field>
        </div>

        <ArticleSearch onSelect={ajouter} autoFocus />

        <div className="border border-line-soft rounded-md overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {['Article', 'Stock actuel', 'Quantité', ''].map((h, i) => (
                  <th key={i} className={`text-2xs font-bold uppercase tracking-wider text-ink-muted bg-sunken border-b border-line-soft px-3 py-2 ${i === 1 || i === 2 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignes.length === 0 && (
                <tr><td colSpan={4}>
                  <EmptyState size="sm" icon="package" title="Aucun article" description="Recherchez un article pour l'ajouter." />
                </td></tr>
              )}
              {lignes.map((l, i) => {
                const stock = Number(l.article.qte_reale ?? 0);
                const insuffisant = (parseFloat(l.qte) || 0) > stock;
                return (
                  <tr key={l.article.id} className="border-b border-line-soft last:border-b-0">
                    <td className="px-3 py-1">
                      <b>{l.article.designation}</b>
                      <span className="block money text-xs text-ink-muted">{l.article.code}{l.article.depot ? ` · ${l.article.depot}` : ''}</span>
                    </td>
                    <td className="px-3 py-1 text-right">
                      {insuffisant
                        ? <Badge tone="danger" shape="square" icon="alert" className="money" title="Stock insuffisant">{fmtQte(stock)}</Badge>
                        : <span className="money text-ink-muted">{fmtQte(stock)}</span>}
                    </td>
                    <td className="w-[120px] px-2 py-1">
                      <TextInput type="number" step="any" min="0" value={l.qte} onChange={(e) => maj(i, e.target.value)}
                                 size="sm" mono align="right" invalid={insuffisant}
                                 aria-label={`Quantité ${l.article.code}`} />
                    </td>
                    <td className="w-[40px] px-2 text-right">
                      <IconButton icon="trash" label="Retirer" tone="danger" size="xs" onClick={() => retirer(i)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {depassements.length > 0 && (
          <Alert tone="warning" compact>
            Quantité supérieure au stock pour {depassements.length} article(s) : le transfert risque d'être refusé.
          </Alert>
        )}
      </div>
    </Dialog>
  );
}
