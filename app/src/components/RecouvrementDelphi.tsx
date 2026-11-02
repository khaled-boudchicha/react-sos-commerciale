import { useMemo, useState } from 'react';
import { useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { RECOUVREMENT_DELPHI } from '../api/queries';
import { fmtDate, fmtMoney } from '../lib/format';
import { exporterCsv, ExportColumn } from '../lib/export';
import DataGrid, { Column } from './ui/DataGrid';
import { ExportBtn, Toolbar } from './ui/atoms';
import { Field, SegmentedControl, TextInput } from './ui/Field';
import { KpiTile } from './ui/Kpi';

type Resume = {
  code_cli: string; raison: string; nb_pieces: number;
  net_a_payer: number; reste_a_payer: number; regler: number;
  plus_ancienne?: string | null; derniere?: string | null;
};
type Piece = {
  code: string; operation: string; date_piece?: string | null; code_cli: string; raison: string;
  net_a_payer: number; reste_a_payer: number; regler: number;
};
type Reponse<T> = { data: T[]; total: number; totaux: { net_a_payer: number; reste_a_payer: number; regler: number } };

const CSV_RESUME: ExportColumn<Resume>[] = [
  { header: 'Code', value: (r) => r.code_cli },
  { header: 'Client', value: (r) => r.raison },
  { header: 'Pièces', value: (r) => r.nb_pieces, numeric: true },
  { header: 'Plus ancienne', value: (r) => fmtDate(r.plus_ancienne) },
  { header: 'Dernière', value: (r) => fmtDate(r.derniere) },
  { header: 'Net à payer', value: (r) => r.net_a_payer, numeric: true },
  { header: 'Réglé', value: (r) => r.regler, numeric: true },
  { header: 'Reste à payer', value: (r) => r.reste_a_payer, numeric: true },
];
const CSV_DETAIL: ExportColumn<Piece>[] = [
  { header: 'Pièce', value: (r) => r.code },
  { header: 'Opération', value: (r) => r.operation },
  { header: 'Date', value: (r) => fmtDate(r.date_piece) },
  { header: 'Code client', value: (r) => r.code_cli },
  { header: 'Client', value: (r) => r.raison },
  { header: 'Net à payer', value: (r) => r.net_a_payer, numeric: true },
  { header: 'Réglé', value: (r) => r.regler, numeric: true },
  { header: 'Reste à payer', value: (r) => r.reste_a_payer, numeric: true },
];

/**
 * Recouvrement tel que le logiciel de bureau l'affiche (RecouverementForm.pas) : seules les factures et les BL
 * dont le reste à payer est positif comptent ; le crédit initial, les avoirs et les pièces trop payées n'entrent
 * pas. Un client apparaît si sa pièce impayée la plus récente a plus de N jours et date de l'année choisie.
 * Les montants diffèrent donc du « solde client » de l'autre mode.
 */
export default function RecouvrementDelphi({ search }: { search: string }) {
  const navigate = useNavigate();
  const [nbrjour, setNbrjour] = useState(30);
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [vue, setVue] = useState<'resume' | 'detail'>('resume');
  const detail = vue === 'detail';
  const { data, loading, error } = useQuery(RECOUVREMENT_DELPHI, {
    variables: { nbrjour, annee, detail }, fetchPolicy: 'network-only',
  });
  const rep = (data?.recouvrement ?? null) as Reponse<Resume | Piece> | null;
  // Recherche locale : la liste est chargée en entier (comme dans le Delphi)
  const lignes = useMemo(() => {
    const q = search.trim().toLowerCase();
    const toutes = rep?.data ?? [];
    return q ? toutes.filter((r) => `${r.raison} ${r.code_cli}`.toLowerCase().includes(q)) : toutes;
  }, [rep, search]);
  const tot = useMemo(() => ({
    reste: lignes.reduce((s, r) => s + (r.reste_a_payer || 0), 0),
    net: lignes.reduce((s, r) => s + (r.net_a_payer || 0), 0),
    regle: lignes.reduce((s, r) => s + (r.regler || 0), 0),
  }), [lignes]);

  const montant = (v: number) => <span className="money">{fmtMoney(v)}</span>;
  const colsResume: Column<Resume>[] = [
    { key: 'client', header: 'Client', sortAccessor: (r) => r.raison, render: (r) => <span><b>{r.raison}</b> <span className="money text-ink-muted text-xs">{r.code_cli}</span></span> },
    { key: 'nb', header: 'Pièces', align: 'right', width: '80px', sortAccessor: (r) => r.nb_pieces, render: (r) => <span className="money">{r.nb_pieces}</span> },
    { key: 'anc', header: 'Plus ancienne', align: 'right', width: '120px', sortAccessor: (r) => r.plus_ancienne ?? '', render: (r) => <span className="money">{fmtDate(r.plus_ancienne)}</span> },
    { key: 'der', header: 'Dernière', align: 'right', width: '120px', sortAccessor: (r) => r.derniere ?? '', render: (r) => <span className="money">{fmtDate(r.derniere)}</span> },
    { key: 'net', header: 'Net à payer', align: 'right', width: '130px', sortAccessor: (r) => r.net_a_payer, render: (r) => montant(r.net_a_payer) },
    { key: 'reg', header: 'Réglé', align: 'right', width: '130px', sortAccessor: (r) => r.regler, render: (r) => montant(r.regler) },
    { key: 'reste', header: 'Reste à payer', align: 'right', width: '140px', sortAccessor: (r) => r.reste_a_payer, render: (r) => <span className="money font-semibold">{fmtMoney(r.reste_a_payer)}</span> },
  ];
  const colsDetail: Column<Piece>[] = [
    { key: 'piece', header: 'Pièce', width: '170px', sortAccessor: (r) => r.code, render: (r) => <span className="money">{r.code}</span> },
    { key: 'op', header: 'Opération', width: '150px', sortAccessor: (r) => r.operation, render: (r) => r.operation },
    { key: 'date', header: 'Date', align: 'right', width: '110px', sortAccessor: (r) => r.date_piece ?? '', render: (r) => <span className="money">{fmtDate(r.date_piece)}</span> },
    { key: 'client', header: 'Client', sortAccessor: (r) => r.raison, render: (r) => <span><b>{r.raison}</b> <span className="money text-ink-muted text-xs">{r.code_cli}</span></span> },
    { key: 'net', header: 'Net à payer', align: 'right', width: '130px', sortAccessor: (r) => r.net_a_payer, render: (r) => montant(r.net_a_payer) },
    { key: 'reg', header: 'Réglé', align: 'right', width: '130px', sortAccessor: (r) => r.regler, render: (r) => montant(r.regler) },
    { key: 'reste', header: 'Reste à payer', align: 'right', width: '140px', sortAccessor: (r) => r.reste_a_payer, render: (r) => <span className="money font-semibold">{fmtMoney(r.reste_a_payer)}</span> },
  ];
  const ouvrirClient = (r: { code_cli: string }) => navigate(`/tiers/client/${encodeURIComponent(r.code_cli)}`);
  const vide = 'Aucune pièce impayée pour ce critère.';

  return (
    <>
      <Toolbar className="items-end">
        <Field label="Retard supérieur à (jours)" className="w-44">
          <TextInput type="number" min={0} value={nbrjour} mono align="right"
                     onChange={(e) => setNbrjour(Math.max(0, Number(e.target.value) || 0))} />
        </Field>
        <Field label="Année" className="w-28">
          <TextInput type="number" min={2000} max={2100} value={annee} mono align="right"
                     onChange={(e) => setAnnee(Math.trunc(Number(e.target.value)) || new Date().getFullYear())} />
        </Field>
        <SegmentedControl label="Présentation" value={vue} onChange={setVue}
                          options={[{ value: 'resume', label: 'Par client' }, { value: 'detail', label: 'Par pièce' }]} />
        <div className="ml-auto">
          <ExportBtn loading={loading}
                     onClick={() => (detail
                       ? exporterCsv('recouvrement-delphi-pieces', CSV_DETAIL, lignes as Piece[])
                       : exporterCsv('recouvrement-delphi-clients', CSV_RESUME, lignes as Resume[]))} />
        </div>
      </Toolbar>
      <div className="grid grid-cols-4 gap-3">
        <KpiTile size="sm" label="Reste à payer" value={fmtMoney(tot.reste)} valueTone="danger"
                 sub={detail ? `${lignes.length} pièce(s)` : `${lignes.length} client(s)`} />
        <KpiTile size="sm" label="Net à payer" value={fmtMoney(tot.net)} />
        <KpiTile size="sm" label="Déjà réglé" value={fmtMoney(tot.regle)} />
        <KpiTile size="sm" label="Calcul" value="Comme le logiciel de bureau"
                 sub="Factures et BL impayés seulement ; ni crédit initial ni avoirs" />
      </div>
      {detail ? (
        <DataGrid<Piece> columns={colsDetail} rows={lignes as Piece[]} loading={loading} error={error?.message}
                         rowKey={(r, i) => `${r.code}-${i}`} emptyMessage={vide} onRowClick={ouvrirClient}
                         cleEtat="recouvrement-delphi-pieces" />
      ) : (
        <DataGrid<Resume> columns={colsResume} rows={lignes as Resume[]} loading={loading} error={error?.message}
                          rowKey={(r) => r.code_cli} emptyMessage={vide} onRowClick={ouvrirClient}
                          cleEtat="recouvrement-delphi-clients" />
      )}
    </>
  );
}
