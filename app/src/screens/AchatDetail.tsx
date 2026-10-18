import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { ACHAT, DELETE_ACHAT, COORDONNEES_SOCIETE } from '../api/queries';
import { Achat, ACHAT_TYPE_CODE, LigneAchat } from '../api/types';
import { useDroits } from '../lib/droits';
import { fmtDate, fmtMoney, fmtQte } from '../lib/format';
import DataGrid, { Column } from '../components/ui/DataGrid';
import { DocBadge, PayStatus, Money, PageHeader } from '../components/ui/atoms';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
import TransformerMenu from '../components/document/TransformerMenu';
import RetourModal from '../components/document/RetourModal';
import ReglementsPiece, { TYPES_AVEC_REGLEMENT, TYPES_RETOUR } from '../components/document/ReglementsPiece';
import LiensPiece from '../components/document/LiensPiece';
import ImprimerDocument from '../impression/ImprimerDocument';
import type { DemandeImpression } from '../impression/demandes';
import { demandeAchat } from '../impression/demandes';
import RequireDroit from '../components/RequireDroit';
import { useSession } from '../store/session';

const btn = 'rounded-md px-3 py-1.5 font-bold text-[12px] border border-line text-ink-label';

/** Champs de liaison éventuellement renvoyés par l'agent (mêmes formes qu'en vente). */
type AchatDetailData = Achat & {
  retours?: { id: number; type: number; numero: string; date: string; net_a_payer: number }[];
  piece_origine?: { id: number; type: number; type_doc: string; numero: string } | null;
};

