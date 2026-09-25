import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { COORDONNEES_SOCIETE, ETAT_104 } from '../api/queries';
import { fmtMoney } from '../lib/format';
import { exporterCsv, ExportColumn } from '../lib/export';
import DataGrid, { Column } from './ui/DataGrid';
import { ExportBtn } from './ui/atoms';
import PrintPreview from '../print/engine/PrintPreview';
import { PrintDocument } from '../print/engine/types';
import { buildEtat104Print, Etat104Ligne } from '../print/templates';

const CSV: ExportColumn<Etat104Ligne>[] = [
  { header: 'Code', value: (r) => r.code_cli },
  { header: 'Client', value: (r) => r.raison },
  { header: 'Adresse', value: (r) => r.adresse },
  { header: 'RC', value: (r) => r.rc },
  { header: 'NIF', value: (r) => r.nif },
  { header: 'NIS', value: (r) => r.nis },
  { header: 'Art. imposition', value: (r) => r.art },
  { header: 'Montant HT', value: (r) => r.montant_ht, numeric: true },
  { header: 'TVA', value: (r) => r.tva, numeric: true },
  { header: 'Montant TTC', value: (r) => r.montant_ttc, numeric: true },
];

/** État 104 : chiffre d'affaires annuel par client avec identifiants fiscaux (déclaration). */
export default function Etat104Panel() {
  const anneeCourante = new Date().getFullYear();
  const [annee, setAnnee] = useState(anneeCourante);
  const [inclureBl, setInclureBl] = useState(false);
  const [printDoc, setPrintDoc] = useState<PrintDocument | null>(null);
  const { data, loading, error } = useQuery(ETAT_104, { variables: { annee, inclure_bl: inclureBl } });
  const { data: socData } = useQuery(COORDONNEES_SOCIETE);
  const res = data?.etat104;
  const rows: Etat104Ligne[] = res?.data ?? [];

  const columns: Column<Etat104Ligne>[] = [
    { key: 'client', header: 'Client', render: (r) => <span><b>{r.raison}</b> <span className="money text-ink-muted text-[10.5px]">{r.code_cli}</span></span>,
      sortAccessor: (r) => r.raison },
    { key: 'rc', header: 'RC', width: '110px', render: (r) => <span className="money text-[11px]">{r.rc || '—'}</span> },
    { key: 'nif', header: 'NIF', width: '130px', render: (r) => (
      <span className="money text-[11px]" style={{ color: r.incomplet ? 'var(--danger)' : undefined }}>{r.nif || 'manquant'}</span>
    ) },
    { key: 'nis', header: 'NIS', width: '130px', render: (r) => <span className="money text-[11px]">{r.nis || '—'}</span> },
    { key: 'ht', header: 'Montant HT', align: 'right', width: '120px', render: (r) => <span className="money">{fmtMoney(r.montant_ht)}</span>, sortAccessor: (r) => r.montant_ht },
    { key: 'tva', header: 'TVA', align: 'right', width: '100px', render: (r) => <span className="money">{fmtMoney(r.tva)}</span>, sortAccessor: (r) => r.tva },
    { key: 'ttc', header: 'Montant TTC', align: 'right', width: '130px', render: (r) => <b className="money">{fmtMoney(r.montant_ttc)}</b>, sortAccessor: (r) => r.montant_ttc },
  ];

  const t = res?.totaux;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-3 flex-wrap">
        <label className="text-[11px] font-bold text-ink-label">Exercice
          <select value={annee} onChange={(e) => setAnnee(Number(e.target.value))}
                  className="mt-1 block border border-line rounded-sm px-3 py-1.5 bg-surface text-ink font-normal">
            {[0, 1, 2, 3, 4].map((d) => <option key={d} value={anneeCourante - d}>{anneeCourante - d}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[12px] text-ink-label pb-2">
          <input type="checkbox" checked={inclureBl} onChange={(e) => setInclureBl(e.target.checked)} />
          Inclure les bons de livraison non facturés
        </label>
        <div className="ml-auto flex gap-2">
          <button disabled={!res}
                  onClick={() => res && setPrintDoc(buildEtat104Print(
                    { rows, totaux: res.totaux, debut: res.debut, fin: res.fin, inclureBl },
                    (socData?.coordonneesSociete ?? {}) as Record<string, unknown>))}
                  className="rounded-md px-3 py-1.5 font-bold text-[12px] border border-line text-ink-label disabled:opacity-60">
            Imprimer
          </button>
          <ExportBtn disabled={!rows.length} onClick={() => exporterCsv(`etat-104-${annee}`, CSV, rows)} />
        </div>
      </div>
      {t && t.incomplets > 0 && (
        <div className="text-[12px] rounded-md px-3 py-2"
             style={{ background: 'color-mix(in srgb, var(--warning) 12%, transparent)', color: 'var(--warning)' }}>
          {t.incomplets} client(s) sans NIF : complétez leur fiche avant de déposer la déclaration.
        </div>
      )}
      {printDoc && <PrintPreview doc={printDoc} onClose={() => setPrintDoc(null)} />}
      <DataGrid columns={columns} rows={rows} rowKey={(r) => r.code_cli || r.raison} loading={loading} error={error?.message}
                emptyMessage={inclureBl ? 'Aucune vente sur l’exercice.' : 'Aucune facture sur l’exercice — cochez « Inclure les bons de livraison » si vous facturez sur BL.'}
                footer={t ? { _label: `${t.nb_clients} client(s)`, ht: <span className="money">{fmtMoney(t.montant_ht)}</span>,
                              tva: <span className="money">{fmtMoney(t.tva)}</span>, ttc: <b className="money">{fmtMoney(t.montant_ttc)}</b> } : undefined} />
    </div>
  );
}
