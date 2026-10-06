import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LigneVente, Vente } from '../../api/types';
import { fmtDate, fmtMoney, fmtQte } from '../../lib/format';
import { arreteLaSomme } from '../../lib/enLettres';
import { PrintDocument } from '../engine/types';
import { Societe } from './partials';

/**
 * Modèles d'impression des pièces de vente — reproduction des modèles FastReport du desktop
 * (Win32/Release/Models/*.fr3, table `printmodels`) : même structure d'en-tête, mêmes
 * colonnes, mêmes blocs de totaux et même phrase d'arrêté en lettres.
 *
 * Écarts volontaires, corrigeant des défauts des modèles d'origine :
 *  - « Facture avec timbre » : la colonne MONTANT HT affiche bien le HT (le .fr3 affichait le TTC) ;
 *  - « BL avec N° lot » : TOTAL HT = somme des (qté × prix brut) (le .fr3 sommait les prix unitaires) ;
 *  - « Bon de comptoir A5 » : la case DATE affiche la date (le .fr3 affichait le numéro) ;
 *  - le RIB et le capital viennent de la fiche société (ils étaient écrits en dur dans les .fr3).
 */

export type ModeleVenteId =
  | 'facture' | 'facture-timbre'
  | 'bl' | 'bl-lot' | 'bl-lot-remise-bl' | 'bl-sans-prix' | 'facture-route'
  | 'bct' | 'bct-a5'
  | 'avoir';

export type ModeleVente = { id: ModeleVenteId; titre: string; /** Code app du type de pièce (VENTE_TYPE_CODE). */ type: string };

/** Catalogue par type de pièce, dans l'ordre du desktop (printmodels). */
export const MODELES_VENTE: ModeleVente[] = [
  { id: 'facture', titre: 'Facture de Vente', type: 'FA' },
  { id: 'facture-timbre', titre: 'Facture avec timbre fiscal', type: 'FA' },
  { id: 'bl', titre: 'Bon de Livraison', type: 'BL' },
  { id: 'bl-lot', titre: 'BL avec N° lot et remise par article', type: 'BL' },
  { id: 'bl-lot-remise-bl', titre: 'BL avec N° lot et remise par BL', type: 'BL' },
  { id: 'facture-route', titre: 'Facture de route', type: 'BL' },
  { id: 'bl-sans-prix', titre: 'BL sans prix', type: 'BL' },
  { id: 'bct', titre: 'Bon de Comptoir', type: 'BCT' },
  { id: 'bct-a5', titre: 'Bon de Comptoir A5', type: 'BCT' },
  { id: 'avoir', titre: 'Facture d’avoir', type: 'FAV' },
];

export const modelesPour = (typeCode: string) => MODELES_VENTE.filter((m) => m.type === typeCode);

export type OptionsImpression = { cachet?: string | null };

/* ─── Styles (gabarit des .fr3 : Segoe UI / Calibri, cadres arrondis gris #5D5D5D, fonds #F0F0F0) ─── */

const GRIS = '#F0F0F0';
const CADRE = '#5D5D5D';
const SEP = '#CCCCCC';

/**
 * Texte injecté dans une chaîne CSS `content: "…"` (pied de page) : on ne garde que lettres,
 * chiffres, espaces et ponctuation courante — ni guillemet, ni antislash, ni accolade ne passent.
 * Le marqueur de saut de ligne `\n` devient la séquence CSS `\A`.
 */
