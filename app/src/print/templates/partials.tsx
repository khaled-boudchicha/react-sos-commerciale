import { ReactNode } from 'react';

/** Coordonnées société (query `coordonneesSociete`, table `info` côté agent). */
export type Societe = Record<string, unknown> & {
  raison_sociale?: string | null; adresse?: string | null; telephone?: string | null;
  fax?: string | null; email?: string | null; site_web?: string | null;
  rc?: string | null; nif?: string | null; nis?: string | null; art?: string | null;
  slogan?: string | null; logo?: string | null;
};

// ─── Palette d'impression (indépendante du thème de l'app) ───────────────────
export const INK = '#0F1A2E';
export const MUTED = '#6B7A93';
export const LINE = '#D5DDEC';
export const BRAND = '#2450E0';

/**
 * CSS de base commun à tous les modèles A4.
 * - `@page` : format, marges, numéro de page (compteurs Paged.js) et référence
 *   du document en marge basse via `string-set` (l'élément `.doc-ref` du corps).
 * - Tableaux : `thead` répété à chaque page, lignes insécables.
 */
export const BASE_CSS = `
@page {
  size: A4;
  margin: 13mm 13mm 17mm 13mm;
  @bottom-center {
    content: "Page " counter(page) " / " counter(pages);
    font-family: "Plus Jakarta Sans", system-ui, sans-serif;
    font-size: 9px; color: ${MUTED};
  }
  @bottom-left {
    content: string(docref);
    font-family: "JetBrains Mono", monospace;
    font-size: 8.5px; color: ${MUTED};
  }
}
.doc-ref { string-set: docref content(text); }

* { box-sizing: border-box; }
body {
  font-family: "Plus Jakarta Sans", system-ui, sans-serif;
  color: ${INK};
  font-size: 11px;
  line-height: 1.45;
  margin: 0;
}
.mono { font-family: "JetBrains Mono", monospace; font-variant-numeric: tabular-nums; }

table.lines { width: 100%; border-collapse: collapse; }
table.lines thead { display: table-header-group; }
table.lines tr { break-inside: avoid; }
table.lines th {
  text-align: left; font-size: 9.5px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .4px; color: ${MUTED}; padding: 6px 8px;
  border-bottom: 1.5px solid ${INK};
}
table.lines td { padding: 5.5px 8px; border-bottom: 1px solid ${LINE}; vertical-align: top; }
.r { text-align: right; }
.muted { color: ${MUTED}; }
.avoid-break { break-inside: avoid; }
`;

// ─── Blocs partagés ──────────────────────────────────────────────────────────

/** En-tête société + cartouche type/numéro/date du document. */
export function DocHeader({ societe, docLabel, numero, date }: {
  societe: Societe; docLabel: string; numero: string; date: string;
}) {
  const s = societe || {};
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 12, borderBottom: `2px solid ${BRAND}` }}>
      <div>
        <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.3px' }}>{s.raison_sociale || 'Société'}</div>
        {s.slogan ? <div style={{ fontSize: 10.5, color: MUTED }}>{s.slogan}</div> : null}
        <div style={{ fontSize: 10, color: MUTED, marginTop: 5, lineHeight: 1.5 }}>
          {s.adresse ? <div>{s.adresse}</div> : null}
          <div>{[s.telephone && `Tél : ${s.telephone}`, s.fax && `Fax : ${s.fax}`].filter(Boolean).join('  ·  ')}</div>
          {s.email ? <div>{s.email}</div> : null}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: BRAND }}>{docLabel}</div>
        <div className="mono doc-ref" style={{ fontSize: 12.5, fontWeight: 600, marginTop: 2 }}>{`${docLabel} N° ${numero}`}</div>
        <div style={{ fontSize: 10.5, color: MUTED, marginTop: 3 }}>Date : {date}</div>
      </div>
    </div>
  );
}

/** Cartouche tiers (client ou fournisseur) + identifiants fiscaux de la société. */
export function TiersBlock({ label, nom, detail, societe }: {
  label: string; nom: string; detail?: string | null; societe: Societe;
}) {
  const s = societe || {};
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, marginBottom: 8 }}>
      <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: '9px 13px', minWidth: '78mm' }}>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: MUTED, letterSpacing: '.5px' }}>{label}</div>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 2 }}>{nom}</div>
        {detail ? <div style={{ fontSize: 10.5, color: MUTED }}>{detail}</div> : null}
      </div>
      <div style={{ fontSize: 9.5, color: MUTED, textAlign: 'right', alignSelf: 'flex-end', lineHeight: 1.5 }}>
        {s.rc ? <div>RC : {s.rc}</div> : null}
        {s.nif ? <div>NIF : {s.nif}</div> : null}
        {s.nis ? <div>NIS : {s.nis}</div> : null}
        {s.art ? <div>Art. Imp. : {s.art}</div> : null}
      </div>
    </div>
  );
}

/** Bloc de totaux aligné à droite ; la dernière ligne (mise en avant) est fournie séparément. */
export function TotalsBlock({ rows, final }: {
  rows: { label: string; value: ReactNode }[];
  final: { label: string; value: ReactNode };
}) {
  return (
    <div className="avoid-break" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
      <table style={{ borderCollapse: 'collapse', minWidth: '74mm' }}>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={{ padding: '5px 12px', fontSize: 11, color: '#42536F', borderBottom: `1px solid ${LINE}` }}>{r.label}</td>
              <td className="mono" style={{ padding: '5px 12px', fontSize: 11, textAlign: 'right', borderBottom: `1px solid ${LINE}` }}>{r.value}</td>
            </tr>
          ))}
          <tr>
            <td style={{ padding: '8px 12px', fontWeight: 800, fontSize: 12.5, background: BRAND, color: '#fff' }}>{final.label}</td>
            <td className="mono" style={{ padding: '8px 12px', fontWeight: 800, fontSize: 12.5, background: BRAND, color: '#fff', textAlign: 'right' }}>{final.value}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Pied de pièce : montant arrêté en toutes lettres (zone) + cachet/signature. */
export function SignFooter({ arreteA }: { arreteA: string }) {
  return (
    <div className="avoid-break" style={{ paddingTop: 22, fontSize: 10, color: MUTED, display: 'flex', justifyContent: 'space-between' }}>
      <div>Arrêtée la présente pièce à la somme de : <b style={{ color: INK }}>{arreteA}</b></div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ height: 38 }} />
        <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 4, width: '55mm' }}>Cachet et signature</div>
      </div>
    </div>
  );
}
