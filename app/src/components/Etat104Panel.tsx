import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { COORDONNEES_SOCIETE, ETAT_104 } from '../api/queries';
import { fmtMoney } from '../lib/format';
import { exporterCsv, ExportColumn } from '../lib/export';
import DataGrid, { Column } from './ui/DataGrid';
import { ExportBtn, Toolbar } from './ui/atoms';
import { Button } from './ui/Button';
import { Checkbox, Field, Select } from './ui/Field';
import { Alert } from './ui/States';
import ImprimerDocument from '../impression/ImprimerDocument';
import type { DemandeImpression } from '../impression/demandes';
import { demandeEtat104 } from '../impression/demandes';
import type { Etat104Ligne } from '../impression/donnees';

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
  const [printDoc, setPrintDoc] = useState<DemandeImpression | null>(null);
  const { data, loading, error } = useQuery(ETAT_104, { variables: { annee, inclure_bl: inclureBl } });
  const { data: socData } = useQuery(COORDONNEES_SOCIETE);
  const res = data?.etat104;
  const rows: Etat104Ligne[] = res?.data ?? [];

  const columns: Column<Etat104Ligne>[] = [
    { key: 'client', header: 'Client', render: (r) => <span><b>{r.raison}</b> <span className="money text-ink-muted text-xs">{r.code_cli}</span></span>,
      sortAccessor: (r) => r.raison },
    { key: 'rc', header: 'RC', width: '110px', render: (r) => <span className="money text-xs">{r.rc || '—'}</span> },
    { key: 'nif', header: 'NIF', width: '130px', render: (r) => (
      <span className="money text-xs" style={{ color: r.incomplet ? 'var(--danger-text)' : undefined }}>{r.nif || 'manquant'}</span>
    ) },
    { key: 'nis', header: 'NIS', width: '130px', render: (r) => <span className="money text-xs">{r.nis || '—'}</span> },
    { key: 'ht', header: 'Montant HT', align: 'right', width: '120px', render: (r) => <span className="money">{fmtMoney(r.montant_ht)}</span>, sortAccessor: (r) => r.montant_ht },
    { key: 'tva', header: 'TVA', align: 'right', width: '100px', render: (r) => <span className="money">{fmtMoney(r.tva)}</span>, sortAccessor: (r) => r.tva },
    { key: 'ttc', header: 'Montant TTC', align: 'right', width: '130px', render: (r) => <b className="money">{fmtMoney(r.montant_ttc)}</b>, sortAccessor: (r) => r.montant_ttc },
  ];

  const t = res?.totaux;
  return (
    <div className="flex flex-col gap-3">
      <Toolbar className="items-end">
        <Field label="Exercice" className="w-32">
          <Select value={annee} onChange={(e) => setAnnee(Number(e.target.value))}>
            {[0, 1, 2, 3, 4].map((d) => <option key={d} value={anneeCourante - d}>{anneeCourante - d}</option>)}
          </Select>
        </Field>
        <Checkbox className="pb-2" label="Inclure les bons de livraison non facturés"
                  checked={inclureBl} onChange={(e) => setInclureBl(e.target.checked)} />
        <div className="ml-auto flex gap-2">
          <Button icon="printer" disabled={!res}
                  onClick={() => res && setPrintDoc(demandeEtat104(
                    { rows, totaux: res.totaux, debut: res.debut, fin: res.fin, inclureBl },
                    (socData?.coordonneesSociete ?? {}) as Record<string, unknown>))}>
            Imprimer
          </Button>
          <ExportBtn disabled={!rows.length} onClick={() => exporterCsv(`etat-104-${annee}`, CSV, rows)} />
        </div>
      </Toolbar>
      {t && t.incomplets > 0 && (
        <Alert tone="warning" compact>
          {t.incomplets} client(s) sans NIF : complétez leur fiche avant de déposer la déclaration.
        </Alert>
      )}
      {printDoc && <ImprimerDocument demande={printDoc} onClose={() => setPrintDoc(null)} />}
      <DataGrid columns={columns} rows={rows} rowKey={(r) => r.code_cli || r.raison} loading={loading} error={error?.message}
                emptyMessage={inclureBl ? 'Aucune vente sur l’exercice.' : 'Aucune facture sur l’exercice — cochez « Inclure les bons de livraison » si vous facturez sur BL.'}
                footer={t ? { _label: `${t.nb_clients} client(s)`, ht: <span className="money">{fmtMoney(t.montant_ht)}</span>,
                              tva: <span className="money">{fmtMoney(t.tva)}</span>, ttc: <b className="money">{fmtMoney(t.montant_ttc)}</b> } : undefined} />
    </div>
  );
}