export function echapperCss(texte: string): string {
  return texte
    .split('\n')
    .map((l) => l.replace(/[^\p{L}\p{N} .,:;/'()_-]/gu, ''))
    .join('\\A ');
}

function css(a5: boolean, piedPage: string) {
  piedPage = echapperCss(piedPage);
  return `
@page {
  size: ${a5 ? 'A5' : 'A4'};
  margin: 5mm 5mm ${piedPage ? '12mm' : '8mm'} 5mm;
  ${piedPage ? `@bottom-left { content: "${piedPage}"; font: 8pt Arial, sans-serif; white-space: pre-wrap; }` : ''}
  @bottom-right { content: "Page : " counter(page) " / " counter(pages); font: 8pt Arial, sans-serif; }
}
* { box-sizing: border-box; }
body { margin: 0; font-family: "Segoe UI", Calibri, Arial, sans-serif; font-size: 9pt; color: #000; }
.cal { font-family: Calibri, "Segoe UI", Arial, sans-serif; }
.rr { border: 1px solid ${CADRE}; border-radius: 2mm; background: #fff; }
.gris { background: ${GRIS}; }
.b { font-weight: 700; }
.c { text-align: center; } .r { text-align: right; }
.num { font-variant-numeric: tabular-nums; white-space: nowrap; }
table.lignes { width: 100%; border-collapse: collapse; margin-top: 2mm; }
table.lignes thead { display: table-header-group; }
table.lignes th { background: ${GRIS}; font-weight: 700; font-size: 9pt; padding: 1.8mm 1.2mm; border: 1px solid ${CADRE}; }
table.lignes td { padding: 1.2mm 1.4mm; border-left: 1px solid ${CADRE}; border-right: 1px solid ${CADRE}; vertical-align: top; }
table.lignes tbody tr { break-inside: avoid; }
table.lignes tbody tr:last-child td { border-bottom: 1px solid ${CADRE}; }
td.des { font-family: Tahoma, "Segoe UI", sans-serif; font-size: 10pt; }
.page-num::after { content: counter(page); }
.avoid { break-inside: avoid; }
`;
}

/* ─── Blocs communs ─────────────────────────────────────────────────────────── */

type Client = { raison: string; adresse?: string | null; ville?: string | null; codePostal?: string | null; wilaya?: string | null;
  rc?: string | null; nif?: string | null; nis?: string | null; art?: string | null };

function clientDe(v: Vente): Client {
  const c = ((v as { client?: Record<string, unknown> | null }).client ?? {}) as Record<string, unknown>;
  const x = v as Vente & Record<string, unknown>;
  const s = (a: unknown, b?: unknown) => {
    const t = String(a ?? '').trim() || String(b ?? '').trim();
    return t || null;
  };
  return {
    raison: s(v.raison, c.raison) ?? (v.code_cli ? String(v.code_cli) : 'Client comptoir'),
    adresse: s(x.adresse, c.adresse), ville: s(x.ville, c.ville), codePostal: s(x.code_postal, c.codpostal),
    wilaya: s(c.wilaya), rc: s(x.rc, c.RC), nif: s(x.nif, c.NIF), nis: s(x.nis, c.NIS), art: s(x.art, c['ART-IMP']),
  };
}

/** Bloc société (gauche) : logo, raison, adresse, contacts, identifiants fiscaux, RIB. */
function BlocSociete({ s, champs, capital, rib }: {
  s: Societe; champs: ('email' | 'rc' | 'nif' | 'art' | 'nis')[]; capital?: boolean; rib?: boolean;
}) {
  const x = s as Societe & Record<string, unknown>;
  const raison = capital ? raisonAvecCivilite(s) : (s.raison_sociale ?? '');
  const cap = capital && Number(x.capital) > 0 ? ` au Capital de : ${fmtMoney(Number(x.capital), 0)} DA` : '';
  const ligne = (label: string, v: unknown) => (v ? <div>{label}{String(v)}</div> : null);
  const tel = [s.telephone && `Tel : ${s.telephone}`, s.fax && `Fax : ${s.fax}`].filter(Boolean).join(' ');
  return (
    <div style={{ width: '99mm' }}>
      {s.logo ? <img src={String(s.logo)} alt="" style={{ maxWidth: '55mm', maxHeight: '26mm', objectFit: 'contain', display: 'block' }} /> : null}
      <div className="cal b" style={{ fontSize: capital ? '12pt' : '14pt', marginTop: '1.5mm', fontWeight: capital ? 400 : 700 }}>{raison || 'Société'}{cap}</div>
      <div style={{ fontSize: '9.4pt', lineHeight: 1.55, marginTop: '1mm' }}>
        {ligne('', s.adresse)}
        {ligne('', [x.code_postal, x.wilaya].filter(Boolean).join(' '))}
        {tel ? <div>{tel}</div> : null}
        {champs.includes('email') ? ligne('Email : ', s.email) : null}
        <div style={{ height: '1.5mm' }} />
        {champs.includes('rc') ? ligne('R.C :  ', s.rc) : null}
        {champs.includes('nif') ? ligne('NIF :  ', s.nif) : null}
        {champs.includes('art') ? ligne('Art :  ', s.art) : null}
        {champs.includes('nis') ? ligne('NIS :  ', s.nis) : null}
        {rib && x.rib ? <div style={{ marginTop: '1.5mm' }}>RIB : {String(x.rib)}{x.banque ? ` ${String(x.banque)}` : ''}{x.agence ? ` — ${String(x.agence)}` : ''}</div> : null}
      </div>
    </div>
  );
}

/** Cartouche droit : titre (fond gris), cases DATE / CLIENT / PAGE, cadre client. */
function BlocDocument({ titre, numero, date, v, champsClient, adresseLabel }: {
  titre: string; numero: string; date: string; v: Vente;
  champsClient: ('rc' | 'nif' | 'art' | 'nis')[]; adresseLabel?: boolean;
}) {
  const cl = clientDe(v);
  const cases: [string, ReactNode][] = [['DATE', date], ['CLIENT', v.code_cli || '—'], ['PAGE', <span className="page-num" />]];
  return (
    <div style={{ width: '90mm', display: 'flex', flexDirection: 'column', gap: '2mm' }}>
      <div className="rr gris cal b" style={{ padding: '1.6mm 3mm', fontSize: '15.8pt' }}>{titre}  N° : {numero}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0mm' }}>
        {cases.map(([l, val]) => (
          <div key={l} className="rr" style={{ height: '17mm', display: 'flex', flexDirection: 'column', width: '29.6mm' }}>
            <div className="b c" style={{ padding: '1.5mm 0', borderBottom: `1px solid ${CADRE}` }}>{l}</div>
            <div className="c num" style={{ padding: '2mm 1mm', fontSize: '10pt' }}>{val}</div>
          </div>
        ))}
      </div>
      <div className="rr" style={{ padding: '2mm 3mm', minHeight: '40mm', fontSize: '9.4pt', lineHeight: 1.55 }}>
        <div className="b" style={{ fontSize: '10.5pt' }}>{cl.raison}</div>
        {cl.adresse ? <div>{adresseLabel ? 'Adresse : ' : ''}{cl.adresse}</div> : null}
        {[cl.ville, cl.codePostal].filter(Boolean).length ? <div>{[cl.ville, cl.codePostal].filter(Boolean).join(' ')}</div> : null}
        <div style={{ borderTop: `1px solid ${CADRE}`, margin: '1.2mm 0' }} />
        {champsClient.includes('rc') ? <div>R.C :  {cl.rc ?? ''}</div> : null}
        {champsClient.includes('nif') ? <div>NIF :  {cl.nif ?? ''}</div> : null}
        {champsClient.includes('art') ? <div>Art :  {cl.art ?? ''}</div> : null}
        {champsClient.includes('nis') ? <div>NIS :  {cl.nis ?? ''}</div> : null}
      </div>
    </div>
  );
}

function ModeReglement({ v }: { v: Vente }) {
  return (
    <div className="rr b" style={{ width: '99mm', padding: '1.3mm 3mm', display: 'flex', marginTop: '1.5mm' }}>
      <span>MODE DE REGLEMENT : </span><span style={{ flex: 1, textAlign: 'center' }}>{v.mode_payement || 'Espèce'}</span>
    </div>
  );
}

type Col = { t: string; w: string; al?: 'l' | 'c' | 'r'; v: (l: LigneVente, i: number) => ReactNode; des?: boolean };

function TableLignes({ cols, lignes }: { cols: Col[]; lignes: LigneVente[] }) {
  return (
    <table className="lignes">
      <thead><tr>{cols.map((c) => <th key={c.t} style={{ width: c.w }} className={c.al === 'l' ? '' : 'c'}>{c.t}</th>)}</tr></thead>
      <tbody>
        {lignes.map((l, i) => (
          <tr key={l.id ?? i}>
            {cols.map((c) => (
              <td key={c.t} className={`${c.des ? 'des' : 'num'} ${c.al === 'r' ? 'r' : c.al === 'c' ? 'c' : ''}`}>{c.v(l, i)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Totaux en liste (factures) : libellé à gauche, valeur à droite, séparateurs gris. */
function TotauxListe({ rows }: { rows: { l: string; v: number; b?: boolean; bord?: boolean }[] }) {
  return (
    <table style={{ borderCollapse: 'collapse', width: '66mm', fontSize: '9.8pt' }}>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.l} style={{ borderTop: i === 0 ? `1.5px solid ${CADRE}` : `1px solid ${SEP}`, borderBottom: r.bord ? `1px solid ${CADRE}` : undefined }}>
            <td style={{ padding: '1.5mm 1mm' }}>{r.l}</td>
            <td className={`r num ${r.b ? 'b' : ''}`} style={{ padding: '1.5mm 1mm' }}>{fmtMoney(r.v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Totaux en cases (BL / facture de route / comptoir / avoir) : étiquette grise, valeur dessous. */
function CaseTotal({ l, v, grand, w = '31.6mm' }: { l: string; v: number; grand?: boolean; w?: string }) {
  return (
    <div style={{ width: w, display: 'flex', flexDirection: 'column' }}>
      <div className="rr gris b c" style={{ padding: '1.8mm 1mm', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>{l}</div>
      <div className={`rr c num ${grand ? 'b' : 'b'}`} style={{ padding: grand ? '3mm 1mm' : '2mm 1mm', fontSize: grand ? '11pt' : '9pt', borderTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>{fmtMoney(v)}</div>
    </div>
  );
}

function CadreTotaux({ rows, w }: { rows: [string, number][]; w: string }) {
  return (
    <div className="rr" style={{ width: w, padding: '1.5mm 2.5mm', display: 'flex', flexDirection: 'column', gap: '1mm' }}>
      {rows.map(([l, v]) => (
        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: '3mm' }}>
          <span className="b">{l}</span><span className="num">{fmtMoney(v)}</span>
        </div>
      ))}
    </div>
  );
}

function Arrete({ titre, montant, cadre }: { titre: string; montant: number; cadre?: boolean }) {
  const contenu = (
    <>
      <div style={cadre ? { fontFamily: 'Arial, sans-serif', fontStyle: 'italic', textDecoration: 'underline' } : { fontWeight: 700, borderBottom: `1.5px solid ${CADRE}`, display: 'inline-block', paddingBottom: '0.5mm' }}>{titre}</div>
      <div style={{ marginTop: '1.5mm', fontStyle: cadre ? 'normal' : 'italic', fontFamily: cadre ? 'Arial, sans-serif' : undefined }}>{arreteLaSomme(montant)}</div>
    </>
  );
  return cadre
    ? <div className="rr avoid" style={{ padding: '2mm 3mm', marginTop: '3mm' }}>{contenu}</div>
    : <div className="avoid" style={{ marginTop: '2mm' }}>{contenu}</div>;
}

function Cachet({ src }: { src?: string | null }) {
  return src ? <img src={src} alt="Cachet" style={{ width: '47mm', height: '43mm', objectFit: 'contain' }} /> : null;
}

/** « [civilite] [raison] » du desktop, sans doubler la forme juridique déjà dans la raison sociale. */
function raisonAvecCivilite(s: Societe): string {
  const raison = String(s.raison_sociale ?? '').trim();
  const civ = String((s as Record<string, unknown>).civilite ?? '').trim();
  return civ && !raison.toUpperCase().startsWith(civ.toUpperCase()) ? `${civ} ${raison}` : raison;
}

/** Date Delphi « vide » (30/12/1899 et avant) → chaîne vide. */
const dateValide = (d: unknown) => {
  if (!d) return false;
  const t = new Date(String(d)).getTime();
  return Number.isFinite(t) && t > Date.UTC(1901, 0, 1);
};
const ddp = (d: unknown) => (dateValide(d) ? fmtDate(d) : '');
const moisAnnee = (d: unknown) => {
  const f = dateValide(d) ? fmtDate(d) : '';
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(f);
  return m ? `${m[2]}/${m[3]}` : f;
};
const n = (x: unknown) => Number(x ?? 0) || 0;
const taxe = (l: LigneVente) => {
  const t = n((l as { total_taxe?: number }).total_taxe);
  return t || n(l.total_ttc) - n(l.total_ht);
};
const brut = (l: LigneVente) => n((l as { prix_ht_brut?: number }).prix_ht_brut) || n(l.prix_ht);
const net = (l: LigneVente) => n((l as { prix_ht_net?: number }).prix_ht_net) || n(l.prix_ht) * (1 - n(l.remise) / 100);

/* ─── Construction ─────────────────────────────────────────────────────────── */

export function buildVenteModelePrint(v: Vente, societe: Societe, modele: ModeleVenteId, opts: OptionsImpression = {}): PrintDocument {
  const lignes: LigneVente[] = v.lignes ?? [];
  const s = societe || {};
  const x = v as Vente & Record<string, unknown>;
  const date = fmtDate(v.date);
  const remiseP = n(v.remise_p);
  const netHt = n(x.net_ht) || n(v.total_ht) - n(v.remise);
  const totalTaxe = n(v.total_taxe) || lignes.reduce((t, l) => t + taxe(l), 0);
  const totalTtc = n(v.total_ttc);
  const netAPayer = n(v.net_a_payer);
  const piedUtilisateur = `Utilisateur :${v.user_name ?? ''}\nDémarcheur  : ${x.livreur ?? ''}`;

  let corps: ReactNode;
  let pied = '';
  let a5 = false;

  const colRef: Col = { t: 'RÉF.', w: '26mm', al: 'c', v: (l) => l.code_article };
  const colDes: Col = { t: 'DÉSIGNATION', w: 'auto', al: 'l', des: true, v: (l) => l.designation };
  const colQte: Col = { t: 'QU.', w: '15mm', al: 'c', v: (l) => fmtQte(l.qte) };
  const colN: Col = { t: 'N°', w: '9.8mm', al: 'c', v: (_l, i) => i + 1 };

  switch (modele) {
    case 'facture':
    case 'facture-timbre': {
      const timbre = modele === 'facture-timbre';
      corps = (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <BlocSociete s={s} champs={timbre ? ['rc', 'nis', 'art'] : ['email', 'rc', 'nif', 'art', 'nis']} rib={!timbre} />
            <BlocDocument titre="Facture" numero={v.numero} date={date} v={v} champsClient={['rc', 'nif', 'art', 'nis']} />
          </div>
          {!timbre && <ModeReglement v={v} />}
          <TableLignes lignes={lignes} cols={[
            colRef, colDes, colQte,
            { t: 'P.U.HT', w: '24mm', al: timbre ? 'r' : 'c', v: (l) => fmtMoney(net(l)) },
            { t: 'MONTANT HT', w: '31mm', al: timbre ? 'r' : 'c', v: (l) => fmtMoney(l.total_ht) },
            { t: 'TVA', w: '26mm', al: timbre ? 'r' : 'c', v: (l) => fmtMoney(taxe(l)) },
          ]} />
          <div className="avoid" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4mm', gap: '6mm' }}>
            <div style={{ flex: 1 }}>
              {timbre && (
                <div className="b" style={{ borderTop: `1.5px solid ${CADRE}`, borderBottom: `1px solid ${CADRE}`, padding: '1.5mm 0', marginBottom: '3mm' }}>
                  MODE DE REGLEMENT : {v.mode_payement || 'Espèce'}
                </div>
              )}
              <Arrete titre="Arrêter la somme de la présente facture :" montant={timbre ? netAPayer : totalTtc} />
              {opts.cachet ? <div style={{ marginTop: '4mm' }}><Cachet src={opts.cachet} /></div> : null}
            </div>
            <TotauxListe rows={[
              { l: 'Total HT :', v: n(v.total_ht), b: true },
              { l: `Remise (${fmtQte(remiseP)}) :`, v: n(v.remise) },
              { l: 'Net HT :', v: netHt, b: true },
              { l: 'Total TVA :', v: totalTaxe },
              { l: 'Total TTC :', v: totalTtc, b: true, bord: !timbre },
              ...(timbre ? [
                { l: 'Timbre Fiscal (1%) :', v: n(v.timbre) },
                { l: 'Net a Payer :', v: netAPayer, b: true, bord: true },
              ] : []),
            ]} />
          </div>
        </>
      );
      break;
    }

    case 'bl':
    case 'facture-route': {
      const route = modele === 'facture-route';
      pied = route ? `utilisateur :${v.user_name ?? ''}` : piedUtilisateur;
      corps = (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <BlocSociete s={s} champs={route ? ['email', 'rc', 'nif', 'art', 'nis'] : ['email', 'rc', 'nif', 'art']} />
            <BlocDocument titre={route ? 'FACTURE' : 'BON de LIVRAISON'} numero={v.numero} date={date} v={v}
                          champsClient={route ? ['rc', 'nif', 'art', 'nis'] : ['rc', 'nif', 'art']} />
          </div>
          <ModeReglement v={v} />
          <TableLignes lignes={lignes} cols={[
            colRef, colDes, colQte,
            { t: 'P.U.HT', w: '25mm', al: route ? 'r' : 'c', v: (l) => fmtMoney(net(l)) },
            { t: 'MONTANT HT', w: '29mm', al: route ? 'r' : 'c', v: (l) => fmtMoney(l.total_ht) },
            { t: 'TVA', w: route ? '22mm' : '16mm', al: route ? 'r' : 'c', v: (l) => `${fmtQte(l.tva)}%` },
            ...(route ? [] : [{ t: 'DDP', w: '27mm', al: 'c' as const, v: (l: LigneVente) => ddp(l.date_peremption) }]),
          ]} />
          <div className="avoid" style={{ marginTop: '3mm' }}>
            <div style={{ display: 'flex', gap: '2mm', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
              {!route && (
                <div style={{ marginRight: 'auto', display: 'flex', flexDirection: 'column', gap: '2mm', fontSize: '8pt' }}>
                  <div style={{ display: 'flex', gap: '2mm', alignItems: 'center' }}><span className="rr gris b" style={{ padding: '1mm 2mm' }}>ANCIEN SOLDE :</span><span className="num">{fmtMoney(x.ancien_credit)}</span></div>
                  <div style={{ display: 'flex', gap: '2mm', alignItems: 'center' }}><span className="rr gris b" style={{ padding: '1mm 2mm' }}>NOUVEAU SOLDE :</span><span className="num b" style={{ fontSize: '11pt' }}>{fmtMoney(x.nouveau_credit)}</span></div>
                </div>
              )}
              <CadreTotaux w="48.6mm" rows={[['TOTAL HT', n(v.total_ht)], ['REMISE', n(v.remise)], ['NET HT', netHt]]} />
              <CadreTotaux w="45.6mm" rows={[['TOTAL TVA', totalTaxe], ['TOTAL TTC', totalTtc], ['TIMBRE', n(v.timbre)]]} />
              <CaseTotal l="Net à payer" v={netAPayer} grand />
            </div>
            <Arrete cadre titre={route ? 'Arrêtér la présente Facture à la somme de :' : 'Arrêtér la présente Bon de Livraison à la somme de :'} montant={netAPayer} />
            {!route && <div className="rr" style={{ padding: '2mm 3mm', marginTop: '2mm', minHeight: '11mm' }}>Observation : {v.observation ?? ''}</div>}
            {opts.cachet ? <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '3mm' }}><Cachet src={opts.cachet} /></div> : null}
          </div>
        </>
      );
      break;
    }

    case 'bl-lot':
    case 'bl-lot-remise-bl':
    case 'bl-sans-prix': {
      const parArticle = modele === 'bl-lot';
      const sansPrix = modele === 'bl-sans-prix';
      pied = sansPrix ? `Livreur : ${x.livreur ?? ''}` : parArticle ? piedUtilisateur : '';
      const totalBrut = lignes.reduce((t, l) => t + n(l.qte) * brut(l), 0);
      const remisesLignes = lignes.reduce((t, l) => t + n((l as { remise_montant?: number }).remise_montant), 0);
      const cols: Col[] = sansPrix
        ? [colN, colDes, { t: 'Qté', w: '16.8mm', al: 'c', v: (l) => fmtQte(l.qte) },
          { t: 'N°Lot', w: '19.9mm', al: 'r', v: (l) => l.n_lot ?? '' },
          { t: 'D.P', w: '21.9mm', al: 'r', v: (l) => moisAnnee(l.date_peremption) }]
        : [colN, colDes, { t: 'Qté', w: '9.8mm', al: 'c', v: (l) => fmtQte(l.qte) },
          { t: 'P.U', w: '20.9mm', al: 'r', v: (l) => fmtMoney(parArticle ? brut(l) : net(l)) },
          { t: 'N°Lot', w: '16.8mm', al: 'r', v: (l) => l.n_lot ?? '' },
          { t: 'D.P', w: parArticle ? '14.7mm' : '19.9mm', al: parArticle ? 'c' : 'r', v: (l) => moisAnnee(l.date_peremption) },
          ...(parArticle ? [{ t: 'REMISE', w: '25.8mm', al: 'r' as const, v: (l: LigneVente) => fmtMoney(net(l)) }] : []),
          { t: 'TOTAL', w: '21.9mm', al: 'r', v: (l) => fmtMoney(l.total_ht) }];
      corps = (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <BlocSociete s={s} champs={['email', 'rc', 'nif', 'art', 'nis']} />
            <BlocDocument titre="Bon de livraison" numero={v.numero} date={date} v={v}
                          champsClient={['rc', 'nif', 'nis', 'art']} adresseLabel />
          </div>
          <ModeReglement v={v} />
          <table className="lignes" style={{ fontSize: '8.2pt' }}>
            <thead><tr>{cols.map((c) => <th key={c.t} style={{ width: c.w, fontSize: '8.2pt' }} className={c.al === 'l' ? '' : 'c'}>{c.t}</th>)}</tr></thead>
            <tbody>
              {lignes.map((l, i) => (
                <tr key={l.id ?? i}>{cols.map((c) => <td key={c.t} className={`${c.des ? 'des' : 'num'} ${c.al === 'r' ? 'r' : c.al === 'c' ? 'c' : ''}`} style={c.des ? undefined : { fontSize: '8.2pt' }}>{c.v(l, i)}</td>)}</tr>
              ))}
            </tbody>
          </table>
          {!sansPrix && (
            <div className="avoid" style={{ marginTop: '3mm' }}>
              <div style={{ display: 'flex', gap: '2mm', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
                <div style={{ marginRight: 'auto', display: 'flex', flexDirection: 'column', gap: '2mm', fontSize: '8pt' }}>
                  <div style={{ display: 'flex', gap: '2mm', alignItems: 'center' }}><span className="rr gris b" style={{ padding: '1mm 2mm' }}>ANCIEN SOLDE :</span><span className="num">{fmtMoney(x.ancien_credit)}</span></div>
                  <div style={{ display: 'flex', gap: '2mm', alignItems: 'center' }}><span className="rr gris b" style={{ padding: '1mm 2mm' }}>NOUVEAU SOLDE :</span><span className="num b" style={{ fontSize: '11pt' }}>{fmtMoney(x.nouveau_credit)}</span></div>
                </div>
                <CadreTotaux w="48.6mm" rows={parArticle
                  ? [['TOTAL HT', totalBrut], ['REMISE', remisesLignes], ['NET HT', n(v.total_ht)]]
                  : [['TOTAL HT', n(v.total_ht)], ['REMISE', n(v.remise)], ['NET HT', netHt]]} />
                <CadreTotaux w="45.6mm" rows={[['TOTAL TVA', totalTaxe], ['TOTAL TTC', totalTtc], ['TIMBRE', n(v.timbre)]]} />
                <CaseTotal l="Net à payer" v={netAPayer} grand />
              </div>
              <Arrete cadre titre={parArticle ? 'Arrêtér le présent Bon de livraison à la somme de :' : 'Arrêtér le présent bon de livraison à la somme de :'} montant={netAPayer} />
            </div>
          )}
          {opts.cachet ? <div className="avoid" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4mm' }}><Cachet src={opts.cachet} /></div> : null}
        </>
      );
      break;
    }

    case 'bct': {
      corps = (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <BlocSociete s={s} champs={['rc', 'nis', 'art']} capital />
            <BlocDocument titre="BON DE COMPTOIR" numero={v.numero} date={date} v={v} champsClient={['rc', 'nis', 'art']} />
          </div>
          <TableLignes lignes={lignes} cols={[
            colRef, colDes, { t: 'QU.', w: '9.3mm', al: 'c', v: (l) => fmtQte(l.qte) },
            { t: 'P.U.TTC', w: '28mm', al: 'r', v: (l) => fmtMoney(l.prix_ttc) },
            { t: 'MONTANT TTC', w: '32mm', al: 'r', v: (l) => fmtMoney(l.total_ttc) },
          ]} />
          <div className="avoid" style={{ marginTop: '3mm' }}>
            <div style={{ display: 'flex', gap: '2mm', justifyContent: 'flex-end' }}>
              <CaseTotal l={`Remise (${fmtQte(remiseP)}%)`} v={n(v.remise)} w="27.6mm" />
              <CaseTotal l="Net à payer" v={netAPayer} />
            </div>
            <Arrete cadre titre="Arrêtér la présente Facture à la somme de :" montant={netAPayer} />
            {opts.cachet ? <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '3mm' }}><Cachet src={opts.cachet} /></div> : null}
          </div>
        </>
      );
      break;
    }

    case 'bct-a5': {
      a5 = true;
      const cl = clientDe(v);
      corps = (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ width: '80mm' }}>
              {s.logo ? <img src={String(s.logo)} alt="" style={{ maxWidth: '57mm', maxHeight: '24mm', objectFit: 'contain', display: 'block' }} /> : null}
              <div className="cal" style={{ fontSize: '12pt', marginTop: '1mm' }}>
                {raisonAvecCivilite(s)}
                {Number((s as Record<string, unknown>).capital) > 0 ? ` au Capital de : ${fmtMoney(Number((s as Record<string, unknown>).capital), 0)} DA` : ''}
              </div>
              <div style={{ fontSize: '9pt', lineHeight: 1.5 }}>
                {s.adresse ? <div>{s.adresse}</div> : null}
                <div>{[(s as Record<string, unknown>).code_postal, (s as Record<string, unknown>).wilaya].filter(Boolean).join(' ')}</div>
                <div>{[s.telephone && `Tel : ${s.telephone}`, s.fax && `Fax : ${s.fax}`].filter(Boolean).join(' ')}</div>
              </div>
            </div>
            <div style={{ width: '39mm', border: `1px solid ${CADRE}`, padding: '2mm', marginTop: '7mm' }}>
              <div className="b">CLIENT :</div>
              <div className="c" style={{ margin: '1mm 0 3mm' }}>{cl.raison}</div>
              <div className="b">DATE</div>
              <div className="c">{date}</div>
            </div>
          </div>
          <div className="rr gris cal b c" style={{ width: '82mm', margin: '4mm auto 0', padding: '1.8mm', fontSize: '12pt' }}>BON DE COMPTOIR  N° : {v.numero}</div>
          <TableLignes lignes={lignes} cols={[
            { ...colDes, t: 'DÉSIGNATION' }, { t: 'QU.', w: '9.3mm', al: 'c', v: (l) => fmtQte(l.qte) },
            { t: 'P.U.TTC', w: '28mm', al: 'r', v: (l) => fmtMoney(l.prix_ttc) },
            { t: 'MONTANT TTC', w: '36mm', al: 'r', v: (l) => fmtMoney(l.total_ttc) },
          ]} />
          <div className="avoid" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '3mm' }}>
            <CaseTotal l="TOTAL TTC" v={totalTtc} />
          </div>
          {opts.cachet ? <div className="avoid" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '3mm' }}><Cachet src={opts.cachet} /></div> : null}
        </>
      );
      break;
    }

    case 'avoir': {
      corps = (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <BlocSociete s={s} champs={['email', 'rc', 'nis', 'art']} capital />
            <BlocDocument titre="FACTURE D'AVOIR" numero={v.numero} date={date} v={v} champsClient={['rc', 'nis', 'art']} />
          </div>
          <TableLignes lignes={lignes} cols={[
            colRef, colDes, { t: 'QU.', w: '9.3mm', al: 'c', v: (l) => fmtQte(l.qte) },
            { t: 'P.U.HT', w: '28mm', al: 'r', v: (l) => fmtMoney(net(l)) },
            { t: 'MONTANT HT', w: '31mm', al: 'r', v: (l) => fmtMoney(l.total_ht) },
            { t: 'TVA', w: '22.6mm', al: 'r', v: (l) => fmtMoney(taxe(l)) },
          ]} />
          <div className="avoid" style={{ marginTop: '3mm' }}>
            <div style={{ display: 'flex', gap: '2mm', justifyContent: 'flex-end' }}>
              <CaseTotal l="TOTAL HT" v={n(v.total_ht)} w="27.6mm" />
              <CaseTotal l="TOTAL TVA" v={totalTaxe} w="28.6mm" />
              <CaseTotal l="Net à payer" v={netAPayer} />
            </div>
            <Arrete cadre titre="Arrêtér la présente Facture à la somme de :" montant={netAPayer} />
            {opts.cachet ? <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '3mm' }}><Cachet src={opts.cachet} /></div> : null}
          </div>
        </>
      );
      break;
    }
  }

  const titre = MODELES_VENTE.find((m) => m.id === modele)?.titre ?? 'Pièce';
  return {
    title: `${titre} ${v.numero}`,
    html: renderToStaticMarkup(<div>{corps}</div>),
    css: css(a5, pied),
  };
}
