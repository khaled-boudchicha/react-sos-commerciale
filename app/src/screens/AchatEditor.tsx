import { useEffect, useMemo, useRef, useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ACHAT, UPDATE_ACHAT, ADD_REGLEMENT_FOURNISSEUR } from '../api/queries';
import { Achat, ACHAT_TYPE_CODE, Article, Fournisseur, TYPES_ACHAT } from '../api/types';
import { useDroits } from '../lib/droits';
import { fmtMoney, fmtQte, isoToday, isoDate } from '../lib/format';
import { DocBadge, PageHeader, Tabs } from '../components/ui/atoms';
import ArticleSearch from '../components/ArticleSearch';
import FournisseurSearch from '../components/FournisseurSearch';
import LignesTable from '../components/document/LignesTable';
import { LigneDoc, ligneDepuisArticle, totauxDocument } from '../components/document/lignesDocument';
import { bandeauDanger, lignesDepuisPiece, lignesPourServeur } from '../components/document/prefillPiece';
import { useToast } from '../components/ui/Toast';
import RemiseGlobale from '../components/document/RemiseGlobale';
import { TYPES_AVEC_REGLEMENT } from '../components/document/ReglementsPiece';
import { useSession } from '../store/session';

const CREATE_ACHAT = gql`
  mutation CreateAchat($input: JSON!) { createAchat(input: $input) }
`;
const MODES = gql`
  query ModesPayementAchat { modesPayement }
`;

type TypeAchat = (typeof TYPES_ACHAT)[number]['code'];

/**
 * Éditeur de pièce d'achat : création, duplication (`?from=<id>`) ou
 * modification (`?edit=<id>`, updateAchat — numéro, type et règlements conservés).
 */
