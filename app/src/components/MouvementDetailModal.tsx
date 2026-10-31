import { Link } from 'react-router-dom';
import { MouvementTresorie } from '../api/types';
import { fmtDate, fmtMoney } from '../lib/format';
import Dialog from './ui/Dialog';
import { Button } from './ui/Button';
import { Icon } from './ui/Icon';

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
  const visibles = lignes.filter(([, v]) => v != null && v !== '');
  return (
    <Dialog title={o.libelle} width={460} size="sm" onClose={onClose}
            icon="wallet" iconTone={m.montant < 0 ? 'danger' : 'success'}
            footerStart={o.lien ? (
              <Link to={o.lien} onClick={onClose}
                    className="inline-flex items-center gap-2 h-control-md px-3.5 rounded-md border border-line bg-surface text-base font-semibold text-brand-text hover:bg-hover hover:border-line-strong transition-colors duration-fast">
                {o.piece}<Icon name="arrowRight" size={16} />
              </Link>
            ) : undefined}
            footer={(o.lien || onAnnuler) ? (
              onAnnuler ? <Button variant="danger" icon="trash" onClick={onAnnuler}>Annuler ce mouvement</Button> : <span />
            ) : undefined}>
      <div className="money text-2xl font-extrabold mb-3" style={{ color: m.montant < 0 ? 'var(--danger-text)' : 'var(--success-text)' }}>
        {m.montant < 0 ? '−' : '+'}{fmtMoney(Math.abs(m.montant))} DA
      </div>
      <dl className="border-t border-line-soft">
        {visibles.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-1.5 border-b border-dashed border-line-soft text-sm">
            <dt className="text-ink-muted">{k}</dt><dd className="text-right text-ink font-semibold">{String(v)}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
