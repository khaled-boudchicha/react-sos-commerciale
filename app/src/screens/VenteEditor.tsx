import { useEffect, useMemo, useRef, useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { VENTE } from '../api/queries';
import { Article, Client, TYPES_VENTE } from '../api/types';
import { nouvelleCle } from '../components/document/lignesDocument';
import { useSession } from '../store/session';
import { fmtMoney, fmtQte, isoToday } from '../lib/format';
import { DocBadge, PageHeader, Tabs } from '../components/ui/atoms';
import ArticleSearch from '../components/ArticleSearch';
import ClientSearch from '../components/ClientSearch';
import LignesTable from '../components/document/LignesTable';
import { LigneDoc, ligneDepuisArticle, totauxDocument } from '../components/document/lignesDocument';
import { useToast } from '../components/ui/Toast';
import RemiseGlobale from '../components/document/RemiseGlobale';

const CREATE_VENTE = gql`
  mutation CreateVente($input: JSON!) { createVente(input: $input) }
`;
const ADD_REGLEMENT_CLIENT = gql`
  mutation AddReglementClient($input: JSON!) { addReglementClient(input: $input) }
`;
const MODES = gql`
  query ModesPayementEditor { modesPayement }
`;

export default function VenteEditor() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const { dossierUser } = useSession();

  const initialType = (params.get('type') as (typeof TYPES_VENTE)[number]['code']) || 'FA';
  const [type, setType] = useState<(typeof TYPES_VENTE)[number]['code']>(initialType);
  const [client, setClient] = useState<Client | null>(null);
  const [date, setDate] = useState(isoToday());
  const [mode, setMode] = useState('Espece');
  const [remiseGlobale, setRemiseGlobale] = useState(0);
  const [observation, setObservation] = useState('');
  const [lignes, setLignes] = useState<LigneDoc[]>([]);
  const [montantRecu, setMontantRecu] = useState('');
  const [error, setError] = useState<string | null>(null);
  const montantRecuRef = useRef<HTMLInputElement>(null);

  const { data: refs } = useQuery(MODES);
  const modes: any[] = Array.isArray(refs?.modesPayement) ? refs.modesPayement : [];
  const [create, { loading: saving }] = useMutation(CREATE_VENTE);
  const [addReglement] = useMutation(ADD_REGLEMENT_CLIENT);

  // Duplication : ?from=<id> → on recharge la pièce source et on reprend ses
  // lignes (le serveur renumérote ; la date reste celle du jour).
  const dupliquerId = params.get('from');
  const { data: sourceData } = useQuery(VENTE, { variables: { id: Number(dupliquerId) }, skip: !dupliquerId });
  const prefaitRef = useRef(false);
  useEffect(() => {
    if (prefaitRef.current || !dupliquerId) return;
    const src: any = sourceData?.vente;
    if (!src) return;
    prefaitRef.current = true;
    const src_lignes: any[] = Array.isArray(src.lignes) ? src.lignes : [];
    setLignes(src_lignes.map((l) => ({
      key: nouvelleCle(),
      id_article: l.id_article ?? undefined,
      code_article: l.code_article,
      designation: l.designation,
      qte: Number(l.qte) || 0,
      prix_ht: Number(l.prix_ht) || 0,
      tva: Number(l.tva) || 0,
      remise: Number(l.remise) || 0,
      n_lot: l.n_lot || '',
      date_peremption: l.date_peremption ? String(l.date_peremption).slice(0, 10) : '',
    })));
    if (src.code_cli) setClient({ code: src.code_cli, nom: src.raison ?? src.code_cli, raison: src.raison } as unknown as Client);
    if (src.mode_payement) setMode(String(src.mode_payement));
    if (src.remise != null) setRemiseGlobale(Number(src.remise) || 0);
    if (src.observation) setObservation(String(src.observation));
    toast.info(`Pièce ${src.numero ?? ''} dupliquée — vérifiez puis enregistrez.`);
  }, [sourceData, dupliquerId, toast]);

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
  const totaux = useMemo(() => totauxDocument(lignes, remiseGlobale), [lignes, remiseGlobale]);

  async function save(recuOverride?: number) {
    setError(null);
    if (lignes.length === 0) { setError('Ajoutez au moins une ligne.'); return; }
    if (!dossierUser) { setError('Utilisateur dossier manquant — reconnectez-vous.'); return; }
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
            user_id: Number(dossierUser.id),
            user_name: String(dossierUser.username),
            lignes: lignes.map((l) => ({
              id_article: l.id_article,
              code_article: l.code_article,
              designation: l.designation,
              qte: l.qte,
              prix_ht: l.prix_ht,
              tva: l.tva,
              remise: l.remise || 0,
              n_lot: l.n_lot || undefined,
              date_peremption: l.date_peremption || undefined,
              colis: l.colis || undefined,
            })),
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
            variables: { input: { vente_id: created.id, montant: recu, date, mode_payement: mode || undefined } },
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
    } catch (e: any) {
      setError(e.message ?? 'Erreur à l’enregistrement.');
      toast.error(`Enregistrement échoué : ${e.message ?? 'erreur'}`);
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
      if (e.key === 'F10') {
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
  }, [lignes, saving, totaux.net, client, date, mode, remiseGlobale, observation, dossierUser]);

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title="Nouvelle pièce de vente">
        <Link to="/ventes" className="text-[12px] font-bold text-brand-700">← Annuler</Link>
      </PageHeader>

      <Tabs value={type} onChange={setType} options={TYPES_VENTE} />

      {error && (
        <div className="text-[12px] rounded-md px-3 py-2"
             style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' }}>{error}</div>
      )}

      <div className="bg-surface border border-line-soft rounded-md shadow-soft p-4 grid grid-cols-[2fr_1fr_1fr_1fr] gap-3">
        <label className="text-[11px] font-bold text-ink-label">Client
          <div className="mt-1 font-normal"><ClientSearch value={client} onSelect={setClient} /></div>
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
          <LignesTable sens="vente" lignes={lignes} patch={patchLigne} remove={removeLigne} />
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
            <label className="text-[11px] font-bold text-ink-label">
              Montant reçu (règlement immédiat)
              <div className="flex gap-1.5 mt-1">
                <input ref={montantRecuRef} type="number" min="0" step="0.01" value={montantRecu}
                       onChange={(e) => setMontantRecu(e.target.value)} placeholder="0,00"
                       className="flex-1 min-w-0 border border-line rounded-sm px-3 py-2 bg-surface text-ink money text-right font-normal" />
                <button onClick={() => setMontantRecu(String(totaux.net))}
                        className="px-3 rounded-sm border border-line text-[11px] font-bold text-ink-label">
                  Tout
                </button>
              </div>
            </label>
            {(() => {
              const recu = parseFloat(montantRecu) || 0;
              const rendu = recu - totaux.net;
              if (recu <= 0) return null;
              return rendu >= 0 ? (
                <div className="flex justify-between items-center px-1 text-[12px] font-bold" style={{ color: 'var(--success)' }}>
                  <span>À rendre</span>
                  <span className="money text-[14px]">{fmtMoney(rendu)} DA</span>
                </div>
              ) : (
                <div className="flex justify-between items-center px-1 text-[12px] font-bold" style={{ color: 'var(--warning)' }}>
                  <span>Reste dû</span>
                  <span className="money text-[14px]">{fmtMoney(-rendu)} DA</span>
                </div>
              );
            })()}
            <button onClick={() => void save()} disabled={saving || lignes.length === 0}
                    className="rounded-md py-2.5 font-bold text-white bg-brand-700 disabled:opacity-50">
              {saving ? 'Enregistrement…' : 'Enregistrer la pièce'}
            </button>
            <button onClick={() => { setMontantRecu(String(totaux.net)); void save(totaux.net); }}
                    disabled={saving || lignes.length === 0}
                    className="rounded-md py-2.5 font-bold disabled:opacity-50"
                    style={{ background: 'var(--gold-400)', color: '#3A2A05' }}>
              Encaisser tout · F10
            </button>
            <div className="text-[10.5px] text-ink-muted text-center">
              <DocBadge code={type} /> numérotée automatiquement par le serveur
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