export default function AchatEditor() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const { peutDoc } = useDroits();

  const editId = params.get('edit');
  const enEdition = !!editId;
  const sourceId = editId ?? params.get('from');

  const permis = TYPES_ACHAT.filter((t) => peutDoc('achat', t.code, 'creer'));
  const [typeChoisi, setType] = useState<TypeAchat>((params.get('type') as TypeAchat) || 'BR');
  const [fournisseur, setFournisseur] = useState<Fournisseur | null>(null);
  const [date, setDate] = useState(isoToday());
  const [mode, setMode] = useState('Espece');
  const [remiseGlobale, setRemiseGlobale] = useState(0);
  const [observation, setObservation] = useState('');
  const [lignes, setLignes] = useState<LigneDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [montantPaye, setMontantPaye] = useState('');
  const dossierUser = useSession((s) => s.dossierUser);

  const { data: refs } = useQuery(MODES);
  const modes: any[] = Array.isArray(refs?.modesPayement) ? refs.modesPayement : [];
  const [create, { loading: creating }] = useMutation(CREATE_ACHAT);
  const [update, { loading: updating }] = useMutation(UPDATE_ACHAT);
  const [addReglement] = useMutation(ADD_REGLEMENT_FOURNISSEUR);
  const saving = creating || updating;

  // Pièce source (duplication ou modification)
  const { data: sourceData, error: sourceError } = useQuery(ACHAT, {
    variables: { id: Number(sourceId) }, skip: !sourceId, fetchPolicy: 'network-only',
  });
  const src: Achat | undefined = sourceData?.achat ?? undefined;
  const typeEdition = enEdition && src
    ? ((src.code_type ?? ACHAT_TYPE_CODE[Number(src.type)]) as TypeAchat | undefined)
    : undefined;

  const type: TypeAchat | undefined = enEdition
    ? typeEdition
    : (permis.some((t) => t.code === typeChoisi) ? typeChoisi : permis[0]?.code);
  const affecteStock = type === 'FA' || type === 'BR';
  // Paiement immédiat du fournisseur : seules les factures et réceptions portent des règlements
  const payable = !enEdition && !!type && TYPES_AVEC_REGLEMENT.includes(type);

  const prefaitRef = useRef(false);
  useEffect(() => {
    if (prefaitRef.current || !src) return;
    prefaitRef.current = true;
    setLignes(lignesDepuisPiece(src));
    const nom = src.fournisseur ?? src.raison ?? src.code_four;
    if (src.code_four) setFournisseur({ code: src.code_four, nom, raison: nom } as unknown as Fournisseur);
    if (src.mode_payement) setMode(String(src.mode_payement));
    // En achat, `remise` est déjà le pourcentage global
    setRemiseGlobale(Number(src.remise) || 0);
    if (src.observation) setObservation(String(src.observation));
    if (enEdition) {
      if (src.date) setDate(isoDate(src.date));
    } else {
      toast.info(`Pièce ${src.numero ?? ''} dupliquée — vérifiez puis enregistrez.`);
    }
  }, [src, enEdition, toast]);

  function addArticle(a: Article) {
    setLignes((ls) => {
      const idx = ls.findIndex((l) => l.code_article === a.code);
      if (idx >= 0) {
        const next = [...ls];
        next[idx] = { ...next[idx], qte: next[idx].qte + 1 };
        return next;
      }
      return [...ls, ligneDepuisArticle(a, 'achat')];
    });
  }

  function patchLigne(key: number, patch: Partial<LigneDoc>) {
    setLignes((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function removeLigne(key: number) {
    setLignes((ls) => ls.filter((l) => l.key !== key));
  }

  const totaux = useMemo(() => totauxDocument(lignes, remiseGlobale), [lignes, remiseGlobale]);

  // Raccourcis : F2 = recherche article, F3 = recherche fournisseur
  useEffect(() => {
    function focusPlaceholder(prefixe: string) {
      const el = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').startsWith(prefixe));
      if (el) { el.focus(); (el as HTMLInputElement).select?.(); }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'F2') { e.preventDefault(); focusPlaceholder('Article'); }
      if (e.key === 'F3') { e.preventDefault(); focusPlaceholder('Fournisseur'); }
      if (e.key === 'F10' && payable) {
        e.preventDefault();
        if (lignes.length > 0 && !saving) { setMontantPaye(String(totaux.net)); void save(totaux.net); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payable, lignes, saving, totaux.net, fournisseur, date, mode, remiseGlobale, observation, type]);

  async function save(payeOverride?: number) {
    setError(null);
    if (lignes.length === 0) { setError('Ajoutez au moins une ligne.'); return; }
    if (!type) return;
    const commun = {
      code_four: fournisseur?.code ?? undefined,
      date,
      mode_payement: mode || undefined,
      remise: remiseGlobale || 0,
      observation: observation || undefined,
      lignes: lignesPourServeur(lignes),
    };
    try {
      if (enEdition) {
        const { data } = await update({ variables: { id: Number(editId), input: commun } });
        toast.success(`Pièce ${data?.updateAchat?.numero ?? src?.numero ?? ''} modifiée.`);
        navigate(`/achats/${editId}`);
        return;
      }
      const { data } = await create({ variables: { input: {
        type_doc: type, ...commun,
        // Auteur de la pièce (colonnes UserID / User), comme en vente
        user_id: dossierUser ? Number(dossierUser.id) : undefined,
        user_name: dossierUser ? String(dossierUser.username) : undefined,
      } } });
      const created = data?.createAchat;
      // Paiement immédiat (plafonné au net), dans la caisse par défaut de l'utilisateur
      const paye = payable && created?.id
        ? Math.min(payeOverride ?? (parseFloat(montantPaye) || 0), Number(created.net_a_payer ?? totaux.net)) : 0;
      if (paye > 0) {
        try {
          await addReglement({
            variables: { input: { achat_id: created.id, montant: paye, date, mode_payement: mode || undefined,
              compte: dossierUser?.compte ?? undefined, compte_id: dossierUser?.compte_id ?? undefined } },
          });
        } catch (e: any) {
          // La pièce existe : on informe sans bloquer
          toast.error(`Pièce ${created.numero} créée, mais paiement échoué : ${e.message ?? e}`);
          navigate(`/achats/${created.id}`);
          return;
        }
      }
      toast.success(`Pièce ${created?.numero ?? ''} enregistrée${affecteStock ? ' · stock mis à jour' : ''}${paye > 0 ? ` · payé ${fmtMoney(paye)}` : ''}.`.replace('  ', ' '));
      if (created?.id) navigate(`/achats/${created.id}`);
      else navigate('/achats');
    } catch (e: any) {
      setError(e.message ?? 'Erreur à l’enregistrement.');
      toast.error(`${enEdition ? 'Modification' : 'Enregistrement'} échoué${enEdition ? 'e' : ''} : ${e.message ?? 'erreur'}`);
    }
  }

  const retour = enEdition ? `/achats/${editId}` : '/achats';
  const titre = enEdition ? `Modifier ${src ? `${src.type_doc} ${src.numero}` : 'la pièce'}` : "Nouvelle pièce d'achat";

  let blocage: string | null = null;
  if (enEdition) {
    if (sourceError) blocage = sourceError.message;
    else if (src && typeEdition && !peutDoc('achat', typeEdition, 'modifier')) blocage = 'Accès refusé : vous n’avez pas le droit de modifier ce type de pièce.';
    else if (src && src.modifiable === false) blocage = 'Cette pièce ne peut plus être modifiée.';
  } else if (permis.length === 0) {
    blocage = 'Accès refusé : vous n’avez le droit de créer aucun type de pièce d’achat.';
  }
  if (blocage || !type) {
    return (
      <div className="flex flex-col gap-3.5">
        <PageHeader title={titre}>
          <Link to={retour} className="text-[12px] font-bold text-brand-700">← Retour</Link>
        </PageHeader>
        {blocage
          ? <div className="text-[12px] rounded-md px-3 py-2" style={bandeauDanger}>{blocage}</div>
          : <div className="text-[12px] text-ink-muted">Chargement…</div>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title={titre}>
        <Link to={retour} className="text-[12px] font-bold text-brand-700">← Annuler</Link>
      </PageHeader>

      {/* En modification, le type est figé */}
      <Tabs value={type} onChange={setType}
            options={enEdition ? TYPES_ACHAT.filter((t) => t.code === type) : permis} />
      {!affecteStock && (
        <div className="text-[11px] text-ink-muted">Ce type de document n'affecte pas le stock (seuls Facture d'achat et Bon de réception le font).</div>
      )}

      {error && (
        <div className="text-[12px] rounded-md px-3 py-2" style={bandeauDanger}>{error}</div>
      )}

      <div className="bg-surface border border-line-soft rounded-md shadow-soft p-4 grid grid-cols-[2fr_1fr_1fr_1fr] gap-3">
        <label className="text-[11px] font-bold text-ink-label">Fournisseur
          <div className="mt-1 font-normal"><FournisseurSearch value={fournisseur} onSelect={setFournisseur} /></div>
        </label>
        <label className="text-[11px] font-bold text-ink-label">Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                 className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal" />
        </label>
        <label className="text-[11px] font-bold text-ink-label">Mode de paiement
          <select value={mode} onChange={(e) => setMode(e.target.value)}
                  className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal">
            <option value="Espece">Espèces</option>
            {modes.map((m: any, i) => {
              const v = String(m.nom ?? m.name ?? m.mode ?? m);
              return v.toLowerCase() === 'espece' ? null : <option key={i} value={v}>{v}</option>;
            })}
          </select>
        </label>
        <RemiseGlobale pct={remiseGlobale} onPct={setRemiseGlobale} baseTtc={totaux.net + totaux.remGlob} />
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-3.5 items-start">
        <div className="flex flex-col gap-2.5">
          <ArticleSearch onSelect={addArticle} autoFocus />
          <LignesTable sens="achat" lignes={lignes} patch={patchLigne} remove={removeLigne} />
          <label className="text-[11px] font-bold text-ink-label">Note
            <input value={observation} onChange={(e) => setObservation(e.target.value)}
                   className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink font-normal" />
          </label>
        </div>

        <div className="bg-surface border border-line-soft rounded-md shadow-soft overflow-hidden sticky top-4">
          <TotRow label="Total HT" value={totaux.ht} />
          <TotRow label="Remises lignes" value={-totaux.remLignes} />
          <TotRow label="TVA" value={totaux.tva} />
          <TotRow label={`Remise globale (${fmtQte(remiseGlobale)} %)`} value={-totaux.remGlob} />
          <div className="px-4 py-3.5 flex justify-between items-center text-white font-extrabold" style={{ background: 'var(--gradient-hero)' }}>
            <span>Net à payer</span>
            <span className="money text-[16px]">{fmtMoney(totaux.net)} DA</span>
          </div>
          <div className="p-3 flex flex-col gap-2">
            {payable && (<>
              <label className="text-[11px] font-bold text-ink-label">
                Montant payé (paiement immédiat)
                <div className="flex gap-1.5 mt-1">
                  <input type="number" min="0" step="0.01" value={montantPaye}
                         onChange={(e) => setMontantPaye(e.target.value)} placeholder="0,00"
                         className="flex-1 min-w-0 border border-line rounded-sm px-3 py-2 bg-surface text-ink money text-right font-normal" />
                  <button onClick={() => setMontantPaye(String(totaux.net))}
                          className="px-3 rounded-sm border border-line text-[11px] font-bold text-ink-label">Tout</button>
                </div>
              </label>
              {(parseFloat(montantPaye) || 0) > 0 && (
                <div className="flex justify-between items-center px-1 text-[12px] font-bold"
                     style={{ color: totaux.net - (parseFloat(montantPaye) || 0) > 0.009 ? 'var(--warning)' : 'var(--success)' }}>
                  <span>Reste à payer</span>
                  <span className="money text-[14px]">{fmtMoney(Math.max(0, totaux.net - (parseFloat(montantPaye) || 0)))} DA</span>
                </div>
              )}
            </>)}
            <button onClick={() => void save()} disabled={saving || lignes.length === 0}
                    className="rounded-md py-2.5 font-bold text-white bg-brand-700 disabled:opacity-50">
              {saving ? 'Enregistrement…' : enEdition ? 'Enregistrer les modifications' : 'Enregistrer la pièce'}
            </button>
            {payable && (
              <button onClick={() => { setMontantPaye(String(totaux.net)); void save(totaux.net); }}
                      disabled={saving || lignes.length === 0}
                      className="rounded-md py-2.5 font-bold disabled:opacity-50"
                      style={{ background: 'var(--gold-400)', color: '#3A2A05' }}>
                Payer tout · F10
              </button>
            )}
            <div className="text-[10.5px] text-ink-muted text-center flex items-center justify-center gap-1.5">
              <DocBadge code={type === 'FA' ? 'BR' : type} /> {affecteStock ? 'entre en stock' : 'sans impact stock'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TotRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between px-4 py-2 text-[12px] text-ink-label border-b border-dashed border-line-soft">
      <span>{label}</span>
      <span className="money" style={{ color: value < 0 ? 'var(--danger)' : undefined }}>{fmtMoney(value)}</span>
    </div>
  );
}
