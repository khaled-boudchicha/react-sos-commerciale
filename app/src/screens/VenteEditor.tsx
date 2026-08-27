import { useEffect, useMemo, useRef, useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Article, Client, TYPES_VENTE } from '../api/types';
import { useSession } from '../store/session';
import { fmtMoney, fmtQte, isoToday } from '../lib/format';
import { DocBadge, PageHeader, Tabs } from '../components/ui/atoms';
import ArticleSearch from '../components/ArticleSearch';
import ClientSearch from '../components/ClientSearch';

const CREATE_VENTE = gql`
  mutation CreateVente($input: JSON!) { createVente(input: $input) }
`;
const ADD_REGLEMENT_CLIENT = gql`
  mutation AddReglementClient($input: JSON!) { addReglementClient(input: $input) }
`;
const MODES = gql`
  query ModesPayementEditor { modesPayement }
`;

type Ligne = {
  key: number;
  id_article?: number;
  code_article: string;
  designation: string;
  qte: number;
  prix_ht: number;
  tva: number;
  remise: number;
};

let lineKey = 1;

export default function VenteEditor() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { dossierUser } = useSession();

  const initialType = (params.get('type') as (typeof TYPES_VENTE)[number]['code']) || 'FA';
  const [type, setType] = useState<(typeof TYPES_VENTE)[number]['code']>(initialType);
  const [client, setClient] = useState<Client | null>(null);
  const [date, setDate] = useState(isoToday());
  const [mode, setMode] = useState('Espece');
  const [remiseGlobale, setRemiseGlobale] = useState(0);
  const [observation, setObservation] = useState('');
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [montantRecu, setMontantRecu] = useState('');
  const [error, setError] = useState<string | null>(null);
  const montantRecuRef = useRef<HTMLInputElement>(null);

  const { data: refs } = useQuery(MODES);
  const modes: any[] = Array.isArray(refs?.modesPayement) ? refs.modesPayement : [];
  const [create, { loading: saving }] = useMutation(CREATE_VENTE);
  const [addReglement] = useMutation(ADD_REGLEMENT_CLIENT);

  function addArticle(a: Article) {
    setLignes((ls) => {
      // Même article déjà présent → incrémente la quantité (comportement comptoir)
      const idx = ls.findIndex((l) => l.code_article === a.code);
      if (idx >= 0) {
        const next = [...ls];
        next[idx] = { ...next[idx], qte: next[idx].qte + 1 };
        return next;
      }
      return [...ls, {
        key: lineKey++,
        id_article: a.id,
        code_article: a.code,
        designation: a.designation,
        qte: 1,
        prix_ht: Number(a.prix_vente_ht ?? 0),
        tva: Number(a.tva ?? 0),
        remise: 0,
      }];
    });
  }

  function patchLigne(key: number, patch: Partial<Ligne>) {
    setLignes((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLigne(key: number) {
    setLignes((ls) => ls.filter((l) => l.key !== key));
  }

  // Mêmes formules que l'agent (createVente) : ht = qte×prix×(1−rem/100) ; ttc = ht×(1+tva/100) ; remise globale sur le net
  const totaux = useMemo(() => {
    let ht = 0, ttc = 0, remLignes = 0;
    for (const l of lignes) {
      const brut = l.qte * l.prix_ht;
      const net = brut * (1 - (l.remise || 0) / 100);
      remLignes += brut - net;
      ht += net;
      ttc += net * (1 + l.tva / 100);
    }
    const remGlob = ttc * ((remiseGlobale || 0) / 100);
    return { ht, remLignes, tva: ttc - ht, remGlob, net: ttc - remGlob };
  }, [lignes, remiseGlobale]);

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
          return;
        }
      }
      navigate(`/ventes/${created.id}`);
    } catch (e: any) {
      setError(e.message ?? 'Erreur à l’enregistrement.');
    }
  }

  // F10 = encaisser tout et enregistrer (héritage Delphi)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
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

  const cellCls = 'w-full bg-transparent text-right money text-[12px] px-2 py-1.5 border border-transparent rounded-sm focus:border-brand-500 focus:bg-surface';

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
        <label className="text-[11px] font-bold text-ink-label">Remise globale %
          <input type="number" min="0" max="100" step="0.5" value={remiseGlobale}
                 onChange={(e) => setRemiseGlobale(parseFloat(e.target.value) || 0)}
                 className="mt-1 w-full border border-line rounded-sm px-3 py-2 bg-surface text-ink money text-right font-normal" />
        </label>
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-3.5 items-start">
        <div className="flex flex-col gap-2.5">
          <ArticleSearch onSelect={addArticle} autoFocus />
          <div className="bg-surface border border-line-soft rounded-md shadow-soft overflow-x-auto">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr>
                  {['Article', 'Qté', 'P.U. HT', 'Rem. %', 'TVA %', 'Total TTC', ''].map((h, i) => (
                    <th key={i} className={`text-[10px] font-bold uppercase tracking-wider text-ink-muted bg-bg border-b border-line-soft px-3 py-2 ${i > 0 && i < 6 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignes.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-ink-muted">
                    Recherchez un article ci-dessus, ou scannez un code-barres. Entrée pour l'ajouter.
                  </td></tr>
                )}
                {lignes.map((l) => {
                  const net = l.qte * l.prix_ht * (1 - (l.remise || 0) / 100);
                  const ttc = net * (1 + l.tva / 100);
                  return (
                    <tr key={l.key} className="border-b border-line-soft last:border-b-0">
                      <td className="px-3 py-1">
                        <b>{l.designation}</b>
                        <span className="money text-[10.5px] text-ink-muted"> · {l.code_article}</span>
                      </td>
                      <td className="w-[80px]"><input type="number" min="0" step="any" value={l.qte}
                        onChange={(e) => patchLigne(l.key, { qte: parseFloat(e.target.value) || 0 })} className={cellCls} /></td>
                      <td className="w-[100px]"><input type="number" min="0" step="0.01" value={l.prix_ht}
                        onChange={(e) => patchLigne(l.key, { prix_ht: parseFloat(e.target.value) || 0 })} className={cellCls} /></td>
                      <td className="w-[75px]"><input type="number" min="0" max="100" step="0.5" value={l.remise}
                        onChange={(e) => patchLigne(l.key, { remise: parseFloat(e.target.value) || 0 })} className={cellCls} /></td>
                      <td className="w-[65px] text-right money px-3">{fmtQte(l.tva)}</td>
                      <td className="w-[110px] text-right money font-semibold px-3">{fmtMoney(ttc)}</td>
                      <td className="w-[36px] text-center">
                        <button onClick={() => removeLigne(l.key)} className="text-ink-muted hover:text-[color:var(--danger)] font-bold">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
