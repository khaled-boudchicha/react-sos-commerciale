import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { JOURNAL_VENTES, JOURNAL_ACHATS } from '../api/queries';
import { fmtDate, fmtMoney, fmtQte, isoFirstOfMonth, isoToday } from '../lib/format';
import DataGrid, { Column } from '../components/ui/DataGrid';
import { PeriodPicker, Pagination, SearchInput } from '../components/ui/atoms';

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
  const [offset, setOffset] = useState(0);
  const LIMIT = 100;

  const vente = sens === 'vente';
  const { data, loading, error } = useQuery(vente ? JOURNAL_VENTES : JOURNAL_ACHATS, {
    variables: { date_debut: debut, date_fin: fin, code_article: article || undefined, limit: LIMIT, offset },
  });
  const res = (vente ? data?.journalVentes : data?.journalAchats) as
    { lignes: LigneJournal[]; total: number; total_ttc: number; total_marge?: number } | undefined;
  const lignes = res?.lignes ?? [];

  const colonnes: Column<LigneJournal>[] = [
    { key: 'date', header: 'Date', width: '90px', render: (l) => fmtDate(l.date) },
    { key: 'numero', header: 'Pièce', width: '120px', render: (l) => <span className="money">{l.numero}</span> },
    { key: 'tiers', header: vente ? 'Client' : 'Fournisseur',
      render: (l) => <span>{l.raison ?? l.fournisseur ?? l.code_cli ?? l.code_four ?? '—'}</span> },
    { key: 'code_article', header: 'Code', width: '100px', render: (l) => <span className="money">{l.code_article}</span> },
    { key: 'designation', header: 'Désignation', render: (l) => <b>{l.designation}</b> },
    { key: 'n_lot', header: 'Lot', width: '90px', render: (l) => <span className="text-ink-muted money text-[11px]">{l.n_lot ?? '—'}</span> },
    { key: 'qte', header: 'Qté', align: 'right', width: '70px', render: (l) => <span className="money">{fmtQte(l.qte)}</span> },
    { key: 'prix_ht', header: 'P.U. HT', align: 'right', width: '100px', render: (l) => <span className="money">{fmtMoney(l.prix_ht)}</span> },
    { key: 'total_ttc', header: 'Total TTC', align: 'right', width: '115px',
      render: (l) => <span className="money font-semibold">{fmtMoney(l.total_ttc)}</span> },
    ...(vente ? [{
      key: 'total_marge', header: 'Marge', align: 'right' as const, width: '110px',
      render: (l: LigneJournal) => (
        <span className="money" style={{ color: Number(l.total_marge) < 0 ? 'var(--danger)' : 'var(--success)' }}>
          {fmtMoney(l.total_marge)}
        </span>
      ),
    }] : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <PeriodPicker debut={debut} fin={fin} onChange={(d, f) => { setDebut(d); setFin(f); setOffset(0); }} />
        <SearchInput value={article} onChange={(v) => { setArticle(v); setOffset(0); }} placeholder="Filtrer par code article…" />
      </div>
      <DataGrid columns={colonnes} rows={lignes} rowKey={(l, i) => l.id ?? i}
                loading={loading} error={error?.message}
                emptyMessage="Aucune ligne sur la période."
                footer={{
                  _label: `${res?.total ?? 0} ligne(s)`,
                  total_ttc: <span className="money">{fmtMoney(res?.total_ttc)}</span>,
                  ...(vente ? { total_marge: <span className="money">{fmtMoney(res?.total_marge)}</span> } : {}),
                }} />
      {res && res.total > LIMIT && <Pagination offset={offset} limit={LIMIT} total={res.total} onOffset={setOffset} />}
    </div>
  );
}
