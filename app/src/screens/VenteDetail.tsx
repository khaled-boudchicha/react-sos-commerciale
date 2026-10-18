import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { VENTE, DELETE_VENTE, COORDONNEES_SOCIETE } from '../api/queries';
import { Vente, LigneVente, VENTE_TYPE_CODE } from '../api/types';
import { D, useDroits } from '../lib/droits';
import { fmtDate, fmtMoney, fmtQte } from '../lib/format';
import DataGrid, { Column } from '../components/ui/DataGrid';
import { DocBadge, PayStatus, Money, PageHeader } from '../components/ui/atoms';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
import TransformerMenu from '../components/document/TransformerMenu';
import RetourModal from '../components/document/RetourModal';
import ReglementsPiece, { TYPES_AVEC_REGLEMENT, TYPES_RETOUR } from '../components/document/ReglementsPiece';
import LiensPiece from '../components/document/LiensPiece';
import PrintPreview from '../print/engine/PrintPreview';
import { PrintDocument } from '../print/engine/types';
import ImprimerPieceDialog from '../components/document/ImprimerPieceDialog';
import { ImpressionModele } from '@softly/report';
import { donneesVente } from '../impression';
import { demandeTicket } from '../impression/demandes';
import ImprimerDocument from '../impression/ImprimerDocument';
import type { DemandeImpression } from '../impression/demandes';
import RequireDroit from '../components/RequireDroit';
import { useSession } from '../store/session';

const btn = 'rounded-md px-3 py-1.5 font-bold text-[12px] border border-line text-ink-label';

