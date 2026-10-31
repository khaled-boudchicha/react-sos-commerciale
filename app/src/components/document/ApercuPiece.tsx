import { type ReactNode } from 'react';
import { useQuery } from '@apollo/client';
import { VENTE, ACHAT } from '../../api/queries';
import { ACHAT_TYPE_CODE, VENTE_TYPE_CODE, type Achat, type LigneAchat, type LigneVente, type ReglementPiece, type Vente } from '../../api/types';
import { useDroits } from '../../lib/droits';
import { useSession } from '../../store/session';
import { fmtDate, fmtQte } from '../../lib/format';
import { Badge, DocBadge, Money, PayStatus } from '../ui/atoms';
import { Button } from '../ui/Button';
import { DescriptionList, SectionTitle, TotalsPanel } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { Alert, EmptyState, Skeleton, StatePanel } from '../ui/States';
import ApercuCadre, { ApercuEnteteSimple, ApercuInvite, BoutonFermerApercu } from './ApercuCadre';
import { TYPES_AVEC_REGLEMENT } from './ReglementsPiece';

/** Nombre de lignes de la pièce montrées dans l'aperçu. */
const LIGNES_MAX = 5;

/**
 * Aperçu rapide d'une pièce (vente ou achat) dans un panneau latéral de liste : en-tête, tiers,
 * informations, premières lignes, totaux et règlements. Lecture seule ; « Ouvrir » mène au détail.
 * Réutilise les requêtes `VENTE` / `ACHAT` du détail (même cache Apollo) et ses règles de consultation.
 */
