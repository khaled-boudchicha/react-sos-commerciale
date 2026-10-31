import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { ACHAT, DELETE_ACHAT, COORDONNEES_SOCIETE } from '../api/queries';
import { Achat, ACHAT_TYPE_CODE, LigneAchat } from '../api/types';
import { useDroits } from '../lib/droits';
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
import ImprimerDocument from '../impression/ImprimerDocument';
import type { DemandeImpression } from '../impression/demandes';
import { demandeAchat } from '../impression/demandes';
import RequireDroit from '../components/RequireDroit';
import { useSession } from '../store/session';

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
    { key: 'designation', header: 'Désignation', render: (l) => <span><b>{String(l.designation ?? '')}</b>{l.n_lot ? <span className="text-ink-muted money text-xs"> · lot {String(l.n_lot)}</span> : null}</span> },
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

  const fournisseur = a ? (a.fournisseur ?? a.raison ?? a.code_four ?? a.code_cli ?? '—') : '';
  const titre = a ? `${a.type_doc} ${a.numero}` : "Pièce d'achat";
  const autres: MenuItem[] = [];
  if (a && peutRetour) {
    autres.push({ label: code === 'FA' ? 'Avoir' : 'Bon de retour', icon: 'return', hint: 'fournisseur', onSelect: () => setRetour(true) });
  }
  if (a && peutDoc('achat', code, 'creer')) {
    autres.push({ label: 'Dupliquer', icon: 'copy', hint: 'mêmes lignes', onSelect: () => navigate(`/achats/nouvelle?type=${code}&from=${a.id}`) });
  }

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title={titre} backTo="/achats" backLabel="Retour à la liste"
                  breadcrumb={[{ label: 'Achats', to: '/achats' }, { label: titre }]}
                  meta={a && (
                    <>
                      <DocBadge code={code} />
                      {TYPES_AVEC_REGLEMENT.includes(code) && <PayStatus regler={Number(a.regler)} reste={Number(a.reste_a_payer)} />}
                    </>
                  )}>
        {a && (
          <TransformerMenu sens="achat" id={a.id} cibles={a.transformations_possibles ?? []} onDone={recharger} />
        )}
        {a && (
          <Button icon="printer" onClick={() => setPrintDoc(demandeAchat(a, societe))}>Imprimer</Button>
        )}
        {autres.length > 0 && <Menu label="Plus" items={autres} />}
        {a && a.modifiable !== false && peutDoc('achat', code, 'modifier') && (
          <Button variant="primary" icon="edit" onClick={() => navigate(`/achats/nouvelle?edit=${a.id}`)}>Modifier</Button>
        )}
        {a && peutDoc('achat', code, 'supprimer') && (
          <>
            <span className="h-6 w-px bg-line-soft" aria-hidden="true" />
            <Button variant="danger" icon="trash" onClick={() => setConfirm(true)}>Supprimer</Button>
          </>
        )}
      </PageHeader>
      {retour && a && (
        <RetourModal sens="achat" onClose={() => setRetour(false)}
                     source={{ id: a.id, numero: a.numero, type_doc: a.type_doc, code, lignes }} />
      )}
      {error && (
        <Alert tone="danger" action={<Button size="sm" icon="refresh" onClick={() => refetch()}>Réessayer</Button>}>
          {error.message}
        </Alert>
      )}
      {delError && <Alert tone="danger">{delError}</Alert>}
      {printDoc && <ImprimerDocument demande={printDoc} onClose={() => setPrintDoc(null)} />}
      {confirm && a && (
        <ConfirmDialog
          title="Supprimer cette pièce ?"
          message={<>La pièce <b>{a.type_doc} {a.numero}</b> sera définitivement supprimée et le stock reversé. Action irréversible.</>}
          confirmLabel="Supprimer" danger loading={deleting}
          onConfirm={handleDelete} onCancel={() => setConfirm(false)}
        />
      )}
      {loading && !a && (
        <Card><Skeleton lines={2} height={14} /></Card>
      )}

      {a && (
        <Card>
          <DescriptionList columns={4} items={[
            { label: 'Fournisseur', value: fournisseur },
            { label: 'Date', value: fmtDate(a.date) },
            { label: 'Mode de paiement', value: a.mode_payement },
            ...(a.user_name ? [{ label: 'Saisie par', value: a.user_name }] : []),
          ]} />
        </Card>
      )}

      <div className="grid grid-cols-[1fr_280px] gap-3.5 items-start">
        <div className="flex flex-col gap-3.5 min-w-0">
          <DataGrid complet columns={columns} rows={lignes} rowKey={(l) => l.id} loading={loading}
                    emptyMessage="Aucune ligne."
                    footer={{ _label: `${lignes.length} ligne(s)`, ttc: <Money value={a?.total_ttc} /> }} />
          {a && (
            <LiensPiece base="/achats" codes={ACHAT_TYPE_CODE} retours={a.retours} pieceOrigine={a.piece_origine} />
          )}
          {a && TYPES_RETOUR.includes(code) && (
            <Alert tone="info" compact>Cet avoir / retour vient en déduction du solde du fournisseur.</Alert>
          )}
          {a && TYPES_AVEC_REGLEMENT.includes(code) && (
            <ReglementsPiece sens="achat" pieceId={a.id} numero={a.numero} reglements={a.reglements ?? []}
                             reste={Number(a.reste_a_payer ?? 0)} onChange={recharger} />
          )}
        </div>
        {a && (
          <TotalsPanel
            rows={[
              { label: 'Total HT', value: Number(a.total_ht ?? 0) },
              { label: `Remise globale${Number(a.remise) ? ` (${fmtQte(a.remise)} %)` : ''}`, value: -(Number(a.remise_montant ?? 0)) },
              { label: 'Total TTC', value: Number(a.total_ttc ?? 0) },
            ]}
            total={{ label: 'Net à payer', value: Number(a.net_a_payer ?? 0) }}
            after={(
              <div className="flex flex-col gap-1.5 text-base text-ink-label">
                <div className="flex items-baseline justify-between gap-4">
                  <span>Réglé</span><Money value={a.regler} className="font-semibold" />
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <span>Reste</span>
                  <Money value={a.reste_a_payer} className="font-semibold" tone={Number(a.reste_a_payer) > 0 ? 'danger' : undefined} />
                </div>
              </div>
            )}
          />
        )}
      </div>
      {a?.observation && (
        <Card padding="sm">
          <span className="text-xs font-semibold text-ink-muted mr-1.5">Note</span>
          <span className="text-sm text-ink-label">{a.observation}</span>
        </Card>
      )}
    </div>
  );
}
