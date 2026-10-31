import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { CREATE_BON_ENTREE, CREATE_BON_SORTIE, REFERENTIELS } from '../api/queries';
import { Article } from '../api/types';
import { fmtQte, isoToday } from '../lib/format';
import { useSession } from '../store/session';
import ArticleSearch from './ArticleSearch';
import { useToast } from './ui/Toast';
import Dialog from './ui/Dialog';
import { Button, IconButton } from './ui/Button';
import { Field, Select, TextInput } from './ui/Field';
import { Alert, EmptyState } from './ui/States';
import { Badge, Money } from './ui/atoms';

export type SensBon = 'entree' | 'sortie';

/** Ligne en cours de saisie (valeurs texte tant que l'utilisateur tape). */
type LigneSaisie = { article: Article; qte: string; prix: string };

/** Nom affichable d'un dépôt de REFERENTIELS ({id, code, designation}, forme variable selon l'agent). */
export function nomDepot(d: any): string {
  return String(d?.designation ?? d?.nom ?? d?.depot ?? d?.code ?? d?.name ?? d ?? '');
}

/** Coût unitaire par défaut d'une entrée : PMP, sinon dernier prix d'achat. */
function coutDefaut(a: Article): number {
  const pmp = Number(a.pmp ?? 0);
  return pmp > 0 ? pmp : Number(a.prix_achat_ht ?? 0);
}

/**
 * Saisie d'un bon d'entrée (réception hors achat, retour, production…) ou d'un
 * bon de sortie (casse, consommation interne…). Le stock est recalculé côté
 * serveur ; une sortie est refusée si le stock est insuffisant.
 */