export default function VenteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { peut, peutDoc, restreintAuxSiennes } = useDroits();
  const moiId = useSession((s) => s.dossierUser?.id);
  const [confirm, setConfirm] = useState(false);
  const [retour, setRetour] = useState(false);
  const [printDoc, setPrintDoc] = useState<PrintDocument | null>(null);
  const [demande, setDemande] = useState<DemandeImpression | null>(null);
  const [choixImpression, setChoixImpression] = useState(false);
  const [modelePerso, setModelePerso] = useState<string | null>(null);
  const [delError, setDelError] = useState<string | null>(null);
  // cache-and-network : la pièce peut avoir changé (modification, règlement, retour…)
  const { data, loading, error, refetch } = useQuery(VENTE, { variables: { id: Number(id) }, fetchPolicy: 'cache-and-network' });
  const { data: socData } = useQuery(COORDONNEES_SOCIETE);
  const societe = (socData?.coordonneesSociete ?? {}) as Record<string, unknown>;
  const v: Vente | undefined = data?.vente ?? undefined;
  const lignes: LigneVente[] = v?.lignes ?? [];
  const code = v ? (VENTE_TYPE_CODE[Number(v.type)] ?? 'FA') : 'FA';
  const recharger = () => { void refetch(); };

  const peutImprimer = peut('vente', D.vente.impression);
  const peutRetour = ['FA', 'BL', 'BCT'].includes(code)
    && (peutDoc('vente', 'FAV', 'creer') || peutDoc('vente', 'BRT', 'creer'));
  const aRetours = lignes.some((l) => Number(l.qte_retournee ?? 0) > 0);

  const [deleteVente, { loading: deleting }] = useMutation(DELETE_VENTE);
  async function handleDelete() {
    setDelError(null);
    try {
      await deleteVente({ variables: { id: Number(id) } });
      toast.success(`Pièce ${v?.numero ?? ''} supprimée.`);
      navigate('/ventes');
    } catch (e: any) {
      setConfirm(false);
      setDelError(e.message ?? 'Suppression impossible.');
    }
  }

  const columns: Column<LigneVente>[] = [
    { key: 'code', header: 'Code', width: '100px', sortAccessor: (l) => String(l.code_article ?? ''), render: (l) => <span className="money">{l.code_article}</span> },
    { key: 'designation', header: 'Désignation', render: (l) => <span><b>{l.designation}</b>{l.n_lot ? <span className="text-ink-muted money text-[10.5px]"> · lot {l.n_lot}</span> : null}</span> },
    { key: 'qte', header: 'Qté', align: 'right', width: '70px', render: (l) => <span className="money">{fmtQte(l.qte)}</span> },
    ...(aRetours ? [{ key: 'retour', header: 'Retourné', align: 'right' as const, width: '80px', sortAccessor: (l: LigneVente) => Number(l.qte_retournee ?? 0),
      render: (l: LigneVente) => Number(l.qte_retournee ?? 0) > 0
        ? <span className="money" style={{ color: 'var(--danger)' }}>{fmtQte(l.qte_retournee)}</span> : null }] : []),
    { key: 'pu', header: 'P.U. HT', align: 'right', width: '95px', sortAccessor: (l) => Number(l.prix_ht ?? 0), render: (l) => <Money value={l.prix_ht} /> },
    { key: 'remise', header: 'Rem. %', align: 'right', width: '70px', render: (l) => <span className="money">{fmtMoney(l.remise ?? 0, 1)}</span> },
    { key: 'tva', header: 'TVA %', align: 'right', width: '65px', render: (l) => <span className="money">{fmtMoney(l.tva, 0)}</span> },
    { key: 'ttc', header: 'Total TTC', align: 'right', width: '110px', sortAccessor: (l) => Number(l.total_ttc ?? 0), render: (l) => <Money value={l.total_ttc} /> },
  ];

  // Consultation : droit sur le type de pièce, et pièces des autres masquées si « … par utilisateur »
  if (v && (!peutDoc('vente', code, 'voir')
      || (restreintAuxSiennes('vente', code) && Number((v as { user_id?: unknown }).user_id) !== Number(moiId)))) {
    return <RequireDroit si={false}>{null}</RequireDroit>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title={v ? `${v.type_doc} ${v.numero}` : 'Pièce de vente'}>
        <Link to="/ventes" className="text-[12px] font-bold text-brand-700">← Retour à la liste</Link>
        {v && v.modifiable !== false && peutDoc('vente', code, 'modifier') && (
          <button onClick={() => navigate(`/ventes/nouvelle?edit=${v.id}`)} className={btn}>Modifier</button>
        )}
        {v && (
          <TransformerMenu sens="vente" id={v.id} cibles={v.transformations_possibles ?? []} onDone={recharger} />
        )}
        {v && peutRetour && (
          <button onClick={() => setRetour(true)} className={btn}
                  title="Créer un avoir ou un bon de retour sur tout ou partie des lignes">
            {code === 'FA' ? 'Avoir' : 'Bon de retour'}
          </button>
        )}
        {v && peutImprimer && (
          <button onClick={() => setChoixImpression(true)} className={btn}>Imprimer…</button>
        )}
        {v && peutImprimer && v.type === 4 && (
          <button onClick={() => setDemande(demandeTicket(v, societe))} className={btn}>Ticket 80mm</button>
        )}
        {v && peutDoc('vente', code, 'creer') && (
          <button onClick={() => navigate(`/ventes/nouvelle?type=${code}&from=${v.id}`)}
                  title="Créer une nouvelle pièce reprenant ces lignes" className={btn}>
            Dupliquer
          </button>
        )}
        {v && peutDoc('vente', code, 'supprimer') && (
          <button onClick={() => setConfirm(true)}
                  className="rounded-md px-3 py-1.5 font-bold text-[12px]"
                  style={{ background: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: 'var(--danger)' }}>
            Supprimer
          </button>
        )}
      </PageHeader>
      {retour && v && (
        <RetourModal sens="vente" onClose={() => setRetour(false)}
                     source={{ id: v.id, numero: v.numero, type_doc: v.type_doc, code, lignes }} />
      )}
      {choixImpression && v && (
        <ImprimerPieceDialog vente={v} code={code} societe={societe}
                             onApercu={(doc) => { setChoixImpression(false); setPrintDoc(doc); }}
                             onModele={(ref) => { setChoixImpression(false); setModelePerso(ref); }}
                             onClose={() => setChoixImpression(false)} />
      )}
      {printDoc && <PrintPreview doc={printDoc} onClose={() => setPrintDoc(null)} />}
      {demande && <ImprimerDocument demande={demande} onClose={() => setDemande(null)} />}
      {modelePerso && v && <ImpressionModele modeleRef={modelePerso} data={donneesVente(v, societe)} titre={`${v.type_doc} ${v.numero}`} onClose={() => setModelePerso(null)} />}
      {error && <div className="text-[12px]" style={{ color: 'var(--danger)' }}>{error.message}</div>}
      {delError && <div className="text-[12px]" style={{ color: 'var(--danger)' }}>{delError}</div>}
      {confirm && v && (
        <ConfirmDialog
          title="Supprimer cette pièce ?"
          message={<>La pièce <b>{v.type_doc} {v.numero}</b> sera définitivement supprimée et le stock des articles reversé. Cette action est irréversible.</>}
          confirmLabel="Supprimer" danger loading={deleting}
          onConfirm={handleDelete} onCancel={() => setConfirm(false)}
        />
      )}
      {loading && !v && <div className="text-[12px] text-ink-muted">Chargement…</div>}

      {v && (
        <div className="bg-surface border border-line-soft rounded-md shadow-soft px-4 py-3 flex items-center gap-5 flex-wrap text-[12px]">
          <DocBadge code={code} />
          <Field label="Client"><b>{v.raison ?? v.code_cli ?? '—'}</b></Field>
          <Field label="Date">{fmtDate(v.date)}</Field>
          <Field label="Mode">{v.mode_payement ?? '—'}</Field>
          {TYPES_AVEC_REGLEMENT.includes(code) && v.date_echeance && (
            <Field label="Échéance">
              {fmtDate(v.date_echeance)}
              {Number(v.reste_a_payer) > 0.009 && joursRetard(v.date_echeance) > 0 && (
                <span className="ml-1.5 font-bold" style={{ color: 'var(--danger)' }}>· en retard de {joursRetard(v.date_echeance)} j</span>
              )}
            </Field>
          )}
          {v.user_name && <Field label="Par">{v.user_name}</Field>}
          {code === 'BL' && v.grouped ? <Field label="Statut"><b>Facturé</b></Field> : null}
          <span className="ml-auto">{TYPES_AVEC_REGLEMENT.includes(code) && <PayStatus regler={Number(v.regler)} reste={Number(v.reste_a_payer)} />}</span>
        </div>
      )}

      <div className="grid grid-cols-[1fr_270px] gap-3.5 items-start">
        <div className="flex flex-col gap-3.5 min-w-0">
          <DataGrid complet columns={columns} rows={lignes} rowKey={(l) => l.id} loading={loading}
                    emptyMessage="Aucune ligne." footer={{ _label: `${lignes.length} ligne(s)`, ttc: <Money value={v?.total_ttc} /> }} />
          {v && (
            <LiensPiece base="/ventes" factureGroupee={v.facture_groupee} blsGroupes={v.bls_groupes}
                        retours={v.retours} pieceOrigine={v.piece_origine} />
          )}
          {v && TYPES_RETOUR.includes(code) && (
            <div className="text-[11.5px] text-ink-muted bg-surface border border-line-soft rounded-md px-4 py-3">
              Cet avoir / retour vient en déduction du solde du client (relevé, débiteurs).
            </div>
          )}
          {v && TYPES_AVEC_REGLEMENT.includes(code) && (
            <ReglementsPiece sens="vente" pieceId={v.id} numero={v.numero} reglements={v.reglements ?? []}
                             reste={Number(v.reste_a_payer ?? 0)} onChange={recharger} />
          )}
        </div>
        {v && (
          <div className="bg-surface border border-line-soft rounded-md shadow-soft overflow-hidden">
            <Row label="Total HT" value={v.total_ht} />
            <Row label={`Remise globale${Number(v.remise_p) ? ` (${fmtQte(v.remise_p)} %)` : ''}`} value={-(Number(v.remise ?? 0))} neg />
            <Row label="TVA" value={v.tva ?? 0} />
            {Number(v.timbre) > 0 && <Row label="Droit de timbre" value={v.timbre} />}
            <div className="px-4 py-3 flex justify-between items-center text-white font-extrabold" style={{ background: 'var(--gradient-hero)' }}>
              <span>Net à payer</span><span className="money text-[15px]">{fmtMoney(v.net_a_payer)} DA</span>
            </div>
            <Row label="Réglé" value={v.regler} />
            <Row label="Reste" value={v.reste_a_payer} danger={Number(v.reste_a_payer) > 0} />
          </div>
        )}
      </div>
      {v?.observation && <div className="text-[12px] text-ink-muted">Note : {v.observation}</div>}
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

/** Jours écoulés depuis l'échéance (négatif = pas encore échue). */
function joursRetard(echeance: unknown): number {
  const e = new Date(String(echeance));
  if (isNaN(e.getTime())) return 0;
  const auj = new Date(); auj.setHours(0, 0, 0, 0); e.setHours(0, 0, 0, 0);
  return Math.round((auj.getTime() - e.getTime()) / 86_400_000);
}