export default function ApercuPiece({ sens, id, onOuvrir, onFermer }: {
  sens: 'vente' | 'achat';
  /** Pièce à afficher ; `null` → invite à sélectionner une ligne. */
  id: number | null | undefined;
  onOuvrir: () => void;
  onFermer: () => void;
}) {
  const { peutDoc, restreintAuxSiennes } = useDroits();
  const moiId = useSession((s) => s.dossierUser?.id);
  // cache-and-network : affichage immédiat depuis le cache puis relecture (règlement, modification…)
  const { data, loading, error, refetch } = useQuery(sens === 'vente' ? VENTE : ACHAT, {
    variables: { id: Number(id) }, skip: id == null, fetchPolicy: 'cache-and-network', nextFetchPolicy: 'cache-first',
  });
  const brut = (sens === 'vente' ? data?.vente : data?.achat) as (Vente & Achat) | null | undefined;
  // Données d'une autre pièce encore présentes pendant le changement de sélection : ignorées
  const piece = brut && Number(brut.id) === Number(id) ? brut : undefined;

  const fermer = <BoutonFermerApercu onFermer={onFermer} />;
  const enveloppe = (entete: ReactNode, contenu: ReactNode) => (
    <ApercuCadre entete={entete} onFermer={onFermer} cle={id}>{contenu}</ApercuCadre>
  );
  const enteteSimple = (titre: ReactNode) => <ApercuEnteteSimple titre={titre} onFermer={onFermer} />;

  if (id == null) {
    return enveloppe(enteteSimple('Aperçu'), <ApercuInvite titre="Sélectionnez une pièce" ouvrir="la pièce" />);
  }

  if (!piece) {
    if (error && !loading) {
      return enveloppe(enteteSimple('Aperçu'), (
        <Alert tone="danger" title="Impossible de charger la pièce"
               action={<Button size="sm" icon="refresh" onClick={() => void refetch()}>Réessayer</Button>}>
          {error.message}
        </Alert>
      ));
    }
    if (!loading && data) {
      return enveloppe(enteteSimple('Aperçu'), (
        <EmptyState icon="search" size="sm" title="Pièce introuvable" description="Elle a peut-être été supprimée depuis l'affichage de la liste." />
      ));
    }
    return enveloppe(
      <div className="flex items-center gap-2" role="status" aria-label="Chargement de la pièce">
        <Skeleton width={34} height={20} />
        <Skeleton width="45%" height={16} />
        <span className="ml-auto">{fermer}</span>
      </div>,
      <>
        <div className="flex flex-col gap-1.5"><Skeleton width="30%" height={10} /><Skeleton width="70%" height={16} /></div>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-1.5"><Skeleton width="50%" height={10} /><Skeleton width="80%" height={14} /></div>
          ))}
        </div>
        <Skeleton lines={5} height={14} />
        <Skeleton height={120} rounded="md" />
      </>,
    );
  }

  // Code de la pièce : même règle que l'écran de détail
  const code = sens === 'vente'
    ? (VENTE_TYPE_CODE[Number(piece.type)] ?? 'FA')
    : (piece.code_type ?? ACHAT_TYPE_CODE[Number(piece.type)] ?? 'BR');

  // Consultation : mêmes conditions que VenteDetail / AchatDetail (droit sur le type, « … par utilisateur »)
  if (!peutDoc(sens, code, 'voir')
      || (restreintAuxSiennes(sens, code) && Number((piece as { user_id?: unknown }).user_id) !== Number(moiId))) {
    return enveloppe(enteteSimple('Aperçu'), (
      <StatePanel kind="forbidden" className="!p-4 !shadow-none" title="Consultation non autorisée"
                  description="Votre profil ne permet pas de consulter cette pièce." />
    ));
  }

  const avecReglement = TYPES_AVEC_REGLEMENT.includes(code);
  const tiers = sens === 'vente'
    ? (piece.raison ?? piece.code_cli ?? '—')
    : (piece.fournisseur ?? piece.raison ?? piece.code_four ?? piece.code_cli ?? '—');
  const codeTiers = sens === 'vente' ? piece.code_cli : (piece.code_four ?? piece.code_cli);
  const lignes: (LigneVente | LigneAchat)[] = Array.isArray(piece.lignes) ? piece.lignes : [];
  const reglements: ReglementPiece[] = Array.isArray(piece.reglements) ? piece.reglements : [];
  const retard = sens === 'vente' && avecReglement && piece.date_echeance && Number(piece.reste_a_payer) > 0.009
    ? joursRetard(piece.date_echeance) : 0;

  const entete = (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <DocBadge code={code} />
        <span className="money font-bold text-md text-ink truncate" title={`${piece.type_doc ?? ''} ${piece.numero}`}>{piece.numero}</span>
        <span className="ml-auto flex items-center gap-1 flex-none">
          <Button size="sm" icon="externalLink" onClick={onOuvrir} title="Ouvrir la pièce (double-clic ou Entrée dans la liste)">Ouvrir</Button>
          {fermer}
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm text-ink-label">
        <Icon name="calendar" size={14} className="text-ink-muted" />
        <span className="money">{fmtDate(piece.date)}</span>
        {piece.type_doc && <span className="text-ink-muted truncate">· {piece.type_doc}</span>}
        {avecReglement && <span className="ml-auto"><PayStatus regler={Number(piece.regler)} reste={Number(piece.reste_a_payer)} /></span>}
      </div>
    </div>
  );

  const infos = [
    { label: 'Mode de paiement', value: piece.mode_payement ?? '—' },
    ...(sens === 'vente' && avecReglement && piece.date_echeance ? [{
      label: 'Échéance',
      value: (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className="money">{fmtDate(piece.date_echeance)}</span>
          {retard > 0 && <Badge tone="danger" icon="clock">{retard} j de retard</Badge>}
        </span>
      ),
    }] : []),
    ...(piece.user_name ? [{ label: sens === 'vente' ? 'Par' : 'Saisie par', value: piece.user_name }] : []),
    ...(sens === 'vente' && code === 'BL' && piece.grouped ? [{ label: 'Statut', value: 'Facturé' }] : []),
    ...(piece.observation ? [{ label: 'Observation', value: <span className="font-normal text-ink-label">{piece.observation}</span>, full: true }] : []),
  ];

  const totaux = sens === 'vente'
    ? [
      { label: 'Total HT', value: Number(piece.total_ht ?? 0) },
      { label: 'Remise globale', value: -(Number(piece.remise ?? 0)), hidden: !(Number(piece.remise) > 0) },
      { label: 'TVA', value: Number(piece.tva ?? 0) },
      { label: 'Droit de timbre', value: Number(piece.timbre ?? 0), hidden: !(Number(piece.timbre) > 0) },
    ]
    : [
      { label: 'Total HT', value: Number(piece.total_ht ?? 0) },
      { label: 'Remise globale', value: -(Number(piece.remise_montant ?? 0)), hidden: !(Number(piece.remise_montant) > 0) },
      { label: 'Total TTC', value: Number(piece.total_ttc ?? 0) },
    ];

  return enveloppe(entete, (
    <>
      {/* Tiers */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="inline-flex flex-none items-center justify-center w-9 h-9 rounded-md bg-brand-soft text-brand-text">
          <Icon name={sens === 'vente' ? 'user' : 'building'} size={18} />
        </span>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-ink-muted">{sens === 'vente' ? 'Client' : 'Fournisseur'}</div>
          <div className="font-bold text-base text-ink truncate" title={String(tiers)}>{tiers}</div>
          {(codeTiers || piece.tel) && (
            <div className="text-xs text-ink-muted money truncate">
              {codeTiers}{codeTiers && piece.tel ? ' · ' : ''}{piece.tel}
            </div>
          )}
        </div>
      </div>

      <DescriptionList columns={2} items={infos} />

      {/* Lignes */}
      <section aria-label="Lignes de la pièce">
        <SectionTitle icon="package">Lignes ({lignes.length})</SectionTitle>
        {lignes.length === 0 ? (
          <div className="text-sm text-ink-muted">Aucune ligne.</div>
        ) : (
          <table className="w-full text-sm text-ink" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="text-2xs font-bold uppercase tracking-wider text-ink-muted border-b border-line-soft">
                <th className="text-left font-bold py-1.5">Désignation</th>
                <th className="text-right font-bold py-1.5 w-14">Qté</th>
                <th className="text-right font-bold py-1.5 w-24">Total</th>
              </tr>
            </thead>
            <tbody>
              {lignes.slice(0, LIGNES_MAX).map((l) => (
                <tr key={l.id} className="border-b border-line-soft align-top">
                  <td className="py-1.5 pr-2 min-w-0">
                    <div className="truncate font-semibold" title={String(l.designation ?? '')}>{String(l.designation ?? '')}</div>
                    {l.code_article && <div className="truncate text-xs text-ink-muted money">{String(l.code_article)}</div>}
                  </td>
                  <td className="py-1.5 text-right money">{fmtQte(l.qte)}</td>
                  <td className="py-1.5 text-right"><Money value={l.total_ttc} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {lignes.length > LIGNES_MAX && (
          <Button variant="link" size="sm" className="mt-1.5" onClick={onOuvrir}>
            + {lignes.length - LIGNES_MAX} autre{lignes.length - LIGNES_MAX > 1 ? 's' : ''} ligne{lignes.length - LIGNES_MAX > 1 ? 's' : ''}
          </Button>
        )}
      </section>

      <TotalsPanel
        className="!shadow-none"
        rows={totaux}
        total={{ label: 'Net à payer', value: Number(piece.net_a_payer ?? 0) }}
        after={(
          <div className="flex flex-col gap-1.5 text-base text-ink-label">
            <div className="flex items-baseline justify-between gap-4">
              <span>Réglé</span><Money value={piece.regler} className="font-semibold" />
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <span>Reste</span>
              <Money value={piece.reste_a_payer} className="font-semibold" tone={Number(piece.reste_a_payer) > 0 ? 'danger' : undefined} />
            </div>
          </div>
        )}
      />

      {/* Règlements */}
      {avecReglement && reglements.length > 0 && (
        <section aria-label="Règlements">
          <SectionTitle icon="wallet">Règlements ({reglements.length})</SectionTitle>
          <ul className="flex flex-col">
            {reglements.map((r) => (
              <li key={r.id} className="flex items-baseline gap-2 py-1.5 border-b border-line-soft text-sm last:border-b-0">
                <span className="money text-ink-label flex-none">{fmtDate(r.date)}</span>
                <span className="flex-1 min-w-0 truncate text-ink-label" title={[r.mode_payement, r.num_cheque && `n° ${r.num_cheque}`, r.observation].filter(Boolean).join(' · ')}>
                  {r.depuis_avance ? <span className="font-bold mr-1">Avance</span> : null}
                  {r.mode_payement ?? '—'}{r.num_cheque ? <span className="text-ink-muted money text-xs"> · n° {r.num_cheque}</span> : null}
                </span>
                <Money value={r.montant} className="font-semibold" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  ));
}

/** Jours écoulés depuis l'échéance (négatif = pas encore échue) — même calcul que l'écran de détail. */
function joursRetard(echeance: unknown): number {
  const e = new Date(String(echeance));
  if (isNaN(e.getTime())) return 0;
  const auj = new Date(); auj.setHours(0, 0, 0, 0); e.setHours(0, 0, 0, 0);
  return Math.round((auj.getTime() - e.getTime()) / 86_400_000);
}
