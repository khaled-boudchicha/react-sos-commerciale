import { renderToStaticMarkup } from 'react-dom/server';
import { fmtDate, fmtMoney } from '../../lib/format';
import { PrintDocument } from '../engine/types';
import { BASE_CSS, DocHeader, TotalsBlock, Societe, LINE, MUTED, INK } from './partials';

export type ArreteCaisseMouvement = {
  cle: string; date?: string | null; mode_payement?: string | null; montant: number;
  raison?: string | null; objet?: string | null; categorie?: string | null;
};
export type ArreteCaisseData = {
  date: string; compte_id?: number | null; compte?: string | null;
  solde_ouverture: number; total_entrees: number; total_sorties: number; solde_theorique: number;
  par_mode: { mode: string | null; entrees: number; sorties: number }[];
  mouvements: ArreteCaisseMouvement[];
  // Présents après clôture (cloturerCaisse)
  montant_compte?: number | null; ecart?: number | null; mouvement_ecart?: unknown;
};

/**
 * Modèle d'impression — ARRÊTÉ DE CAISSE (journée d'un compte).
 * Si `montantCompte` est fourni (saisie à l'écran ou résultat de clôture), le
 * document affiche le comptage physique et l'écart ; sinon, seulement le théorique.
 */
export function buildArreteCaissePrint(
  { arrete, montantCompte, utilisateur }: { arrete: ArreteCaisseData; montantCompte?: number | null; utilisateur?: string | null },
  societe: Societe,
): PrintDocument {
  const compte = arrete.compte || (arrete.compte_id != null ? `Compte ${arrete.compte_id}` : 'Caisse');
  const compte_ = montantCompte ?? arrete.montant_compte ?? null;
  const ecart = compte_ != null ? Number(compte_) - Number(arrete.solde_theorique) : null;

  const body = (
    <div>
      {/* Référence = compte + jour (un arrêté par caisse et par journée) */}
      <DocHeader societe={societe} docLabel="Arrêté de caisse"
                 numero={`${String(arrete.date).slice(0, 10).replace(/-/g, '')}-${arrete.compte_id ?? 0}`} date={fmtDate(arrete.date)} />
      <div style={{ fontSize: 12, marginTop: 10 }}>Compte / caisse : <b>{compte}</b></div>

      <div className="avoid-break" style={{ display: 'flex', gap: 10, marginTop: 12, marginBottom: 10 }}>
        {[
          { label: 'Solde d\'ouverture', v: arrete.solde_ouverture },
          { label: 'Entrées', v: arrete.total_entrees, color: '#16A34A' },
          { label: 'Sorties', v: arrete.total_sorties, color: '#DC2626' },
          { label: 'Solde théorique', v: arrete.solde_theorique, strong: true },
        ].map((k) => (
          <div key={k.label} style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: '9px 13px', flex: 1, textAlign: 'right' }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: MUTED, letterSpacing: '.5px', textAlign: 'left' }}>{k.label}</div>
            <div className="mono" style={{ fontSize: 12.5, fontWeight: k.strong ? 800 : 600, marginTop: 2, color: k.color }}>{fmtMoney(k.v)}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: MUTED, letterSpacing: '.5px', margin: '10px 0 4px' }}>Récapitulatif par mode de paiement</div>
      <table className="lines avoid-break">
        <thead>
          <tr>
            <th>Mode</th>
            <th className="r" style={{ width: '22%' }}>Entrées</th>
            <th className="r" style={{ width: '22%' }}>Sorties</th>
            <th className="r" style={{ width: '22%' }}>Net</th>
          </tr>
        </thead>
        <tbody>
          {arrete.par_mode.map((p, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 600 }}>{p.mode || '—'}</td>
              <td className="mono r">{fmtMoney(p.entrees)}</td>
              <td className="mono r">{fmtMoney(p.sorties)}</td>
              <td className="mono r" style={{ fontWeight: 600 }}>{fmtMoney(Number(p.entrees) - Number(p.sorties))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: MUTED, letterSpacing: '.5px', margin: '14px 0 4px' }}>
        Mouvements de la journée ({arrete.mouvements.length})
      </div>
      <table className="lines">
        <thead>
          <tr>
            <th style={{ width: '15%' }}>Catégorie</th>
            <th>Tiers / libellé</th>
            <th style={{ width: '14%' }}>Mode</th>
            <th className="r" style={{ width: '18%' }}>Montant</th>
          </tr>
        </thead>
        <tbody>
          {arrete.mouvements.map((m) => (
            <tr key={m.cle}>
              <td style={{ fontWeight: 600 }}>{m.categorie ?? m.cle.replace(/\d+$/, '')}</td>
              <td>{m.raison || m.objet || '—'}</td>
              <td className="muted">{m.mode_payement ?? '—'}</td>
              <td className="mono r" style={{ fontWeight: 600, color: Number(m.montant) >= 0 ? '#16A34A' : '#DC2626' }}>
                {Number(m.montant) >= 0 ? '+' : ''}{fmtMoney(m.montant)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <TotalsBlock
        rows={compte_ != null
          ? [
              { label: 'Solde théorique', value: fmtMoney(arrete.solde_theorique) },
              { label: 'Montant compté', value: fmtMoney(compte_) },
            ]
          : []}
        final={ecart != null
          ? { label: 'Écart', value: `${ecart > 0 ? '+' : ''}${fmtMoney(ecart)} DA` }
          : { label: 'Solde théorique', value: `${fmtMoney(arrete.solde_theorique)} DA` }}
      />

      {/* Zone de visa : caissier / responsable */}
      <div className="avoid-break" style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 26, fontSize: 10, color: MUTED }}>
        {['Le caissier', 'Le responsable'].map((l, i) => (
          <div key={l}>
            <div style={{ color: INK, fontWeight: 600 }}>{l}{i === 0 && utilisateur ? ` : ${utilisateur}` : ''}</div>
            <div style={{ height: 38 }} />
            <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 4, width: '55mm' }}>Signature</div>
          </div>
        ))}
      </div>
    </div>
  );

  return {
    title: `Arrêté de caisse ${compte} ${arrete.date}`,
    html: renderToStaticMarkup(body),
    css: BASE_CSS,
  };
}
