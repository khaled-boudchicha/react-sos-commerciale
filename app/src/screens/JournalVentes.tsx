import { useMemo, useState } from 'react';
import { useApolloClient, useQuery, useLazyQuery } from '@apollo/client';
import { JOURNAL_VENTES, JOURNAL_ACHATS, COORDONNEES_SOCIETE } from '../api/queries';
import { fmtDate, fmtMoney, fmtQte, isoFirstOfMonth, isoToday } from '../lib/format';
import DataGrid, { Column, DataGridDistant, totalDistant } from '../components/ui/DataGrid';
import ImprimerDocument from '../impression/ImprimerDocument';
import type { DemandeImpression } from '../impression/demandes';
import { demandeJournal } from '../impression/demandes';
import { PeriodPicker, SearchInput, Toolbar } from '../components/ui/atoms';
import { Button } from '../components/ui/Button';

type LigneJournal = Record<string, any> & { id: string };

/**
 * Journal des ventes ou des achats : vue **ligne à ligne** (une ligne = un
 * article vendu/acheté), à l'inverse de la liste des documents. Sert à retrouver
 * un article dans les pièces et à contrôler les marges.
 */
export default function Journal({ sens }: { sens: 'vente' | 'achat' }) {
  const [debut, setDebut] = useState(isoFirstOfMonth());
  const [fin, setFin] = useState(isoToday());
  const [article, setArticle] = useState('');

  const vente = sens === 'vente';
  const client = useApolloClient();
  const codeArticle = article || undefined;
  // Tri, filtres, recherche, pagination et groupes faits par le serveur
  const distant = useMemo<DataGridDistant<LigneJournal>>(() => ({
    cle: JSON.stringify([sens, debut, fin, codeArticle]),
    totaux: vente
      ? [{ field: 'total_ttc', type: 'sum' }, { field: 'total_marge', type: 'sum' }]
      : [{ field: 'total_ttc', type: 'sum' }],
    taillePage: 100,
    charger: async (grille) => {
      const { data } = await client.query({
        query: vente ? JOURNAL_VENTES : JOURNAL_ACHATS, fetchPolicy: 'network-only',
        variables: { date_debut: debut, date_fin: fin, code_article: codeArticle, grille },
      });
      return (vente ? data.journalVentes : data.journalAchats) as
        { data: LigneJournal[]; total: number; resumes?: Record<string, number | null> };
    },
  }), [client, sens, vente, debut, fin, codeArticle]);

  const { data: socData } = useQuery(COORDONNEES_SOCIETE);
  const [printDoc, setPrintDoc] = useState<DemandeImpression | null>(null);
  const [fetchAll, { loading: printing }] = useLazyQuery(vente ? JOURNAL_VENTES : JOURNAL_ACHATS, { fetchPolicy: 'network-only' });

  async function imprimerJournal() {
    const { data: all } = await fetchAll({ variables: { date_debut: debut, date_fin: fin, code_article: article || undefined, limit: 5000, offset: 0 } });
    const full = (vente ? all?.journalVentes : all?.journalAchats) as { lignes: LigneJournal[] } | undefined;
    setPrintDoc(demandeJournal(
      { sens, lignes: full?.lignes ?? [], debut, fin },
      (socData?.coordonneesSociete ?? {}) as Record<string, unknown>,
    ));
  }

  const colonnes: Column<LigneJournal>[] = [
    { key: 'date', header: 'Date', width: '90px', field: 'date', type: 'date', render: (l) => fmtDate(l.date) },
    { key: 'numero', header: 'Pièce', width: '120px', field: 'numero', render: (l) => <span className="money">{l.numero}</span> },
    { key: 'tiers', header: vente ? 'Client' : 'Fournisseur', field: vente ? 'raison' : 'fournisseur',
      render: (l) => <span>{l.raison ?? l.fournisseur ?? l.code_cli ?? l.code_four ?? '—'}</span> },
    { key: 'code_article', header: 'Code', width: '100px', field: 'code_article', render: (l) => <span className="money">{l.code_article}</span> },
    { key: 'designation', header: 'Désignation', field: 'designation', render: (l) => <b>{l.designation}</b> },
    { key: 'n_lot', header: 'Lot', width: '90px', field: 'n_lot', render: (l) => <span className="text-ink-muted money text-xs">{l.n_lot ?? '—'}</span> },
    { key: 'qte', header: 'Qté', align: 'right', width: '70px', field: 'qte', type: 'number', render: (l) => <span className="money">{fmtQte(l.qte)}</span> },
    { key: 'prix_ht', header: 'P.U. HT', align: 'right', width: '100px', field: 'prix_ht', render: (l) => <span className="money">{fmtMoney(l.prix_ht)}</span> },
    { key: 'total_ttc', header: 'Total TTC', align: 'right', width: '115px', field: 'total_ttc',
      render: (l) => <span className="money font-semibold">{fmtMoney(l.total_ttc)}</span> },
    ...(vente ? [{
      key: 'total_marge', header: 'Marge', align: 'right' as const, width: '110px', field: 'total_marge',
      render: (l: LigneJournal) => (
        <span className="money" style={{ color: Number(l.total_marge) < 0 ? 'var(--danger-text)' : 'var(--success-text)' }}>
          {fmtMoney(l.total_marge)}
        </span>
      ),
    }] : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      <Toolbar>
        <PeriodPicker debut={debut} fin={fin} onChange={(d, f) => { setDebut(d); setFin(f); }} />
        <SearchInput value={article} onChange={setArticle} placeholder="Filtrer par code article…" />
        <Button icon="printer" onClick={() => void imprimerJournal()} loading={printing} className="ml-auto">
          {printing ? 'Préparation…' : 'Imprimer le journal'}
        </Button>
      </Toolbar>
      {printDoc && <ImprimerDocument demande={printDoc} onClose={() => setPrintDoc(null)} />}
      <DataGrid columns={colonnes} rowKey={(l, i) => l.id ?? i}
                distant={distant} cleEtat={vente ? 'journal-ventes' : 'journal-achats'}
                emptyMessage="Aucune ligne sur la période."
                footer={(r) => ({
                  _label: `${r?.total ?? 0} ligne(s)`,
                  total_ttc: <span className="money">{fmtMoney(totalDistant(r, 'total_ttc'))}</span>,
                  ...(vente ? { total_marge: <span className="money">{fmtMoney(totalDistant(r, 'total_marge'))}</span> } : {}),
                })} />
    </div>
  );
}
