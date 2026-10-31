import { useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { VENTES } from '../../api/queries';
import { Vente } from '../../api/types';
import Dialog, { DialogButton } from '../../components/ui/Dialog';
import { fmtMoney, isoToday } from '../../lib/format';
import { useDroits } from '../../lib/droits';
import { useSession } from '../../store/session';

/**
 * Ventes au comptoir du jour (portage de ListBon.pas, F10) : réimpression d'un ticket,
 * ouverture de la pièce. Restreint aux ventes de l'utilisateur si son droit l'exige.
 */
export default function VentesJourDialog({ onReimprimer, onClose }: {
  onReimprimer: (id: number) => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { restreintAuxSiennes } = useDroits();
  const moi = useSession((s) => s.dossierUser?.id);
  const today = isoToday();
  const { data, loading, error } = useQuery(VENTES, {
    fetchPolicy: 'network-only',
    variables: {
      type_doc: 'BCT', date_debut: today, date_fin: today, limit: 200, offset: 0,
      user_id: restreintAuxSiennes('vente', 'BCT') ? Number(moi) : undefined,
    },
  });
  const ventes: Vente[] = data?.ventes?.data ?? [];
  const total = ventes.reduce((s, v) => s + (Number(v.net_a_payer) || 0), 0);
  const encaisse = ventes.reduce((s, v) => s + (Number(v.regler) || 0), 0);

  return (
    <Dialog title="Ventes au comptoir du jour" subtitle={`${ventes.length} ticket(s) · total ${fmtMoney(total)} DA · encaissé ${fmtMoney(encaisse)} DA`}
            onClose={onClose} width={760} footer={<DialogButton onClick={onClose} kbd="Échap">Fermer</DialogButton>}>
      {loading && <div className="text-[12px] text-ink-muted">Chargement…</div>}
      {error && <div className="text-[12px]" style={{ color: 'var(--danger)' }}>{error.message}</div>}
      {!loading && ventes.length === 0 && <div className="text-[12px] text-ink-muted">Aucune vente au comptoir aujourd’hui.</div>}
      {ventes.length > 0 && (
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-[10.5px] uppercase tracking-wider text-ink-muted border-b border-line-soft">
              <th className="py-1.5">N°</th><th>Client</th><th>Utilisateur</th>
              <th className="text-right">Net</th><th className="text-right">Réglé</th><th />
            </tr>
          </thead>
          <tbody>
            {ventes.map((v) => (
              <tr key={v.id} className="border-b border-line-soft last:border-b-0 hover:bg-bg">
                <td className="py-1.5 money font-bold">{v.numero}</td>
                <td>{v.raison || 'Comptoir'}</td>
                <td className="text-ink-muted">{v.user_name ?? ''}</td>
                <td className="text-right money font-bold">{fmtMoney(v.net_a_payer)}</td>
                <td className="text-right money" style={{ color: Number(v.reste_a_payer) > 0 ? 'var(--warning)' : undefined }}>{fmtMoney(v.regler)}</td>
                <td className="text-right whitespace-nowrap pl-2">
                  <button onClick={() => onReimprimer(v.id)} className="text-[11.5px] font-bold text-brand-text mr-3">Réimprimer</button>
                  <button onClick={() => { onClose(); navigate(`/ventes/${v.id}`); }} className="text-[11.5px] font-bold text-ink-label">Ouvrir →</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Dialog>
  );
}
