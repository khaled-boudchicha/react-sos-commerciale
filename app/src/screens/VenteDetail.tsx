import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { VENTE, DELETE_VENTE, COORDONNEES_SOCIETE } from '../api/queries';
import { Vente, LigneVente, VENTE_TYPE_CODE } from '../api/types';
import { D, useDroits } from '../lib/droits';
import { fmtDate, fmtMoney, fmtQte } from '../lib/format';
import DataGrid, { Column } from '../components/ui/DataGrid';
import { DocBadge, PayStatus, Money, PageHeader } from '../components/ui/atoms';
import { Button } from '../components/ui/Button';
import { Card, DescriptionList, TotalsPanel } from '../components/ui/Card';
import { Alert, Skeleton } from '../components/ui/States';
import { Menu, type MenuItem } from '../components/ui/Menu';
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
    { key: 'designation', header: 'Désignation', render: (l) => <span><b>{l.designation}</b>{l.n_lot ? <span className="text-ink-muted money text-xs"> · lot {l.n_lot}</span> : null}</span> },
    { key: 'qte', header: 'Qté', align: 'right', width: '70px', render: (l) => <span className="money">{fmtQte(l.qte)}</span> },
    ...(aRetours ? [{ key: 'retour', header: 'Retourné', align: 'right' as const, width: '80px', sortAccessor: (l: LigneVente) => Number(l.qte_retournee ?? 0),
      render: (l: LigneVente) => Number(l.qte_retournee ?? 0) > 0
        ? <span className="money" style={{ color: 'var(--danger-text)' }}>{fmtQte(l.qte_retournee)}</span> : null }] : []),
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

  const titre = v ? `${v.type_doc} ${v.numero}` : 'Pièce de vente';
  const avecReglement = TYPES_AVEC_REGLEMENT.includes(code);

  // Actions secondaires regroupées (charte : plus de 4 boutons → menu)
  const plusActions: MenuItem[] = v ? [
    ...(peutRetour ? [{
      label: code === 'FA' ? 'Avoir' : 'Bon de retour', icon: 'return' as const,
      onSelect: () => setRetour(true),
    }] : []),
    ...(peutImprimer && v.type === 4 ? [{
      label: 'Ticket 80mm', icon: 'receipt' as const, onSelect: () => setDemande(demandeTicket(v, societe)),
    }] : []),
    ...(peutDoc('vente', code, 'creer') ? [{
      label: 'Dupliquer', icon: 'copy' as const, onSelect: () => navigate(`/ventes/nouvelle?type=${code}&from=${v.id}`),
    }] : []),
  ] : [];

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title={titre} backTo="/ventes" backLabel="Retour à la liste"
                  breadcrumb={[{ label: 'Ventes', to: '/ventes' }, { label: titre }]}
                  meta={v && (
                    <>
                      <DocBadge code={code} />
                      {avecReglement && <PayStatus regler={Number(v.regler)} reste={Number(v.reste_a_payer)} />}
                    </>
                  )}>
        {v && v.modifiable !== false && peutDoc('vente', code, 'modifier') && (
          <Button variant="primary" icon="edit" onClick={() => navigate(`/ventes/nouvelle?edit=${v.id}`)}>Modifier</Button>
        )}
        {v && (
          <TransformerMenu sens="vente" id={v.id} cibles={v.transformations_possibles ?? []} onDone={recharger} />
        )}
        {v && peutImprimer && (
          <Button icon="printer" onClick={() => setChoixImpression(true)}>Imprimer…</Button>
        )}
        {plusActions.length > 0 && (
          <Menu label="Plus d'actions" iconOnly items={plusActions} width={230} />
        )}
        {v && peutDoc('vente', code, 'supprimer') && (
          <>
            <span className="h-6 w-px bg-line-soft mx-0.5" aria-hidden="true" />
            <Button variant="danger" icon="trash" onClick={() => setConfirm(true)}>Supprimer</Button>
          </>
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
      {error && (
        <Alert tone="danger" title="Impossible de charger la pièce"
               action={<Button size="sm" icon="refresh" onClick={() => refetch()}>Réessayer</Button>}>
          {error.message}
        </Alert>
      )}
      {delError && <Alert tone="danger" title="Suppression impossible">{delError}</Alert>}
      {confirm && v && (
        <ConfirmDialog
          title="Supprimer cette pièce ?"
          message={<>La pièce <b>{v.type_doc} {v.numero}</b> sera définitivement supprimée et le stock des articles reversé. Cette action est irréversible.</>}
          confirmLabel="Supprimer" danger loading={deleting}
          onConfirm={handleDelete} onCancel={() => setConfirm(false)}
        />
      )}
      {loading && !v && (
        <Card>
          <div className="grid grid-cols-4 gap-x-6 gap-y-3" role="status" aria-label="Chargement de la pièce">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton width="40%" height={10} />
                <Skeleton width="75%" height={14} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {v && (
        <Card padding="md">
          <DescriptionList columns={4} items={[
            { label: 'Client', value: v.raison ?? v.code_cli ?? '—' },
            { label: 'Date', value: fmtDate(v.date) },
            { label: 'Mode de paiement', value: v.mode_payement ?? '—' },
            ...(avecReglement && v.date_echeance ? [{
              label: 'Échéance',
              value: (
                <>
                  {fmtDate(v.date_echeance)}
                  {Number(v.reste_a_payer) > 0.009 && joursRetard(v.date_echeance) > 0 && (
                    <span className="ml-1.5 font-bold text-danger-text">· en retard de {joursRetard(v.date_echeance)} j</span>
                  )}
                </>
              ),
            }] : []),
            ...(v.user_name ? [{ label: 'Par', value: v.user_name }] : []),
            ...(code === 'BL' && v.grouped ? [{ label: 'Statut', value: 'Facturé' }] : []),
          ]} />
        </Card>
      )}

      <div className="grid grid-cols-[1fr_280px] gap-3.5 items-start">
        <div className="flex flex-col gap-3.5 min-w-0">
          <DataGrid complet columns={columns} rows={lignes} rowKey={(l) => l.id} loading={loading}
                    emptyMessage="Aucune ligne." footer={{ _label: `${lignes.length} ligne(s)`, ttc: <Money value={v?.total_ttc} /> }} />
          {v && (
            <LiensPiece base="/ventes" factureGroupee={v.facture_groupee} blsGroupes={v.bls_groupes}
                        retours={v.retours} pieceOrigine={v.piece_origine} />
          )}
          {v && TYPES_RETOUR.includes(code) && (
            <Alert tone="info" compact>
              Cet avoir / retour vient en déduction du solde du client (relevé, débiteurs).
            </Alert>
          )}
          {v && avecReglement && (
            <ReglementsPiece sens="vente" pieceId={v.id} numero={v.numero} reglements={v.reglements ?? []}
                             reste={Number(v.reste_a_payer ?? 0)} onChange={recharger} />
          )}
        </div>
        {v && (
          <TotalsPanel
            rows={[
              { label: 'Total HT', value: Number(v.total_ht ?? 0) },
              { label: `Remise globale${Number(v.remise_p) ? ` (${fmtQte(v.remise_p)} %)` : ''}`, value: -(Number(v.remise ?? 0)) },
              { label: 'TVA', value: Number(v.tva ?? 0) },
              { label: 'Droit de timbre', value: Number(v.timbre ?? 0), hidden: !(Number(v.timbre) > 0) },
            ]}
            total={{ label: 'Net à payer', value: Number(v.net_a_payer ?? 0) }}
            after={(
              <div className="flex flex-col gap-1.5 text-base text-ink-label">
                <div className="flex items-baseline justify-between gap-4">
                  <span>Réglé</span><Money value={v.regler} className="font-semibold" />
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <span>Reste</span>
                  <Money value={v.reste_a_payer} className="font-semibold" tone={Number(v.reste_a_payer) > 0 ? 'danger' : undefined} />
                </div>
              </div>
            )}
          />
        )}
      </div>
      {v?.observation && (
        <Card padding="sm" className="text-sm text-ink-label">
          <span className="font-semibold text-ink-muted">Note : </span>{v.observation}
        </Card>
      )}
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
