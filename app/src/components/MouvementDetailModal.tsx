import { Link } from 'react-router-dom';
import { MouvementTresorie } from '../api/types';
import { fmtDate, fmtMoney } from '../lib/format';

/** Origine d'un mouvement d'après sa clé (cf. tresorieComplete côté agent). */
function origine(m: MouvementTresorie & { n_ligne?: number | null; raison?: string | null; n_cheque?: string | null }) {
  const n = Number(m.n_ligne) || 0;
  if (m.cle.startsWith('RGF')) return { libelle: 'Règlement client', lien: n > 0 ? `/ventes/${n}` : null, piece: 'Voir la pièce de vente' };
  if (m.cle.startsWith('RG')) return { libelle: 'Paiement fournisseur', lien: n > 0 ? `/achats/${n}` : null, piece: "Voir la pièce d'achat" };
  if (m.cle.startsWith('AVC')) return { libelle: 'Avance client', lien: m.code_tier ? `/tiers/client/${encodeURIComponent(m.code_tier)}` : null, piece: 'Voir le client' };
  if (m.cle.startsWith('EN')) return { libelle: 'Encaissement', lien: null, piece: '' };
  if (m.cle.startsWith('DE')) return { libelle: 'Décaissement', lien: null, piece: '' };
  if (m.cle.startsWith('TR')) return { libelle: 'Virement entre comptes', lien: null, piece: '' };
  return { libelle: m.categorie ?? 'Mouvement', lien: null, piece: '' };
}

/** Détail d'un mouvement de trésorerie, avec lien vers la pièce ou le tiers d'origine. */
export default function MouvementDetailModal({ m, onClose, onAnnuler }: {
  m: MouvementTresorie; onClose: () => void; onAnnuler?: () => void;
}) {
  const mm = m as MouvementTresorie & { n_ligne?: number | null; raison?: string | null; n_cheque?: string | null };
  const o = origine(mm);
  const lignes: [string, string | number | null | undefined][] = [
    ['Date', fmtDate(m.date)],
    ['Nature', `${o.libelle}${m.categorie ? ` · ${m.categorie}` : ''}`],
    ['Libellé', m.objet],
    ['Tiers', mm.raison ?? m.tier ?? m.code_tier],
    ['Compte', m.compte],
    ['Mode de paiement', m.mode_payement],
    ['Banque / N° chèque', [m.banque, mm.n_cheque].filter(Boolean).join(' · ') || null],
    ['Saisi par', m.user],
    ['Observation', m.observation],
    ['Référence', m.cle],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgb(15 26 46 / .45)' }} onClick={onClose}>
      <div className="w-[460px] bg-surface border border-line-soft rounded-lg shadow-lifted p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start mb-3">
          <div>
            <div className="font-extrabold text-[15px]">{o.libelle}</div>
            <div className="money text-[20px] font-extrabold mt-1" style={{ color: m.montant < 0 ? 'var(--danger)' : 'var(--success)' }}>
              {m.montant < 0 ? '−' : '+'}{fmtMoney(Math.abs(m.montant))} DA
            </div>
          </div>
          <button onClick={onClose} className="ml-auto text-ink-muted text-[16px]">✕</button>
        </div>
        <div className="border-t border-line-soft">
          {lignes.filter(([, v]) => v != null && v !== '').map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-1.5 border-b border-dashed border-line-soft text-[12px]">
              <span className="text-ink-muted">{k}</span><span className="text-right text-ink">{String(v)}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          {o.lien && (
            <Link to={o.lien} onClick={onClose} className="rounded-md px-3 py-1.5 font-bold text-[12px] border border-line text-brand-700">
              {o.piece} →
            </Link>
          )}
          {onAnnuler && (
            <button onClick={onAnnuler} className="ml-auto rounded-md px-3 py-1.5 font-bold text-[12px]"
                    style={{ background: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: 'var(--danger)' }}>
              Annuler ce mouvement
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
