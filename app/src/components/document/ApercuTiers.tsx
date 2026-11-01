import { type ReactNode } from 'react';
import { useQuery } from '@apollo/client';
import { ETAT_FOURNISSEUR, FACTURES_NON_REGLEES } from '../../api/queries';
import type { Client, Fournisseur } from '../../api/types';
import type { EtatFournisseurLigne, EtatFournisseurSolde } from '../../impression/donnees';
import { fmtDate } from '../../lib/format';
import { Badge, Money, StatusPill } from '../ui/atoms';
import { Button } from '../ui/Button';
import { DescriptionList, SectionTitle } from '../ui/Card';
import { Alert, Skeleton } from '../ui/States';
import ApercuCadre, { ApercuEnteteSimple, ApercuInvite, BoutonFermerApercu } from './ApercuCadre';

/** Nombre de factures / d'opérations montrées dans l'aperçu. */
const LIGNES_MAX = 5;

type FactureNR = {
  id: number; numero: string; type_facture: string; date: string;
  net_a_payer: number; regler: number; reste_a_payer: number; mode_payement?: string | null;
};

/** Champ annexe éventuellement renvoyé par l'agent dans la ligne de liste (adresse…). */
const champ = (t: object, k: string): string | null => {
  const v = (t as Record<string, unknown>)[k];
  return v == null || v === '' ? null : String(v);
};

/**
 * Aperçu rapide d'un tiers dans le panneau latéral de la liste Clients / Fournisseurs : identité,
 * situation et derniers mouvements. Lecture seule ; « Ouvrir la fiche » mène au détail.
 * Identité et solde viennent de la ligne de la liste ; complément par les requêtes du détail
 * (`FACTURES_NON_REGLEES` pour un client, `ETAT_FOURNISSEUR` pour un fournisseur), mêmes variables
 * que ClientDetail / FournisseurDetail (même cache Apollo).
 */
export default function ApercuTiers({ sens, tiers, onOuvrir, onFermer }: {
  sens: 'client' | 'fournisseur';
  /** Ligne sélectionnée ; `null` → invite à sélectionner une ligne. */
  tiers: Client | Fournisseur | null | undefined;
  onOuvrir: () => void;
  onFermer: () => void;
}) {
  const code = tiers?.code;
  const enveloppe = (entete: ReactNode, contenu: ReactNode) => (
    <ApercuCadre entete={entete} onFermer={onFermer} cle={code}>{contenu}</ApercuCadre>
  );

  if (!tiers) {
    return enveloppe(<ApercuEnteteSimple titre="Aperçu" onFermer={onFermer} />,
      <ApercuInvite titre={sens === 'client' ? 'Sélectionnez un client' : 'Sélectionnez un fournisseur'} ouvrir="la fiche" />);
  }

  const nom = sens === 'client'
    ? `${tiers.nom ?? ''}${(tiers as Client).prenom ? ` ${(tiers as Client).prenom}` : ''}`.trim()
    : String(tiers.nom ?? '');

  return enveloppe(
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-7 h-7 flex-none rounded-sm bg-brand-soft text-brand-text font-extrabold text-xs flex items-center justify-center" aria-hidden="true">
          {(nom || tiers.code).slice(0, 2).toUpperCase()}
        </span>
        <span className="money text-sm font-semibold text-ink-label truncate" title={tiers.code}>{tiers.code}</span>
        <span className="ml-auto flex items-center gap-1 flex-none">
          <Button size="sm" icon="externalLink" onClick={onOuvrir} title="Ouvrir la fiche (double-clic ou Entrée dans la liste)">Ouvrir la fiche</Button>
          <BoutonFermerApercu onFermer={onFermer} />
        </span>
      </div>
      <div className="font-bold text-md text-ink line-clamp-2" title={nom}>{nom || '—'}</div>
    </div>,
    sens === 'client'
      ? <ContenuClient client={tiers as Client} onOuvrir={onOuvrir} />
      : <ContenuFournisseur fournisseur={tiers as Fournisseur} onOuvrir={onOuvrir} />,
  );
}

/** Coordonnées communes (présentes seulement si renseignées). */
function coordonnees(t: Client | Fournisseur) {
  const adresse = champ(t, 'adresse');
  return [
    { label: 'Téléphone', value: t.telephone ? <span className="money">{t.telephone}</span> : null },
    { label: 'Ville', value: t.ville ?? null },
    ...(adresse ? [{ label: 'Adresse', value: <span className="font-normal text-ink-label">{adresse}</span>, full: true }] : []),
    ...(champ(t, 'email') ? [{ label: 'E-mail', value: <span className="font-normal text-ink-label break-all">{champ(t, 'email')}</span>, full: true }] : []),
  ];
}

