import { Link } from 'react-router-dom';
import { VENTE_TYPE_CODE } from '../../api/types';
import { fmtDate, fmtMoney } from '../../lib/format';
import { DocBadge } from '../ui/atoms';
import { Card, SectionTitle } from '../ui/Card';
import { Icon } from '../ui/Icon';

type Ref = { id: number; numero: string; type?: number; type_doc?: string; date?: string; net_a_payer?: number };

/**
 * Pièces liées : facture de regroupement, BL groupés, retours émis, pièce
 * d'origine d'un retour. Rien n'est rendu si la pièce n'a aucun lien.
 */
export default function LiensPiece({ base, codes = VENTE_TYPE_CODE, factureGroupee, blsGroupes, retours, pieceOrigine }: {
  /** Préfixe des routes de détail : '/ventes' ou '/achats'. */
  base: string;
  /** Type numérique → code (VENTE_TYPE_CODE / ACHAT_TYPE_CODE). */
  codes?: Record<number, string>;
  factureGroupee?: Ref | null;
  blsGroupes?: Ref[];
  retours?: Ref[];
  pieceOrigine?: Ref | null;
}) {
  const bls = blsGroupes ?? [];
  const rets = retours ?? [];
  if (!factureGroupee && !pieceOrigine && bls.length === 0 && rets.length === 0) return null;

  return (
    <Card padding="sm">
      <div className="px-1 flex flex-col gap-3 text-sm">
        <SectionTitle icon="layers">Pièces liées</SectionTitle>
        {factureGroupee && (
          <div className="flex items-center gap-1.5 flex-wrap">
            Facturé dans <DocBadge code="FA" />
            <Link to={`${base}/${factureGroupee.id}`}
                  className="inline-flex items-center gap-1 font-bold text-brand-text hover:underline underline-offset-2">
              n° {factureGroupee.numero}<Icon name="arrowRight" size={14} />
            </Link>
          </div>
        )}
        {pieceOrigine && (
          <div className="flex items-center gap-1.5 flex-wrap">
            Retour issu de <b>{pieceOrigine.type_doc ?? ''}</b>
            <Link to={`${base}/${pieceOrigine.id}`}
                  className="inline-flex items-center gap-1 font-bold text-brand-text hover:underline underline-offset-2">
              n° {pieceOrigine.numero}<Icon name="arrowRight" size={14} />
            </Link>
          </div>
        )}
        {bls.length > 0 && (
          <Liste titre={`Bons de livraison regroupés (${bls.length})`} base={base} items={bls} code={() => 'BL'} />
        )}
        {rets.length > 0 && (
          <Liste titre={`Retours / avoirs émis (${rets.length})`} base={base} items={rets}
                 code={(r) => (r.type != null ? codes[Number(r.type)] : undefined) ?? 'FAV'} />
        )}
      </div>
    </Card>
  );
}

function Liste({ titre, base, items, code }: { titre: string; base: string; items: Ref[]; code: (r: Ref) => string }) {
  return (
    <div>
      <div className="text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1">{titre}</div>
      <div className="flex flex-col">
        {items.map((r) => (
          <Link key={r.id} to={`${base}/${r.id}`}
                className="flex items-center gap-3 py-1.5 px-1 -mx-1 rounded-xs border-t border-dashed border-line-soft hover:bg-hover hover:text-brand-text transition-colors duration-fast">
            <DocBadge code={code(r)} />
            <span className="money font-bold">{r.numero}</span>
            {r.date && <span className="text-ink-muted">{fmtDate(r.date)}</span>}
            {r.net_a_payer != null && <span className="money ml-auto">{fmtMoney(r.net_a_payer)} DA</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
