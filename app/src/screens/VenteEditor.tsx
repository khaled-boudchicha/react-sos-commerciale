import { useEffect, useMemo, useRef, useState } from 'react';
import { messageEchecCreation, resultatIncertain } from '../api/erreurs';
import { gql, useMutation, useQuery } from '@apollo/client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { VENTE, UPDATE_VENTE, ADD_REGLEMENT_CLIENT } from '../api/queries';
import { Article, Client, TYPES_VENTE, Vente, VENTE_TYPE_CODE } from '../api/types';
import { useSession } from '../store/session';
import { useDroits } from '../lib/droits';
import { fmtMoney, fmtQte, isoToday, isoDate } from '../lib/format';
import { DocBadge, DOC_TONE, PageHeader, Tabs, type Crumb } from '../components/ui/atoms';
import { Button } from '../components/ui/Button';
import { Card, TotalsPanel } from '../components/ui/Card';
import { Field, Select, TextInput } from '../components/ui/Field';
import { Alert, Loading } from '../components/ui/States';
import ArticleSearch from '../components/ArticleSearch';
import ClientSearch from '../components/ClientSearch';
import LignesTable from '../components/document/LignesTable';
import { LigneDoc, ligneDepuisArticle, totauxDocument } from '../components/document/lignesDocument';
import { lignesDepuisPiece, lignesPourServeur } from '../components/document/prefillPiece';
import { useToast } from '../components/ui/Toast';
import { calculerTimbre, estEspeces, TYPES_TIMBRE } from '../lib/timbre';
import RemiseGlobale from '../components/document/RemiseGlobale';

const CREATE_VENTE = gql`
  mutation CreateVente($input: JSON!) { createVente(input: $input) }
`;
const MODES = gql`
  query ModesPayementEditor { modesPayement }
`;

type TypeVente = (typeof TYPES_VENTE)[number]['code'];

/**
 * Éditeur de pièce de vente, trois modes :
 *  - création (`?type=FA`) ;
 *  - duplication (`?from=<id>`) : nouvelle pièce reprenant les lignes ;
 *  - modification (`?edit=<id>`) : updateVente, numéro/type/règlements conservés.
 */