function ContenuClient({ client, onOuvrir }: { client: Client; onOuvrir: () => void }) {
  // Même requête et mêmes variables que l'onglet « Factures non réglées » de ClientDetail
  const { data, loading, error, refetch } = useQuery(FACTURES_NON_REGLEES, {
    variables: { code_cli: client.code }, fetchPolicy: 'cache-and-network', nextFetchPolicy: 'cache-first',
  });
  const impayees: FactureNR[] = Array.isArray(data?.facturesNonReglees) ? data.facturesNonReglees : [];
  const totalReste = impayees.reduce((s, f) => s + Number(f.reste_a_payer ?? 0), 0);
  // Les plus anciennes d'abord : ce sont celles à relancer
  const premieres = [...impayees].sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? ''))).slice(0, LIGNES_MAX);

  const solde = Number(client.credit ?? 0);
  const plafond = Number(client.plafond_credit ?? 0);
  const depasse = plafond > 0 && solde > plafond;
  const part = plafond > 0 ? Math.min(100, Math.max(0, (solde / plafond) * 100)) : 0;

  return (
    <>
      <DescriptionList columns={2} items={coordonnees(client)} />

      <section aria-label="Situation du client">
        <SectionTitle icon="wallet"
                      actions={solde > 0 ? <StatusPill tone="warn">Nous doit</StatusPill> : <StatusPill tone="ok">À jour</StatusPill>}>
          Situation
        </SectionTitle>
        <div className="rounded-md border border-line-soft bg-sunken px-3 py-2.5 flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-ink-label">Solde</span>
            <Money value={solde} currency colorNeg={false} tone={solde > 0 ? 'warning' : undefined} className="font-bold text-lg" />
          </div>
          {plafond > 0 && (
            <>
              <div className="flex items-baseline justify-between gap-3 text-sm text-ink-label">
                <span>Plafond de crédit</span>
                <Money value={plafond} className="font-semibold" />
              </div>
              <div className="h-1.5 rounded-full bg-line overflow-hidden" role="meter" aria-label="Utilisation du plafond"
                   aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(part)}>
                <div className={depasse ? 'h-full bg-danger-solid' : part >= 80 ? 'h-full bg-warning-solid' : 'h-full bg-success-solid'}
                     style={{ width: `${part}%` }} />
              </div>
              {depasse && <Badge tone="danger" icon="alert" className="self-start">Plafond dépassé</Badge>}
            </>
          )}
        </div>
      </section>

      <section aria-label="Factures non réglées">
        <SectionTitle icon="invoice"
                      actions={impayees.length > 0 ? <Money value={totalReste} tone="danger" className="text-sm font-semibold" /> : undefined}>
          Factures non réglées{impayees.length > 0 ? ` (${impayees.length})` : ''}
        </SectionTitle>
        {error && !data ? (
          <Alert tone="danger" compact action={<Button size="sm" icon="refresh" onClick={() => void refetch()}>Réessayer</Button>}>
            {error.message}
          </Alert>
        ) : loading && !data ? (
          <div role="status" aria-label="Chargement des factures"><Skeleton lines={3} height={14} /></div>
        ) : impayees.length === 0 ? (
          <div className="text-sm text-ink-muted">Aucune facture en attente.</div>
        ) : (
          <>
            <ul className="flex flex-col">
              {premieres.map((f) => (
                <li key={f.id} className="flex items-baseline gap-2 py-1.5 border-b border-line-soft text-sm last:border-b-0">
                  <span className="money text-ink-label flex-none">{fmtDate(f.date)}</span>
                  <span className="flex-1 min-w-0 truncate" title={`${f.type_facture ?? ''} ${f.numero ?? ''}`}>
                    <span className="font-semibold text-ink-label">{f.type_facture}</span> <span className="money text-ink">{f.numero}</span>
                  </span>
                  <Money value={f.reste_a_payer} tone="danger" className="font-semibold" />
                </li>
              ))}
            </ul>
            {impayees.length > LIGNES_MAX && (
              <Button variant="link" size="sm" className="mt-1.5" onClick={onOuvrir}>
                + {impayees.length - LIGNES_MAX} autre{impayees.length - LIGNES_MAX > 1 ? 's' : ''} facture{impayees.length - LIGNES_MAX > 1 ? 's' : ''}
              </Button>
            )}
          </>
        )}
      </section>
    </>
  );
}