export default function BonStockModal({ sens, onClose, onDone }: {
  sens: SensBon; onClose: () => void; onDone: () => void;
}) {
  const user = useSession((s) => s.dossierUser);
  const toast = useToast();
  const [date, setDate] = useState(isoToday());
  const [depotId, setDepotId] = useState('');
  const [motif, setMotif] = useState('');
  const [observation, setObservation] = useState('');
  const [lignes, setLignes] = useState<LigneSaisie[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: refs } = useQuery(REFERENTIELS);
  const depots: any[] = Array.isArray(refs?.depots) ? refs.depots : [];
  const [creer, { loading }] = useMutation(sens === 'entree' ? CREATE_BON_ENTREE : CREATE_BON_SORTIE);

  const entree = sens === 'entree';
  const titre = entree ? "Nouveau bon d'entrée" : 'Nouveau bon de sortie';

  function ajouter(a: Article) {
    setLignes((ls) => {
      // Article déjà présent : on incrémente plutôt que dupliquer (cas du scan répété).
      const i = ls.findIndex((l) => l.article.id === a.id);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, qte: String((parseFloat(l.qte) || 0) + 1) } : l));
      return [...ls, { article: a, qte: '1', prix: String(coutDefaut(a)) }];
    });
  }
  const maj = (i: number, patch: Partial<LigneSaisie>) => setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const retirer = (i: number) => setLignes((ls) => ls.filter((_, j) => j !== i));

  const total = lignes.reduce((s, l) => s + (parseFloat(l.qte) || 0) * (entree ? (parseFloat(l.prix) || 0) : coutDefaut(l.article)), 0);
  const depassements = entree ? [] : lignes.filter((l) => (parseFloat(l.qte) || 0) > Number(l.article.qte_reale ?? 0));

  async function valider() {
    setError(null);
    if (lignes.length === 0) { setError('Ajoutez au moins un article.'); return; }
    if (lignes.some((l) => !(parseFloat(l.qte) > 0))) { setError('Toutes les quantités doivent être positives.'); return; }
    const d = depots.find((x) => String(x.id) === depotId);
    try {
      const { data } = await creer({ variables: { input: {
        date,
        motif: motif || undefined,
        observation: observation || undefined,
        depot: d ? nomDepot(d) : undefined,
        depot_id: d?.id != null ? Number(d.id) : undefined,
        agent: user?.username,
        lignes: lignes.map((l) => ({
          id_article: l.article.id,
          qte: parseFloat(l.qte),
          // Sortie : le serveur valorise au PMP ; on ne force pas de prix.
          prix_unitaire: entree ? (parseFloat(l.prix) || 0) : undefined,
        })),
      } } });
      const bon = entree ? data?.createBonEntree : data?.createBonSortie;
      toast.success(`${entree ? "Bon d'entrée" : 'Bon de sortie'} ${bon?.numero ?? ''} enregistré.`);
      onDone();
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Erreur.');
    }
  }

  return (
    <Dialog title={titre} width={860} onClose={onClose} closeOnOverlay={false} closeOnEscape={false}
            icon={entree ? 'stockIn' : 'stockOut'} iconTone={entree ? 'success' : 'danger'}
            footer={(
              <>
                <Button onClick={onClose} disabled={loading}>Annuler</Button>
                <Button variant="primary" icon="save" onClick={() => void valider()} disabled={lignes.length === 0} loading={loading}>
                  {loading ? 'Enregistrement…' : 'Enregistrer le bon'}
                </Button>
              </>
            )}>
      <div className="flex flex-col gap-3.5">
        {error && <Alert tone="danger">{error}</Alert>}

        <div className="grid grid-cols-12 gap-3">
          <Field label="Date" required span={3}>
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Dépôt" span={4}>
            <Select value={depotId} onChange={(e) => setDepotId(e.target.value)}>
              <option value="">— défaut —</option>
              {depots.map((d, i) => <option key={d?.id ?? i} value={String(d?.id ?? '')}>{nomDepot(d)}</option>)}
            </Select>
          </Field>
          <Field label="Motif" span={5}>
            <TextInput value={motif} onChange={(e) => setMotif(e.target.value)}
                       placeholder={entree ? 'Réception, retour, production…' : 'Casse, consommation interne…'} />
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
                {['Article', 'Stock', 'Quantité', entree ? 'Coût unitaire' : 'PMP', 'Total', ''].map((h, i) => (
                  <th key={i} className={`text-2xs font-bold uppercase tracking-wider text-ink-muted bg-sunken border-b border-line-soft px-3 py-2 ${i >= 1 && i <= 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignes.length === 0 && (
                <tr><td colSpan={6}>
                  <EmptyState size="sm" icon="package" title="Aucun article" description="Recherchez un article pour l'ajouter." />
                </td></tr>
              )}
              {lignes.map((l, i) => {
                const q = parseFloat(l.qte) || 0;
                const stock = Number(l.article.qte_reale ?? 0);
                const insuffisant = !entree && q > stock;
                const pu = entree ? (parseFloat(l.prix) || 0) : coutDefaut(l.article);
                return (
                  <tr key={l.article.id} className="border-b border-line-soft last:border-b-0">
                    <td className="px-3 py-1">
                      <b>{l.article.designation}</b>
                      <span className="block money text-xs text-ink-muted">{l.article.code}{l.article.unite_mesure ? ` · ${l.article.unite_mesure}` : ''}</span>
                    </td>
                    <td className="px-3 py-1 text-right">
                      {insuffisant
                        ? <Badge tone="danger" shape="square" className="money">{fmtQte(stock)}</Badge>
                        : <span className="money text-ink-muted">{fmtQte(stock)}</span>}
                    </td>
                    <td className="w-[110px] px-2 py-1">
                      <TextInput type="number" step="any" min="0" value={l.qte} onChange={(e) => maj(i, { qte: e.target.value })}
                                 size="sm" mono align="right" invalid={insuffisant}
                                 aria-label={`Quantité ${l.article.code}`} />
                    </td>
                    <td className="w-[130px] px-2 py-1 text-right">
                      {entree ? (
                        <TextInput type="number" step="0.01" min="0" value={l.prix} onChange={(e) => maj(i, { prix: e.target.value })}
                                   size="sm" mono align="right" aria-label={`Coût unitaire ${l.article.code}`} />
                      ) : <Money value={pu} tone="muted" />}
                    </td>
                    <td className="px-3 py-1 text-right"><Money value={q * pu} className="font-semibold" /></td>
                    <td className="w-[40px] px-2 text-right">
                      <IconButton icon="trash" label="Retirer" tone="danger" size="xs" onClick={() => retirer(i)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {lignes.length > 0 && (
              <tbody>
                <tr className="bg-sunken font-bold">
                  <td className="px-3 py-2" colSpan={4}>{lignes.length} ligne(s)</td>
                  <td className="px-3 py-2 text-right"><Money value={total} className="font-bold" /></td>
                  <td />
                </tr>
              </tbody>
            )}
          </table>
        </div>

        {depassements.length > 0 && (
          <Alert tone="warning" compact>
            Stock insuffisant pour {depassements.length} article(s) : la sortie sera refusée par le serveur.
          </Alert>
        )}
      </div>
    </Dialog>
  );
}