export default function AchatDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { peutDoc, restreintAuxSiennes } = useDroits();
  const moiId = useSession((s) => s.dossierUser?.id);
  const [confirm, setConfirm] = useState(false);
  const [retour, setRetour] = useState(false);
  const [printDoc, setPrintDoc] = useState<DemandeImpression | null>(null);
  const [delError, setDelError] = useState<string | null>(null);
  const { data, loading, error, refetch } = useQuery(ACHAT, { variables: { id: Number(id) }, fetchPolicy: 'cache-and-network' });
  const { data: socData } = useQuery(COORDONNEES_SOCIETE);
  const societe = (socData?.coordonneesSociete ?? {}) as Record<string, unknown>;
  const a: AchatDetailData | undefined = data?.achat ?? undefined;
  const lignes: LigneAchat[] = Array.isArray(a?.lignes) ? a.lignes : [];
  // code_type = étape courante renvoyée par l'agent ; repli sur le type numérique
  const code = a ? (a.code_type ?? ACHAT_TYPE_CODE[Number(a.type)] ?? 'BR') : 'BR';
  const recharger = () => { void refetch(); };

  const peutRetour = (code === 'FA' || code === 'BR')
    && (peutDoc('achat', 'FAV', 'creer') || peutDoc('achat', 'BRT', 'creer'));

  const [deleteAchat, { loading: deleting }] = useMutation(DELETE_ACHAT);
  async function handleDelete() {
    setDelError(null);
    try {
      await deleteAchat({ variables: { id: Number(id) } });
      toast.success(`Pièce ${a?.numero ?? ''} supprimée.`);
      navigate('/achats');
    } catch (e: any) {
      setConfirm(false);
      setDelError(e.message ?? 'Suppression impossible.');
    }
  }

  const columns: Column<LigneAchat>[] = [
    { key: 'code', header: 'Code', width: '100px', sortAccessor: (l) => String(l.code_article ?? ''), render: (l) => <span className="money">{String(l.code_article ?? '')}</span> },
    { key: 'designation', header: 'Désignation', render: (l) => <span><b>{String(l.designation ?? '')}</b>{l.n_lot ? <span className="text-ink-muted money text-[10.5px]"> · lot {String(l.n_lot)}</span> : null}</span> },
    { key: 'qte', header: 'Qté', align: 'right', width: '70px', render: (l) => <span className="money">{fmtQte(l.qte)}</span> },
    { key: 'pu', header: 'P.U. HT', align: 'right', width: '95px', sortAccessor: (l) => Number(l.prix_ht ?? 0), render: (l) => <Money value={l.prix_ht} /> },
    { key: 'remise', header: 'Rem. %', align: 'right', width: '70px', render: (l) => <span className="money">{fmtMoney(l.remise ?? 0, 1)}</span> },
    { key: 'tva', header: 'TVA %', align: 'right', width: '65px', render: (l) => <span className="money">{fmtMoney(l.tva, 0)}</span> },
    { key: 'ttc', header: 'Total TTC', align: 'right', width: '110px', sortAccessor: (l) => Number(l.total_ttc ?? 0), render: (l) => <Money value={l.total_ttc} /> },
  ];

  // Consultation : droit sur le type de pièce, et pièces des autres masquées si « … par utilisateur »
  if (a && (!peutDoc('achat', code, 'voir')
      || (restreintAuxSiennes('achat', code) && Number((a as { user_id?: unknown }).user_id) !== Number(moiId)))) {
    return <RequireDroit si={false}>{null}</RequireDroit>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title={a ? `${a.type_doc} ${a.numero}` : "Pièce d'achat"}>
        <Link to="/achats" className="text-[12px] font-bold text-brand-700">← Retour à la liste</Link>
        {a && a.modifiable !== false && peutDoc('achat', code, 'modifier') && (
          <button onClick={() => navigate(`/achats/nouvelle?edit=${a.id}`)} className={btn}>Modifier</button>
        )}
        {a && (
          <TransformerMenu sens="achat" id={a.id} cibles={a.transformations_possibles ?? []} onDone={recharger} />
        )}
        {a && peutRetour && (
          <button onClick={() => setRetour(true)} className={btn}
                  title="Créer un avoir ou un bon de retour fournisseur">
            {code === 'FA' ? 'Avoir' : 'Bon de retour'}
          </button>
        )}
        {a && (
          <button onClick={() => setPrintDoc(demandeAchat(a, societe))} className={btn}>Imprimer</button>
        )}
        {a && peutDoc('achat', code, 'creer') && (
          <button onClick={() => navigate(`/achats/nouvelle?type=${code}&from=${a.id}`)}
                  title="Créer une nouvelle pièce reprenant ces lignes" className={btn}>
            Dupliquer
          </button>
        )}
        {a && peutDoc('achat', code, 'supprimer') && (
          <button onClick={() => setConfirm(true)}
                  className="rounded-md px-3 py-1.5 font-bold text-[12px]"
                  style={{ background: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: 'var(--danger)' }}>
            Supprimer
          </button>
        )}
      </PageHeader>
      {retour && a && (
        <RetourModal sens="achat" onClose={() => setRetour(false)}
                     source={{ id: a.id, numero: a.numero, type_doc: a.type_doc, code, lignes }} />
      )}
      {error && <div className="text-[12px]" style={{ color: 'var(--danger)' }}>{error.message}</div>}
      {delError && <div className="text-[12px]" style={{ color: 'var(--danger)' }}>{delError}</div>}
      {printDoc && <ImprimerDocument demande={printDoc} onClose={() => setPrintDoc(null)} />}
      {confirm && a && (
        <ConfirmDialog
          title="Supprimer cette pièce ?"
          message={<>La pièce <b>{a.type_doc} {a.numero}</b> sera définitivement supprimée et le stock reversé. Action irréversible.</>}
          confirmLabel="Supprimer" danger loading={deleting}
          onConfirm={handleDelete} onCancel={() => setConfirm(false)}
        />
      )}
      {loading && !a && <div className="text-[12px] text-ink-muted">Chargement…</div>}

      {a && (
        <div className="bg-surface border border-line-soft rounded-md shadow-soft px-4 py-3 flex items-center gap-5 flex-wrap text-[12px]">
          <DocBadge code={code} />
          <Field label="Fournisseur"><b>{a.fournisseur ?? a.raison ?? a.code_four ?? a.code_cli ?? '—'}</b></Field>
          <Field label="Date">{fmtDate(a.date)}</Field>
          <Field label="Mode">{a.mode_payement ?? '—'}</Field>
          {a.user_name && <Field label="Par">{a.user_name}</Field>}
          <span className="ml-auto">{TYPES_AVEC_REGLEMENT.includes(code) && <PayStatus regler={Number(a.regler)} reste={Number(a.reste_a_payer)} />}</span>
        </div>
      )}

      <div className="grid grid-cols-[1fr_270px] gap-3.5 items-start">
        <div className="flex flex-col gap-3.5 min-w-0">
          <DataGrid complet columns={columns} rows={lignes} rowKey={(l) => l.id} loading={loading}
                    emptyMessage="Aucune ligne."
                    footer={{ _label: `${lignes.length} ligne(s)`, ttc: <Money value={a?.total_ttc} /> }} />
          {a && (
            <LiensPiece base="/achats" codes={ACHAT_TYPE_CODE} retours={a.retours} pieceOrigine={a.piece_origine} />
          )}
          {a && TYPES_RETOUR.includes(code) && (
            <div className="text-[11.5px] text-ink-muted bg-surface border border-line-soft rounded-md px-4 py-3">
              Cet avoir / retour vient en déduction du solde du fournisseur.
            </div>
          )}
          {a && TYPES_AVEC_REGLEMENT.includes(code) && (
            <ReglementsPiece sens="achat" pieceId={a.id} numero={a.numero} reglements={a.reglements ?? []}
                             reste={Number(a.reste_a_payer ?? 0)} onChange={recharger} />
          )}
        </div>
        {a && (
          <div className="bg-surface border border-line-soft rounded-md shadow-soft overflow-hidden">
            <Row label="Total HT" value={a.total_ht} />
            <Row label={`Remise globale${Number(a.remise) ? ` (${fmtQte(a.remise)} %)` : ''}`} value={-(Number(a.remise_montant ?? 0))} neg />
            <Row label="Total TTC" value={a.total_ttc} />
            <div className="px-4 py-3 flex justify-between items-center text-white font-extrabold" style={{ background: 'var(--gradient-hero)' }}>
              <span>Net à payer</span><span className="money text-[15px]">{fmtMoney(a.net_a_payer)} DA</span>
            </div>
            <Row label="Réglé" value={a.regler} />
            <Row label="Reste" value={a.reste_a_payer} danger={Number(a.reste_a_payer) > 0} />
          </div>
        )}
      </div>
      {a?.observation && <div className="text-[12px] text-ink-muted">Note : {a.observation}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <span><span className="text-[10px] font-bold uppercase text-ink-muted mr-1.5">{label}</span>{children}</span>;
}

function Row({ label, value, neg, danger }: { label: string; value: unknown; neg?: boolean; danger?: boolean }) {
  const v = Number(value ?? 0);
  return (
    <div className="flex justify-between px-4 py-2 text-[12px] text-ink-label border-b border-dashed border-line-soft">
      <span>{label}</span>
      <span className="money" style={{ color: danger || (neg && v < 0) ? 'var(--danger)' : undefined }}>{fmtMoney(v)}</span>
    </div>
  );
}