function ContenuFournisseur({ fournisseur, onOuvrir }: { fournisseur: Fournisseur; onOuvrir: () => void }) {
  // Même requête et mêmes variables que FournisseurDetail (relevé sans période)
  const { data, loading, error, refetch } = useQuery(ETAT_FOURNISSEUR, {
    variables: { code_four: fournisseur.code, date_debut: undefined, date_fin: undefined },
    fetchPolicy: 'cache-and-network', nextFetchPolicy: 'cache-first',
  });
  const etatBrut: EtatFournisseurSolde | undefined = data?.etatFournisseur?.fournisseur;
  // Données d'un autre fournisseur encore présentes pendant le changement de sélection : ignorées
  const etat = etatBrut && String(etatBrut.code_four) === String(fournisseur.code) ? etatBrut : undefined;
  const lignes: EtatFournisseurLigne[] = etat && Array.isArray(data?.etatFournisseur?.lignes) ? data.etatFournisseur.lignes : [];
  const dernieres = lignes.slice(-LIGNES_MAX).reverse();

  // Solde : celui de l'état s'il est chargé, sinon celui de la ligne de la liste (colonne Credit)
  const solde = Number(etat?.credit ?? fournisseur.credit_initial ?? 0);

  return (
    <>
      <DescriptionList columns={2} items={coordonnees(fournisseur)} />

      <section aria-label="Situation du fournisseur">
        <SectionTitle icon="wallet"
                      actions={solde > 0 ? <StatusPill tone="warn">À payer</StatusPill> : <StatusPill tone="ok">À jour</StatusPill>}>
          Situation
        </SectionTitle>
        <div className="rounded-md border border-line-soft bg-sunken px-3 py-2.5 flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-ink-label">Solde (on lui doit)</span>
            <Money value={solde} currency colorNeg={false} tone={solde > 0 ? 'warning' : undefined} className="font-bold text-lg" />
          </div>
          {etat ? (
            <>
              <div className="flex items-baseline justify-between gap-3 text-sm text-ink-label">
                <span>Total achats</span><Money value={etat.total_achats} className="font-semibold" />
              </div>
              <div className="flex items-baseline justify-between gap-3 text-sm text-ink-label">
                <span>Réglé</span><Money value={etat.regler} className="font-semibold" />
              </div>
            </>
          ) : loading && <Skeleton lines={2} height={12} />}
        </div>
      </section>

      <section aria-label="Dernières opérations">
        <SectionTitle icon="statement">Dernières opérations</SectionTitle>
        {error && !etat ? (
          <Alert tone="danger" compact action={<Button size="sm" icon="refresh" onClick={() => void refetch()}>Réessayer</Button>}>
            {error.message}
          </Alert>
        ) : !etat ? (
          loading
            ? <div role="status" aria-label="Chargement des opérations"><Skeleton lines={3} height={14} /></div>
            : <div className="text-sm text-ink-muted">Aucune opération.</div>
        ) : dernieres.length === 0 ? (
          <div className="text-sm text-ink-muted">Aucune opération.</div>
        ) : (
          <>
            <ul className="flex flex-col">
              {dernieres.map((l, i) => (
                <li key={i} className="flex items-baseline gap-2 py-1.5 border-b border-line-soft text-sm last:border-b-0">
                  <span className="money text-ink-label flex-none">{fmtDate(l.date)}</span>
                  <span className="flex-1 min-w-0 truncate" title={[l.type_doc, l.numero, l.mode_payement].filter(Boolean).join(' · ')}>
                    <span className="font-semibold text-ink-label">{l.type_doc}</span>
                    {l.numero ? <span className="money text-ink"> {l.numero}</span> : null}
                  </span>
                  <Money value={l.montant} colorNeg={false} tone={Number(l.montant) < 0 ? 'success' : undefined} className="font-semibold" />
                </li>
              ))}
            </ul>
            {lignes.length > LIGNES_MAX && (
              <Button variant="link" size="sm" className="mt-1.5" onClick={onOuvrir}>Voir le relevé complet</Button>
            )}
          </>
        )}
      </section>
    </>
  );
}
