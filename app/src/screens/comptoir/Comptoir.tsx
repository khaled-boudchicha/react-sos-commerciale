import { useEffect, useMemo, useState } from 'react';
import { gql, useApolloClient, useMutation, useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { ADD_REGLEMENT_CLIENT, COORDONNEES_SOCIETE, LOTS, VENTE, VENTES } from '../../api/queries';
import { messageErreur, resultatIncertain } from '../../api/erreurs';
import { sonderReseau, useConnexion } from '../../api/useSurveillanceReseau';
import { Article, Client, Vente } from '../../api/types';
import ClientSearch from '../../components/ClientSearch';
import ArreteCaisseModal from '../../components/ArreteCaisseModal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Icon, { Kbd, NomIcone } from '../../components/ui/Icon';
import { useToast } from '../../components/ui/Toast';
import { LigneDoc } from '../../components/document/lignesDocument';
import { lignesPourServeur } from '../../components/document/prefillPiece';
import ImprimerDocument from '../../impression/ImprimerDocument';
import { documentDeDemande } from '../../impression';
import { demandeTicket, type DemandeImpression } from '../../impression/demandes';
import { getImprimanteTicket, imprimerSilencieux, supporteImpressionDirecte } from '../../print/engine/silentPrint';
import type { TicketExtras } from '../../print/templates/ticket';
import { D, useDroits } from '../../lib/droits';
import { fmtMoney, fmtQte, isoToday } from '../../lib/format';
import { useHotkeys } from '../../lib/useHotkeys';
import { useSession } from '../../store/session';
import { NB_TICKETS, NiveauPrix, ajouterArticle, ajusterQte, totauxTicket } from './comptoirCalc';
import { useComptoir } from './comptoirStore';
import ChampScan from './ChampScan';
import LignesComptoir from './LignesComptoir';
import PaiementDialog, { ResultatPaiement } from './PaiementDialog';
import RemiseDialog from './RemiseDialog';
import MontantDialog from './MontantDialog';
import TuilesArticles from './TuilesArticles';
import VentesJourDialog from './VentesJourDialog';
import { ventesSuspectes, type TentativeIncertaine } from './reprise';

const CREATE_VENTE = gql`mutation CreateVenteComptoir($input: JSON!) { createVente(input: $input) }`;
const ID_SCAN = 'comptoir-scan';

type Dialogue = 'paiement' | 'remise' | 'ventes' | 'caisse' | 'annuler' | 'retour' | 'montant' | null;

/**
 * Vente au comptoir (portage de ComptoirMixts.pas) — implémentation de la maquette
 * « Vente au comptoir » (écran de caisse plein écran, clavier + tactile).
 *
 *  F2 encaisser · F12 exact + ticket · F11 exact sans ticket · F4 annuler · F6 / Échap scan
 *  F7 remise · F8 client · F9 réimprimer · F10 ventes du jour · ↑/↓ ligne · +/− quantité
 *  Suppr retirer la ligne · Ctrl+Q quantité depuis un montant · Ctrl+1…5 tickets en attente
 *
 * Validation = createVente BCT (BRT en mode retour) + règlement espèces sur la caisse de
 * l'utilisateur. Le lot le mieux fourni est affecté à chaque nouvelle ligne (règle Delphi).
 */
export default function Comptoir() {
  const toast = useToast();
  const apollo = useApolloClient();
  const { dossier, dossierUser } = useSession();
  const { peut, peutDoc, restreintAuxSiennes } = useDroits();
  const { tickets, actif, options, charger, setActif, majTicket, majTicketA, viderTicket, patchLigne, setOptions } = useComptoir();

  // Tickets en attente propres au caissier connecté (un autre caissier du poste ne les reprend pas)
  const caissierId = dossierUser?.id ?? dossierUser?.username ?? null;
  useEffect(() => { if (dossier) charger(dossier, caissierId); }, [dossier, caissierId, charger]);

  const ticket = tickets[actif];
  const retour = ticket.retour;
  const tot = useMemo(() => totauxTicket(ticket), [ticket]);
  const [selection, setSelection] = useState<number | null>(null);
  const [dialogue, setDialogue] = useState<Dialogue>(null);
  const [apercu, setApercu] = useState<DemandeImpression | null>(null);
  const [dernier, setDernier] = useState<{ id: number; numero: string; net: number; extras: TicketExtras } | null>(null);
  const [imprimante, setImprimante] = useState<string | undefined>();
  useEffect(() => { void getImprimanteTicket().then(setImprimante); }, []);

  const [creer, { loading: creation }] = useMutation(CREATE_VENTE);
  const [ajouterReglement] = useMutation(ADD_REGLEMENT_CLIENT);

  const peutVendre = peutDoc('vente', 'BCT', 'creer');
  const peutRetour = peutDoc('vente', 'BRT', 'creer');
  const peutCaisse = peut('autre', D.autre.arreterCaisse) || peut('autre', D.autre.arreterCaisseAlt);
  const peutImprimer = peut('vente', D.vente.impression);
  const caissier = (dossierUser?.name as string | undefined) || dossierUser?.username || '';

  // État de la connexion (Internet / serveur / agent) : même source que l'en-tête de l'application
  const connexion = useConnexion();
  const enLigne = connexion.ok;
  const [verification, setVerification] = useState(false);
  const [doublon, setDoublon] = useState<{ vente: Vente; paiement: ResultatPaiement } | null>(null);

  // Caisse du jour : tickets BCT d'aujourd'hui (les siens seulement si le droit l'impose)
  const { data: jourData, refetch: refetchJour } = useQuery(VENTES, {
    fetchPolicy: 'cache-and-network',
    variables: {
      type_doc: 'BCT', date_debut: isoToday(), date_fin: isoToday(), limit: 500, offset: 0,
      user_id: restreintAuxSiennes('vente', 'BCT') ? Number(dossierUser?.id) : undefined,
    },
  });
  const ventesJour: Vente[] = jourData?.ventes?.data ?? [];
  const totalJour = ventesJour.reduce((s, v) => s + (Number(v.net_a_payer) || 0), 0);

  const heure = useHorloge();

  // La sélection suit le ticket : dernière ligne par défaut
  useEffect(() => {
    if (!ticket.lignes.some((l) => l.key === selection)) setSelection(ticket.lignes.at(-1)?.key ?? null);
  }, [ticket.lignes, selection]);

  const focusScan = () => { const el = document.getElementById(ID_SCAN) as HTMLInputElement | null; el?.focus(); el?.select(); };
  // F8 / « Choisir » : ouvre la recherche client dans la carte client
  const [choixClient, setChoixClient] = useState(false);
  const focusClient = () => {
    setChoixClient(true);
    setTimeout(() => document.querySelector<HTMLInputElement>('[data-comptoir-client] input')?.focus(), 0);
  };

  /* ─── Lignes ─────────────────────────────────────────────────────────────── */

  function ajouter(a: Article) {
    if (retour ? !peutRetour : !peutVendre) return;
    let res: ReturnType<typeof ajouterArticle> | null = null;
    majTicket((t) => { res = ajouterArticle(t.lignes, a, options.niveauPrix); return { ...t, lignes: res.lignes }; });
    const r = res as ReturnType<typeof ajouterArticle> | null;
    if (!r) return;
    setSelection(r.key);
    if (r.nouvelle && a.id) void affecterLot(r.key, a.id);
  }

  /** Lot le mieux fourni de l'article (Delphi ArticleToLVente : ORDER BY Qte DESC LIMIT 1). */
  async function affecterLot(key: number, articleId: number) {
    try {
      const { data } = await apollo.query({ query: LOTS, variables: { article_id: articleId }, fetchPolicy: 'network-only' });
      const lots = (Array.isArray(data?.lots) ? data.lots : []) as { n_lot: string; qte: number; date_peremption?: string | null }[];
      const meilleur = lots.filter((l) => Number(l.qte) > 0 && String(l.n_lot ?? '').trim() !== '')
        .sort((x, y) => Number(y.qte) - Number(x.qte))[0];
      if (meilleur) patchLigne(key, { n_lot: meilleur.n_lot, date_peremption: meilleur.date_peremption ?? '' });
    } catch { /* sans lot : l'agent impute le mouvement au lot vide, comme une saisie sans lot */ }
  }

  const patch = (key: number, p: Partial<LigneDoc>) =>
    majTicket((t) => ({ ...t, lignes: t.lignes.map((l) => (l.key === key ? { ...l, ...p } : l)) }));
  const supprimer = (key: number) => majTicket((t) => ({ ...t, lignes: t.lignes.filter((l) => l.key !== key) }));
  const setClient = (c: Client | null) => { majTicket((t) => ({ ...t, client: c })); setChoixClient(false); if (c) setTimeout(focusScan, 0); };

  function deplacerSelection(sens: 1 | -1) {
    const ls = ticket.lignes;
    if (ls.length === 0) return;
    const i = ls.findIndex((l) => l.key === selection);
    setSelection(ls[i < 0 ? 0 : (i + sens + ls.length) % ls.length].key);
  }

  function qteSelection(sens: 1 | -1) {
    const l = ticket.lignes.find((x) => x.key === selection);
    if (l) patch(l.key, { qte: ajusterQte(l.qte, sens) });
  }

  /* ─── Validation ─────────────────────────────────────────────────────────── */

  const bloque = !enLigne;

  function demanderValidation(mode: 'dialogue' | 'sansTicket' | 'avecTicket') {
    if (ticket.lignes.length === 0 || creation || verification) return;
    if (bloque) { toast.error(`${connexion.libelle} : l’encaissement reprendra dès le retour de la connexion. Le ticket est conservé.`); return; }
    if (retour) { setDialogue('retour'); return; }
    // F11 / F12 : paiement exact immédiat pour le client de passage (étape 4 sautée)
    if (mode !== 'dialogue' && !ticket.client) {
      void enregistrer({ recu: tot.net, regle: tot.net, rendu: 0, credit: false, imprimer: mode === 'avecTicket' && peutImprimer });
      return;
    }
    setDialogue('paiement');
  }

  /**
   * Après un encaissement resté sans réponse sur ce ticket : un ticket du même montant est-il apparu
   * depuis dans les ventes du jour ? Renvoie false si l'encaissement doit être suspendu.
   */
  async function verifierTentativePrecedente(p: ResultatPaiement): Promise<boolean> {
    const tentative = ticket.incertain;
    if (!tentative || retour) return true;
    setVerification(true);
    try {
      const r = await refetchJour();
      const suspecte = ventesSuspectes(tentative, (r.data?.ventes?.data ?? []) as Vente[])[0];
      if (suspecte) { setDoublon({ vente: suspecte, paiement: p }); return false; }
      majTicketA(actif, (t) => ({ ...t, incertain: undefined }));
      return true;
    } catch (e) {
      toast.error(`Vérification impossible (${messageErreur(e)}). Le ticket précédent a peut-être été enregistré : réessayez quand la connexion sera rétablie.`);
      return false;
    } finally {
      setVerification(false);
    }
  }

  async function enregistrer(p: ResultatPaiement, forcer = false) {
    if (!dossierUser) { toast.error('Utilisateur dossier manquant — reconnectez-vous.'); return; }
    if (!forcer && !(await verifierTentativePrecedente(p))) return;
    const date = isoToday();
    const slot = actif;
    // Ventes déjà connues avant l'envoi : base de comparaison si la réponse se perd
    const connus = ventesJour.map((v) => Number(v.id));
    try {
      const { data } = await creer({
        variables: {
          input: {
            type_doc: retour ? 'BRT' : 'BCT',
            code_cli: ticket.client?.code ?? undefined,
            date,
            mode_payement: 'Espece',
            remise: ticket.remisePct || 0,
            // Le comptoir Delphi n'applique jamais le droit de timbre (IsTimbre=0)
            timbre: false,
            user_id: Number(dossierUser.id),
            user_name: String(dossierUser.username),
            lignes: lignesPourServeur(ticket.lignes),
          },
        },
      });
      const cree = data?.createVente as Vente | undefined;
      if (!cree?.id) throw new Error('réponse du serveur incomplète');

      if (!retour && p.regle > 0) {
        try {
          await ajouterReglement({
            variables: { input: {
              vente_id: cree.id, montant: Math.min(p.regle, Number(cree.net_a_payer ?? p.regle)), date, mode_payement: 'Espece',
              compte: dossierUser.compte ?? undefined, compte_id: dossierUser.compte_id ?? undefined,
            } },
          });
        } catch (e: any) {
          toast.error(`Ticket ${cree.numero} enregistré, mais l’encaissement a échoué : ${messageErreur(e)} Réglez-le depuis la pièce.`);
        }
      }

      const extras: TicketExtras = { caissier, recu: p.recu, rendu: p.rendu };
      setDernier({ id: cree.id, numero: String(cree.numero), net: Number(cree.net_a_payer), extras });
      viderTicket();
      setDialogue(null);
      // Rafraîchissement différé : laisse passer l'impression du ticket en priorité
      setTimeout(() => void refetchJour(), 1_500);
      toast.success(retour
        ? `Retour ${cree.numero} enregistré · à rembourser ${fmtMoney(cree.net_a_payer)} DA`
        : `Ticket ${cree.numero}${p.rendu > 0 ? ` · rendu ${fmtMoney(p.rendu)} DA` : ''}`);
      if (p.imprimer) void imprimer(cree.id, extras);
      setTimeout(focusScan, 0);
    } catch (e: unknown) {
      if (resultatIncertain(e)) {
        if (!retour) {
          const tentative: TentativeIncertaine = { net: tot.net, connus, utilisateur: String(dossierUser.username ?? ''), moment: Date.now() };
          majTicketA(slot, (t) => ({ ...t, incertain: tentative }));
        }
        toast.error(retour
          ? 'Pas de réponse du serveur : le retour a peut-être été enregistré. Vérifiez la liste des ventes avant de recommencer.'
          : 'Pas de réponse du serveur : le ticket a peut-être été enregistré. Il est conservé ; au prochain encaissement, les ventes du jour seront vérifiées pour éviter un doublon.');
      } else {
        toast.error(`Enregistrement échoué : ${messageErreur(e)}`);
      }
    }
  }

  /* ─── Impression ─────────────────────────────────────────────────────────── */

  async function imprimer(id: number, extras: TicketExtras = { caissier }) {
    try {
      const [{ data: v }, { data: s }] = await Promise.all([
        apollo.query({ query: VENTE, variables: { id }, fetchPolicy: 'network-only' }),
        apollo.query({ query: COORDONNEES_SOCIETE, fetchPolicy: 'network-only' }),
      ]);
      const demande = demandeTicket(v.vente as Vente, (s?.coordonneesSociete ?? {}) as Record<string, unknown>, extras);
      if (supporteImpressionDirecte()) {
        const r = await imprimerSilencieux(await documentDeDemande(demande));
        // Vente enregistrée : en cas d'échec on ouvre l'aperçu (réessayer, choisir l'imprimante)
        if (!r.success) { toast.error(`Impression impossible : ${r.reason ?? 'imprimante indisponible'}`); setApercu(demande); }
      } else {
        setApercu(demande);
      }
    } catch (e: any) {
      toast.error(`Impression du ticket échouée : ${messageErreur(e)}`);
    }
  }

  function reimprimerDernier() {
    if (!peutImprimer) return;
    if (!dernier) { toast.info('Aucun ticket validé depuis l’ouverture de la caisse — utilisez « Ventes du jour » (F10).'); return; }
    void imprimer(dernier.id, dernier.extras);
  }

  /* ─── Raccourcis ─────────────────────────────────────────────────────────── */

  // Flèches / Suppr : seulement hors champ de saisie (sinon elles servent au champ)
  const horsSaisie = (e: KeyboardEvent) => !(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement);

  useHotkeys({
    F2: () => demanderValidation('dialogue'),
    F11: () => demanderValidation('sansTicket'),
    F12: () => demanderValidation('avecTicket'),
    F4: () => { if (ticket.lignes.length > 0) setDialogue('annuler'); },
    F6: focusScan,
    Escape: focusScan,
    F7: () => { if (ticket.lignes.length > 0) setDialogue('remise'); },
    F8: focusClient,
    F9: reimprimerDernier,
    F10: () => setDialogue('ventes'),
    // Ctrl+Q : quantité de la ligne sélectionnée calculée depuis un montant TTC (Delphi)
    'Ctrl+Q': () => { if (ticket.lignes.some((l) => l.key === selection)) setDialogue('montant'); },
    NumpadAdd: () => qteSelection(1),
    NumpadSubtract: () => qteSelection(-1),
    ArrowDown: (e) => { if (horsSaisie(e)) deplacerSelection(1); },
    ArrowUp: (e) => { if (horsSaisie(e)) deplacerSelection(-1); },
    Delete: (e) => { if (horsSaisie(e) && selection != null) supprimer(selection); },
    ...Object.fromEntries(Array.from({ length: NB_TICKETS }, (_, i) => [`Ctrl+${i + 1}`, () => setActif(i)])),
  }, dialogue === null && apercu === null && doublon === null);

  if (!peutVendre && !peutRetour) {
    return <div className="p-6 text-base leading-[1.45] text-ink-muted">Accès refusé : droit « Nouveau Bon de Comptoir » requis.</div>;
  }

  const clientNom = ticket.client?.nom ?? 'Client de passage';
  const credit = Number(ticket.client?.credit ?? 0);
  const vide = ticket.lignes.length === 0;
  const [entierNet, decNet] = fmtMoney(tot.net).split(',');

  const outils: { label: string; kbd?: string; icon: NomIcone; tone: 'neutre' | 'retour' | 'danger'; onClick: () => void; disabled?: boolean; pressed?: boolean }[] = [
    { label: 'Remise', kbd: 'F7', icon: 'pourcent', tone: 'neutre', onClick: () => setDialogue('remise'), disabled: vide },
    { label: 'Réimprimer', kbd: 'F9', icon: 'imprimante', tone: 'neutre', onClick: reimprimerDernier, disabled: !peutImprimer },
    { label: 'Ventes du jour', kbd: 'F10', icon: 'liste', tone: 'neutre', onClick: () => setDialogue('ventes') },
    { label: retour ? 'Quitter le retour' : 'Retour article', icon: 'retour', tone: 'retour', pressed: retour,
      onClick: () => majTicket((t) => ({ ...t, retour: !t.retour })), disabled: retour ? !peutVendre : !peutRetour },
    { label: 'Arrêter la caisse', icon: 'cadenas', tone: 'neutre', onClick: () => setDialogue('caisse'), disabled: !peutCaisse },
    { label: 'Annuler le ticket', kbd: 'F4', icon: 'croix', tone: 'danger', onClick: () => setDialogue('annuler'), disabled: vide },
  ];

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* ░░ Barre de caisse (60 px) ░░ */}
      <header className="h-[60px] flex-none flex items-center gap-5 px-5 bg-surface border-b border-line-soft">
        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] rounded-md bg-brand-700 text-white font-extrabold text-base leading-[1.45] flex items-center justify-center">GC</div>
          <div className="flex flex-col">
            <span className="font-extrabold text-[15px] leading-[1.1]">Vente au comptoir</span>
            <span className="text-xs leading-[1.45] font-semibold text-ink-muted">Dossier {dossier}</span>
          </div>
        </div>

        <nav aria-label="Tickets en attente" className="flex gap-1.5 ml-3">
          {tickets.map((t, i) => {
            const sel = i === actif;
            const n = t.lignes.length;
            const plein = sel ? (t.retour ? 'var(--pos-return)' : 'var(--brand-700)') : undefined;
            return (
              <button key={i} type="button" onClick={() => setActif(i)} aria-current={sel ? 'true' : undefined} title={`Ctrl+${i + 1}`}
                      className={`h-[38px] px-3 rounded-md text-[12.5px] flex items-center gap-2 ${sel ? 'text-white font-bold' : n > 0 ? 'bg-surface border border-line text-ink-label font-bold' : 'bg-transparent border border-dashed border-line font-semibold text-ink-muted'}`}
                      style={sel ? { background: plein, border: `1px solid ${plein}` } : undefined}>
                {t.retour && <Icon name="retour" size={14} strokeWidth={2.2} />}
                Ticket {i + 1}
                {n > 0 && (
                  <span className={`money text-xs leading-[1.45] px-1.5 py-px rounded-md ${sel ? 'bg-white/[.22]' : 'bg-brand-50 text-brand-text'}`}>{n}</span>
                )}
              </button>
            );
          })}
          <span className="self-center text-xs leading-[1.45] font-semibold ml-1 text-ink-muted">Ctrl + 1…5</span>
        </nav>

        <div className="ml-auto flex items-center gap-4 text-sm leading-[1.45] font-semibold text-ink-label">
          <span className="flex items-center gap-[7px]">
            <span className={`w-2 h-2 rounded-full ${enLigne ? 'bg-success-solid' : 'bg-danger-solid'}`} />
            <span role="status" title={connexion.detail}>{enLigne ? 'Agent connecté' : connexion.libelle}</span>
          </span>
          <button type="button" onClick={() => setOptions({ ticketAuto: !options.ticketAuto })} aria-pressed={options.ticketAuto}
                  title="Impression automatique du ticket après l’encaissement (F2)"
                  className={`flex items-center gap-[7px] ${options.ticketAuto ? '' : 'text-ink-muted line-through'}`}>
            <Icon name="imprimante" size={16} />Ticket auto
          </button>
          <span className="flex items-center gap-[7px] px-2.5 py-[5px] rounded-md bg-bg border border-line-soft">
            <Icon name="utilisateur" size={16} />Caissier : <b className="text-ink">{caissier}</b>
          </span>
          <span className="money text-md leading-[1.45] font-bold text-ink">{heure}</span>
          <Link to="/ventes" className="h-9 px-3.5 rounded-md border border-line text-brand-text font-bold flex items-center hover:border-brand-300">
            Quitter la caisse
          </Link>
        </div>
      </header>

      {bloque && (
        <div role="alert" className="flex-none flex items-center gap-3 px-5 py-2 text-[12.5px] font-bold text-white" style={{ background: 'var(--pos-alert)' }}>
          <span className="flex-1">
            {connexion.libelle} — l’encaissement est suspendu. Les tickets en attente sont conservés sur ce poste.
            <span className="font-medium opacity-90"> {connexion.detail}</span>
          </span>
          <button type="button" onClick={() => void sonderReseau()}
                  className="flex-none h-7 px-3 rounded-md border border-white/60 hover:bg-white/15">Réessayer</button>
        </div>
      )}

      {/* ░░ Corps ░░ */}
      <div className="flex-1 min-h-0 grid gap-4 px-5 pt-4 pb-[18px]" style={{ gridTemplateColumns: 'minmax(0,1fr) 404px' }}>
        {/* Colonne saisie */}
        <section className="flex flex-col gap-3 min-h-0">
          {retour && (
            <div className="flex-none flex items-center gap-2.5 px-3.5 py-2.5 rounded-md text-base leading-[1.45] font-bold"
                 style={{ background: 'var(--pos-return-soft)', border: '1px solid var(--pos-return-line)', color: 'var(--pos-return-deep)' }}>
              <Icon name="retour" size={18} strokeWidth={2.2} />
              Mode retour — les articles scannés reviennent en stock et le montant est à rembourser au client.
              <button type="button" disabled={!peutVendre} onClick={() => majTicket((t) => ({ ...t, retour: false }))}
                      className="ml-auto h-8 px-3 rounded-lg bg-surface text-sm leading-[1.45] font-bold disabled:opacity-50"
                      style={{ border: '1px solid var(--pos-return-line)', color: 'var(--pos-return-deep)' }}>
                Revenir à la vente
              </button>
            </div>
          )}
          {ticket.incertain && (
            <div role="status" className="flex-none flex items-center gap-2.5 px-3.5 py-2.5 rounded-md text-sm leading-[1.45] font-semibold bg-warning-soft text-warning-text border border-warning-line">
              <Icon name="alert" size={18} />
              Le dernier encaissement de ce ticket ({fmtMoney(ticket.incertain.net)} DA) n’a pas reçu de réponse : les ventes du jour seront vérifiées avant de réencaisser.
            </div>
          )}

          <ChampScan id={ID_SCAN} retour={retour} onArticle={ajouter} niveauPrix={options.niveauPrix} />

          <LignesComptoir lignes={ticket.lignes} selection={selection} onSelect={setSelection}
                          patch={patch} remove={supprimer} retour={retour}
                          articles={tot.articles}
                          tuilesMasquees={!options.tuiles} onAfficherTuiles={() => setOptions({ tuiles: true })} />

          {options.tuiles && (
            <TuilesArticles niveau={options.niveauPrix} onArticle={ajouter} onMasquer={() => setOptions({ tuiles: false })} />
          )}
        </section>

        {/* Colonne encaissement */}
        <aside className="flex flex-col gap-3 min-h-0 overflow-auto">
          <div className="flex-none rounded-lg text-white px-5 pt-[18px] pb-4 flex flex-col gap-1.5 shadow-card"
               style={{ background: retour ? 'var(--pos-return-deep)' : 'var(--brand-900)' }}>
            <div className="flex justify-between text-xs leading-[1.45] font-bold tracking-[1.4px] uppercase opacity-85">
              <span>{retour ? 'À rembourser' : 'Net à payer'}</span><span>Ticket {actif + 1}</span>
            </div>
            <div className="money text-pos font-extrabold leading-[1.05] text-right tracking-[-1px]" aria-live="polite">
              {entierNet},{decNet}<span className="text-2xl leading-[1.05] font-bold ml-2 opacity-80">DA</span>
            </div>
            <div className="flex justify-between text-sm leading-[1.45] font-semibold opacity-90 pt-2 border-t border-white/[.18]">
              <span>Total HT <b className="money">{fmtMoney(tot.ht * (1 - (ticket.remisePct || 0) / 100))}</b></span>
              <span>TVA <b className="money">{fmtMoney(tot.tva * (1 - (ticket.remisePct || 0) / 100))}</b></span>
              <span>Remise <b className="money">{fmtQte(ticket.remisePct)} %</b></span>
            </div>
          </div>

          <div data-comptoir-client className="flex-none rounded-xl bg-surface border border-line-soft px-3.5 py-3 flex flex-col gap-2.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-brand-50 text-brand-text flex items-center justify-center flex-none">
                <Icon name="utilisateur" size={20} />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-xs leading-[1.45] font-bold text-ink-muted">CLIENT</span>
                <span className="text-md leading-[1.45] font-bold truncate">{clientNom}</span>
              </div>
              {ticket.client ? (
                <>
                  <div className="flex flex-col items-end">
                    <span className="text-xs leading-[1.45] font-bold text-ink-muted">CRÉDIT</span>
                    <span className={`money text-md leading-[1.45] font-bold ${credit > 0 ? 'text-warning-text' : ''}`}>{fmtMoney(credit)}</span>
                  </div>
                  <button type="button" onClick={() => setClient(null)} aria-label="Revenir au client de passage"
                          className="w-[38px] h-[38px] rounded-[9px] border border-line flex items-center justify-center text-ink-label hover:border-brand-300">
                    <Icon name="croix" size={16} />
                  </button>
                </>
              ) : (
                <button type="button" onClick={focusClient}
                        className="h-[38px] px-3 rounded-[9px] border border-line bg-surface text-brand-text font-bold text-[12.5px] flex items-center gap-2 hover:border-brand-300">
                  Choisir <Kbd>F8</Kbd>
                </button>
              )}
            </div>
            {choixClient && !ticket.client && <ClientSearch value={null} onSelect={setClient} />}
          </div>

          <button type="button" onClick={() => demanderValidation('dialogue')} disabled={vide || creation || verification}
                  className="flex-none h-[78px] rounded-[14px] text-white flex items-center gap-3.5 px-5 shadow-[0_4px_12px_rgb(15_26_46/.12)] disabled:opacity-45 disabled:cursor-not-allowed hover:brightness-[1.06]"
                  style={{ background: retour ? 'var(--pos-return)' : 'var(--pos-cash)' }}>
            <Icon name={retour ? 'retour' : 'especes'} size={28} />
            <span className="flex flex-col items-start">
              <span className="text-2xl leading-[1.45] font-extrabold">{creation ? 'Enregistrement…' : retour ? 'Valider le retour' : 'Encaisser'}</span>
              <span className="text-sm leading-[1.45] font-semibold opacity-90">{retour ? 'Remise en stock + bon de retour' : 'Espèces · montant, monnaie à rendre'}</span>
            </span>
            <span className="ml-auto [&>kbd]:text-base [&>kbd]:leading-none [&>kbd]:font-extrabold [&>kbd]:px-[9px] [&>kbd]:py-1 [&>kbd]:rounded-[7px]"><Kbd tone="inverse">F2</Kbd></span>
          </button>

          {!retour && (
            <div className="flex-none grid gap-2" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <button type="button" onClick={() => demanderValidation('avecTicket')} disabled={vide || creation || verification || !peutImprimer}
                      className="h-[52px] rounded-[11px] border border-brand-700 bg-brand-50 text-brand-text font-bold text-base leading-[1.45] flex items-center justify-between px-3.5 disabled:opacity-45">
                Encaisser + ticket <Kbd tone="brand">F12</Kbd>
              </button>
              <button type="button" onClick={() => demanderValidation('sansTicket')} disabled={vide || creation || verification}
                      className="h-[52px] rounded-[11px] border border-line bg-surface text-ink-label font-bold text-base leading-[1.45] flex items-center justify-between px-3.5 disabled:opacity-45">
                Sans ticket <Kbd>F11</Kbd>
              </button>
            </div>
          )}

          <div className="flex-none grid gap-2" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {outils.map((o) => {
              const couleur = o.tone === 'retour' ? 'var(--pos-return-deep)' : o.tone === 'danger' ? 'var(--pos-alert)' : 'var(--text)';
              const bord = o.tone === 'retour' ? 'var(--pos-return-line)' : o.tone === 'danger' ? 'var(--pos-alert-line)' : 'var(--line)';
              return (
                <button key={o.label} type="button" onClick={o.onClick} disabled={o.disabled} aria-pressed={o.pressed}
                        className="relative h-[70px] rounded-[11px] bg-surface flex flex-col justify-between items-start px-2.5 py-[9px] text-left hover:brightness-[.98] disabled:opacity-45 disabled:cursor-not-allowed"
                        style={{ border: `1px solid ${bord}`, color: couleur, background: o.pressed ? 'var(--pos-return-soft)' : undefined }}>
                  <Icon name={o.icon} size={20} />
                  <span className="text-sm font-bold leading-[1.15]">{o.label}</span>
                  {o.kbd && <span className="absolute top-2 right-2"><Kbd>{o.kbd}</Kbd></span>}
                </button>
              );
            })}
          </div>

          <div className="mt-auto flex-none rounded-xl bg-surface border border-line-soft px-3.5 py-2.5 flex flex-col gap-1.5 text-sm leading-[1.45] text-ink-label">
            <div className="flex justify-between gap-3"><span>Dernier ticket</span>
              <b className="money text-ink">{dernier ? `N° ${dernier.numero} · ${fmtMoney(dernier.net)}` : '—'}</b></div>
            <div className="flex justify-between gap-3"><span>Caisse du jour</span>
              <b className="money text-ink">{ventesJour.length} · {fmtMoney(totalJour)}</b></div>
            <label className="flex justify-between items-center gap-3"><span>Tarif appliqué</span>
              <select value={options.niveauPrix} onChange={(e) => setOptions({ niveauPrix: Number(e.target.value) as NiveauPrix })}
                      className="bg-transparent text-ink font-bold text-right outline-none cursor-pointer">
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>Prix de vente {n}</option>)}
              </select>
            </label>
          </div>
        </aside>
      </div>

      {dialogue === 'paiement' && (
        <PaiementDialog net={tot.net} ticket={actif + 1} clientNom={clientNom} articles={tot.articles}
                        creditPossible={!!ticket.client} imprimerDefaut={options.ticketAuto && peutImprimer}
                        imprimante={imprimante} enCours={creation || verification}
                        onValider={(r) => void enregistrer(r)} onClose={() => setDialogue(null)} />
      )}
      {dialogue === 'retour' && (
        <ConfirmDialog title="Valider le retour"
                       message={`Créer un bon de retour de ${fmtMoney(tot.net)} DA (${ticket.lignes.length} ligne(s)) pour ${clientNom} ? Les articles reviennent en stock ; remboursez le client en caisse.`}
                       confirmLabel="Valider le retour" loading={creation}
                       onConfirm={() => void enregistrer({ recu: 0, regle: 0, rendu: 0, credit: false, imprimer: options.ticketAuto && peutImprimer })}
                       onCancel={() => setDialogue(null)} />
      )}
      {dialogue === 'montant' && (() => {
        const l = ticket.lignes.find((x) => x.key === selection);
        return l ? (
          <MontantDialog ligne={l} onClose={() => setDialogue(null)}
                         onValider={(q) => { patch(l.key, { qte: q }); setDialogue(null); setTimeout(focusScan, 0); }} />
        ) : null;
      })()}
      {dialogue === 'remise' && (
        <RemiseDialog pct={ticket.remisePct} baseTtc={tot.net + tot.remGlob}
                      onValider={(pct) => { majTicket((t) => ({ ...t, remisePct: pct })); setDialogue(null); }}
                      onClose={() => setDialogue(null)} />
      )}
      {dialogue === 'annuler' && (
        <ConfirmDialog title="Annuler le ticket" danger confirmLabel="Annuler le ticket"
                       message={`Supprimer les ${ticket.lignes.length} ligne(s) du ticket ${actif + 1} ? Rien n’a encore été enregistré.`}
                       onConfirm={() => { viderTicket(); setDialogue(null); setTimeout(focusScan, 0); }}
                       onCancel={() => setDialogue(null)} />
      )}
      {dialogue === 'ventes' && (
        <VentesJourDialog onReimprimer={(id) => void imprimer(id)} onClose={() => setDialogue(null)} />
      )}
      {dialogue === 'caisse' && (
        <ArreteCaisseModal onClose={() => setDialogue(null)} onDone={() => { setDialogue(null); void refetchJour(); }} />
      )}
      {doublon && (
        <ConfirmDialog danger title="Ticket déjà enregistré ?"
                       confirmLabel="Encaisser quand même" cancelLabel="Ne pas encaisser"
                       message={(
                         <>
                           <p>
                             La tentative précédente n’a pas reçu de réponse, mais le ticket <strong>{doublon.vente.numero}</strong> de{' '}
                             <strong className="money">{fmtMoney(doublon.vente.net_a_payer)} DA</strong> a été enregistré depuis.
                           </p>
                           <p className="mt-2">
                             S’il s’agit de cette vente, n’encaissez pas une seconde fois (le stock serait décrémenté deux fois) :
                             annulez ce ticket (F4) et réimprimez-le depuis les ventes du jour (F10).
                           </p>
                         </>
                       )}
                       onCancel={() => setDoublon(null)}
                       onConfirm={() => {
                         const p = doublon.paiement;
                         majTicketA(actif, (t) => ({ ...t, incertain: undefined }));
                         setDoublon(null);
                         void enregistrer(p, true);
                       }} />
      )}
      {apercu && <ImprimerDocument demande={apercu} onClose={() => setApercu(null)} />}
    </div>
  );
}

/** Heure courante HH:MM, rafraîchie chaque minute pleine. */
function useHorloge() {
  const fmt = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const [h, setH] = useState(fmt);
  useEffect(() => {
    const t = setInterval(() => setH(fmt()), 15_000);
    return () => clearInterval(t);
  }, []);
  return h;
}