export default function VenteEditor() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const { dossierUser } = useSession();
  const { peutDoc } = useDroits();

  const editId = params.get('edit');
  const enEdition = !!editId;
  const sourceId = editId ?? params.get('from');

  // Types proposés à la création : seulement ceux que l'utilisateur peut créer
  const permis = TYPES_VENTE.filter((t) => peutDoc('vente', t.code, 'creer'));
  const [typeChoisi, setType] = useState<TypeVente>((params.get('type') as TypeVente) || 'FA');
  const [client, setClient] = useState<Client | null>(null);
  const [date, setDate] = useState(isoToday());
  const [mode, setMode] = useState('Espece');
  const [remiseGlobale, setRemiseGlobale] = useState(0);
  const [observation, setObservation] = useState('');
  // Délai de paiement en jours (vide = délai par défaut du dossier, fixé par le serveur)
  const [delai, setDelai] = useState('');
  const [timbreChoix, setTimbreChoix] = useState<boolean | null>(null);
  const [timbreInitial, setTimbreInitial] = useState(false);
  const [lignes, setLignes] = useState<LigneDoc[]>([]);
  const [montantRecu, setMontantRecu] = useState('');
  const [error, setError] = useState<string | null>(null);
  const montantRecuRef = useRef<HTMLInputElement>(null);

  const { data: refs } = useQuery(MODES);
  const modes: any[] = Array.isArray(refs?.modesPayement) ? refs.modesPayement : [];
  const [create, { loading: creating }] = useMutation(CREATE_VENTE);
  const [update, { loading: updating }] = useMutation(UPDATE_VENTE);
  const [addReglement] = useMutation(ADD_REGLEMENT_CLIENT);
  const saving = creating || updating;

  // Pièce source (duplication ou modification) — toujours relue du serveur
  const { data: sourceData, error: sourceError } = useQuery(VENTE, {
    variables: { id: Number(sourceId) }, skip: !sourceId, fetchPolicy: 'network-only',
  });
  const src: Vente | undefined = sourceData?.vente ?? undefined;
  const typeEdition = enEdition && src ? (VENTE_TYPE_CODE[Number(src.type)] as TypeVente | undefined) : undefined;

  // Type effectif : verrouillé en modification ; sinon le choix s'il est permis, à défaut le premier permis
  const type: TypeVente | undefined = enEdition
    ? typeEdition
    : (permis.some((t) => t.code === typeChoisi) ? typeChoisi : permis[0]?.code);

  const prefaitRef = useRef(false);
  useEffect(() => {
    if (prefaitRef.current || !src) return;
    prefaitRef.current = true;
    setLignes(lignesDepuisPiece(src));
    if (src.code_cli) setClient({ code: src.code_cli, nom: src.raison ?? src.code_cli, raison: src.raison } as unknown as Client);
    if (src.mode_payement) setMode(String(src.mode_payement));
    // `remise` est le montant HT de la remise globale ; le % est dans `remise_p`
    setRemiseGlobale(Number(src.remise_p) || 0);
    if (src.observation) setObservation(String(src.observation));
    if (src.delai_reglement != null && Number(src.delai_reglement) > 0) setDelai(String(src.delai_reglement));
    setTimbreInitial(Number(src.is_timbre) === 1);
    if (enEdition) {
      if (src.date) setDate(isoDate(src.date));
    } else {
      toast.info(`Pièce ${src.numero ?? ''} dupliquée — vérifiez puis enregistrez.`);
    }
  }, [src, enEdition, toast]);

  function addArticle(a: Article) {
    setLignes((ls) => {
      // Même article déjà présent → incrémente la quantité (comportement comptoir)
      const idx = ls.findIndex((l) => l.code_article === a.code);
      if (idx >= 0) {
        const next = [...ls];
        next[idx] = { ...next[idx], qte: next[idx].qte + 1 };
        return next;
      }
      return [...ls, ligneDepuisArticle(a, 'vente')];
    });
  }

  function patchLigne(key: number, patch: Partial<LigneDoc>) {
    setLignes((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLigne(key: number) {
    setLignes((ls) => ls.filter((l) => l.key !== key));
  }

  // Mêmes formules que l'agent (createVente) : ht = qte×prix×(1−rem/100) ; ttc = ht×(1+tva/100) ; remise globale sur le net
  const totauxBase = useMemo(() => totauxDocument(lignes, remiseGlobale), [lignes, remiseGlobale]);
  // Droit de timbre (quittance en espèces) : ajouté au net à payer. `timbreChoix` = choix
  // explicite de l'utilisateur ; null = règle automatique (création) / état conservé (modification).
  const timbreApplicable = !!type && TYPES_TIMBRE.includes(type) && estEspeces(mode);
  const timbreActif = timbreChoix ?? (enEdition ? timbreInitial && timbreApplicable : timbreApplicable);
  const timbre = timbreActif ? calculerTimbre(totauxBase.net) : 0;
  const totaux = useMemo(() => ({ ...totauxBase, net: totauxBase.net + timbre }), [totauxBase, timbre]);

  async function save(recuOverride?: number) {
    setError(null);
    if (lignes.length === 0) { setError('Ajoutez au moins une ligne.'); return; }
    if (enEdition) { await enregistrerModification(); return; }
    if (!dossierUser) { setError('Utilisateur dossier manquant — reconnectez-vous.'); return; }
    if (!type) return;
    try {
      const { data } = await create({
        variables: {
          input: {
            type_doc: type,
            code_cli: client?.code ?? undefined,
            date,
            mode_payement: mode || undefined,
            remise: remiseGlobale || 0,
            observation: observation || undefined,
            delai_reglement: delai === '' ? undefined : Math.max(0, Number(delai) || 0),
            timbre: timbreChoix ?? undefined,
            user_id: Number(dossierUser.id),
            user_name: String(dossierUser.username),
            lignes: lignesPourServeur(lignes),
          },
        },
      });
      const created = data?.createVente;
      if (!created?.id) { navigate('/ventes'); return; }

      // Règlement immédiat (encaissement de la pièce créée), plafonné au net à payer
      const recu = Math.min(recuOverride ?? (parseFloat(montantRecu) || 0), Number(created.net_a_payer ?? totaux.net));
      if (recu > 0) {
        try {
          await addReglement({
            // Encaissé dans la caisse par défaut de l'utilisateur (comme le desktop)
            variables: { input: { vente_id: created.id, montant: recu, date, mode_payement: mode || undefined,
              compte: dossierUser.compte ?? undefined, compte_id: dossierUser.compte_id ?? undefined } },
          });
        } catch (e: any) {
          // La pièce existe : on informe sans bloquer la navigation
          setError(`Pièce ${created.numero} créée, mais règlement échoué : ${e.message ?? e}`);
          toast.error(`Pièce ${created.numero} créée, mais règlement échoué.`);
          navigate(`/ventes/${created.id}`);
          return;
        }
      }
      toast.success(`Pièce ${created.numero} enregistrée${recu > 0 ? ` · encaissé ${fmtMoney(recu)}` : ''}.`);
      navigate(`/ventes/${created.id}`);
    } catch (e: unknown) {
      const m = messageEchecCreation(e, 'la liste des ventes');
      setError(m);
      toast.error(resultatIncertain(e) ? m : `Enregistrement échoué : ${m}`);
    }
  }

  // Modification : le serveur garde numéro, type et règlements, et refuse si le
  // nouveau net devient inférieur au déjà réglé (message affiché tel quel).
  async function enregistrerModification() {
    try {
      const { data } = await update({
        variables: {
          id: Number(editId),
          input: {
            // null = pièce ramenée au comptoir (undefined signifierait « client inchangé »)
            code_cli: client?.code ?? null,
            date,
            mode_payement: mode || undefined,
            remise: remiseGlobale || 0,
            observation: observation || undefined,
            delai_reglement: delai === '' ? undefined : Math.max(0, Number(delai) || 0),
            timbre: timbreChoix ?? undefined,
            lignes: lignesPourServeur(lignes),
          },
        },
      });
      toast.success(`Pièce ${data?.updateVente?.numero ?? src?.numero ?? ''} modifiée.`);
      navigate(`/ventes/${editId}`);
    } catch (e: any) {
      setError(e.message ?? 'Erreur à l’enregistrement.');
      toast.error(`Modification échouée : ${e.message ?? 'erreur'}`);
    }
  }

  // Raccourcis Delphi : F2 = recherche article, F3 = recherche client, F10 = encaisser tout
  useEffect(() => {
    function focusPlaceholder(prefixe: string) {
      const el = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').startsWith(prefixe));
      if (el) { el.focus(); (el as HTMLInputElement).select?.(); }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'F2') { e.preventDefault(); focusPlaceholder('Article'); return; }
      if (e.key === 'F3') { e.preventDefault(); focusPlaceholder('Client'); return; }
      if (e.key === 'F10' && !enEdition) {
        e.preventDefault();
        if (lignes.length > 0 && !saving) {
          setMontantRecu(String(totaux.net));
          void save(totaux.net);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lignes, saving, totaux.net, client, date, mode, remiseGlobale, observation, delai, dossierUser, enEdition, type]);

  const retour = enEdition ? `/ventes/${editId}` : '/ventes';
  const titre = enEdition ? `Modifier ${src ? `${src.type_doc} ${src.numero}` : 'la pièce'}` : 'Nouvelle pièce de vente';

  // Garde-fous : droits et pièce non modifiable (BL facturé, facture groupée)
  let blocage: string | null = null;
  if (enEdition) {
    if (sourceError) blocage = sourceError.message;
    else if (src && typeEdition && !peutDoc('vente', typeEdition, 'modifier')) blocage = 'Accès refusé : vous n’avez pas le droit de modifier ce type de pièce.';
    else if (src && src.modifiable === false) blocage = 'Cette pièce ne peut plus être modifiée (bon de livraison facturé ou facture issue d’un regroupement).';
  } else if (permis.length === 0) {
    blocage = 'Accès refusé : vous n’avez le droit de créer aucun type de pièce de vente.';
  }
  // Fil d'Ariane : Ventes › (pièce modifiée) › titre
  const breadcrumb: Crumb[] = [
    { label: 'Ventes', to: '/ventes' },
    ...(enEdition && src ? [{ label: `${src.type_doc} ${src.numero}`, to: `/ventes/${editId}` }] : []),
    { label: enEdition ? 'Modification' : 'Nouvelle pièce' },
  ];

  if (blocage || !type) {
    return (
      <div className="flex flex-col gap-3.5">
        <PageHeader title={titre} backTo={retour} breadcrumb={breadcrumb} />
        {blocage
          ? <Alert tone="danger">{blocage}</Alert>
          : <Loading />}
      </div>
    );
  }

  const recuSaisi = parseFloat(montantRecu) || 0;
  const rendu = recuSaisi - totaux.net;

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title={titre} backTo={retour} backLabel="Annuler" breadcrumb={breadcrumb}
                  meta={<DocBadge code={type} />} />

      {/* En modification, le type est figé (seule la pièce courante est affichée) */}
      <Tabs value={type} onChange={setType} variant="underline" label="Type de pièce"
            options={(enEdition ? TYPES_VENTE.filter((t) => t.code === type) : permis)
              .map((t) => ({ ...t, tone: DOC_TONE[t.code] }))} />

      {error && <Alert tone="danger">{error}</Alert>}

      <Card>
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 items-start">
          <Field label="Client" hint="F3">
            <ClientSearch value={client} onSelect={setClient} />
          </Field>
          <Field label="Date" required>
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Mode de paiement">
            <Select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="Espece">Espèces</option>
              {modes.map((m: any, i) => {
                const v = String(m.nom ?? m.name ?? m.mode ?? m);
                return v.toLowerCase() === 'espece' ? null : <option key={i} value={v}>{v}</option>;
              })}
            </Select>
          </Field>
          <RemiseGlobale pct={remiseGlobale} onPct={setRemiseGlobale} baseTtc={totaux.net + totaux.remGlob} />
        </div>
      </Card>

      <div className="grid grid-cols-[1fr_300px] gap-3.5 items-start">
        <div className="flex flex-col gap-2.5 min-w-0">
          <ArticleSearch onSelect={addArticle} autoFocus />
          <LignesTable sens="vente" lignes={lignes} patch={patchLigne} remove={removeLigne} />
          <div className="grid grid-cols-[1fr_170px] gap-3">
            <Field label="Note">
              <TextInput value={observation} onChange={(e) => setObservation(e.target.value)} />
            </Field>
            <Field label="Délai de paiement (j)">
              <TextInput type="number" min={0} value={delai} onChange={(e) => setDelai(e.target.value)} placeholder="défaut"
                         mono align="right" title="Échéance de paiement = date de la pièce + délai" />
            </Field>
          </div>
        </div>

        <TotalsPanel
          className="sticky top-4"
          rows={[
            { label: 'Total HT', value: totaux.ht },
            { label: 'Remises lignes', value: -totaux.remLignes },
            { label: 'TVA', value: totaux.tva },
            { label: `Remise globale (${fmtQte(remiseGlobale)} %)`, value: -totaux.remGlob },
            {
              label: (
                <label className="inline-flex items-center gap-1.5 cursor-pointer"
                       title="Droit de timbre sur les paiements en espèces (barème LF 2025)">
                  <input type="checkbox" checked={timbreActif} disabled={!timbreApplicable && !timbreActif}
                         onChange={(e) => setTimbreChoix(e.target.checked)}
                         className="h-4 w-4 cursor-pointer accent-[var(--brand-700)]" />
                  Droit de timbre{!timbreApplicable ? ' (espèces uniquement)' : ''}
                </label>
              ),
              value: timbre,
              hidden: !(!!type && TYPES_TIMBRE.includes(type)),
            },
          ]}
          total={{ label: 'Net à payer', value: totaux.net }}
          after={(
            <div className="flex flex-col gap-2.5">
              {!enEdition && (<>
                <Field label="Montant reçu (règlement immédiat)">
                  <div className="flex gap-1.5">
                    <TextInput ref={montantRecuRef} type="number" min="0" step="0.01" value={montantRecu}
                               onChange={(e) => setMontantRecu(e.target.value)} placeholder="0,00"
                               mono align="right" className="flex-1 min-w-0" />
                    <Button onClick={() => setMontantRecu(String(totaux.net))} title="Reçu = net à payer">
                      Tout
                    </Button>
                  </div>
                </Field>
                {recuSaisi > 0 && (rendu >= 0 ? (
                  <div className="flex justify-between items-center rounded-sm px-2.5 py-1.5 text-sm font-bold bg-success-soft text-success-text">
                    <span>À rendre</span>
                    <span className="money text-md">{fmtMoney(rendu)} DA</span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center rounded-sm px-2.5 py-1.5 text-sm font-bold bg-warning-soft text-warning-text">
                    <span>Reste dû</span>
                    <span className="money text-md">{fmtMoney(-rendu)} DA</span>
                  </div>
                ))}
              </>)}
              <Button variant="primary" size="lg" block icon="save" loading={saving}
                      onClick={() => void save()} disabled={saving || lignes.length === 0}>
                {saving ? 'Enregistrement…' : enEdition ? 'Enregistrer les modifications' : 'Enregistrer la pièce'}
              </Button>
              {!enEdition && (
                <Button variant="accent" size="lg" block icon="cash" kbd="F10"
                        onClick={() => { setMontantRecu(String(totaux.net)); void save(totaux.net); }}
                        disabled={saving || lignes.length === 0}>
                  Encaisser tout
                </Button>
              )}
              <div className="flex items-center justify-center gap-1.5 text-xs text-ink-muted text-center">
                <DocBadge code={type} /> {enEdition ? 'numéro et règlements conservés' : 'numérotée automatiquement par le serveur'}
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}
