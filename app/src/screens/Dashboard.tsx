import { useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { DASHBOARD } from '../api/dashboard';
import { StatVentesResult, DebiteursResult } from '../api/types';
import { fmtMoney, isoFirstOfMonth, isoToday } from '../lib/format';

type SoldeCaisse = { banque: string; solde: number; total_entrees: number; total_sorties: number };

export default function Dashboard() {
  const { data, loading, error } = useQuery(DASHBOARD, {
    variables: { debutMois: isoFirstOfMonth(), aujourdhui: isoToday() },
  });

  const stat: StatVentesResult | undefined = data?.statVentes;
  const soldes: SoldeCaisse[] = Array.isArray(data?.soldesCaisse) ? data.soldesCaisse : [];
  const totalCaisse = soldes.reduce((s, c) => s + Number(c.solde ?? 0), 0);
  const deb: DebiteursResult | undefined = data?.debiteurs;
  const alertes: unknown[] = Array.isArray(data?.alertesStock) ? data.alertesStock : [];

  const lignes = stat?.lignes ?? [];
  const maxJour = Math.max(1, ...lignes.map((l) => Number(l.total_ttc ?? 0)));

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg text-white px-6 py-5 relative overflow-hidden" style={{ background: 'var(--gradient-hero)' }}>
        <div className="text-[11px] font-semibold uppercase tracking-wider opacity-75">Chiffre d'affaires — mois en cours</div>
        <div className="money text-[28px] font-extrabold">{loading ? '…' : `${fmtMoney(stat?.total_ttc)} DA`}</div>
        <div className="text-[12px] opacity-80">
          Marge brute : <span className="money">{fmtMoney(stat?.total_marge)} DA</span>
          {stat != null && <> · marge nette {fmtMoney(stat.pct_marge_global, 1)} %</>}
        </div>
        {error && <div className="text-[11px] opacity-90 mt-1">Erreur : {error.message}</div>}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Link to="/tresorerie" className="bg-surface border border-line-soft rounded-md shadow-soft p-4 hover:border-brand-300">
          <div className="text-[11px] font-semibold text-ink-muted mb-1.5">Caisse (tous comptes)</div>
          <div className="money text-[19px] font-extrabold">{loading ? '…' : `${fmtMoney(totalCaisse)} DA`}</div>
          <div className="text-[10.5px] text-ink-muted">{soldes.length} compte(s)</div>
        </Link>
        <Link to="/tiers" className="bg-surface border border-line-soft rounded-md shadow-soft p-4 hover:border-brand-300">
          <div className="text-[11px] font-semibold text-ink-muted mb-1.5">Créances clients</div>
          <div className="money text-[19px] font-extrabold" style={{ color: 'var(--danger)' }}>
            {loading ? '…' : `${fmtMoney(deb?.total_creances)} DA`}
          </div>
          <div className="text-[10.5px] text-ink-muted">
            {deb ? `${deb.total_clients} débiteur(s) · +60 j : ${fmtMoney(deb.bucket_60_plus)}` : ''}
          </div>
        </Link>
        <Link to="/stock" className="bg-surface border border-line-soft rounded-md shadow-soft p-4 hover:border-brand-300">
          <div className="text-[11px] font-semibold text-ink-muted mb-1.5">Alertes stock</div>
          <div className="text-[19px] font-extrabold" style={{ color: alertes.length ? 'var(--warning)' : 'var(--text)' }}>
            {loading ? '…' : `${alertes.length} article(s)`}
          </div>
          <div className="text-[10.5px] text-ink-muted">sous le stock minimum</div>
        </Link>
      </div>

      <div className="bg-surface border border-line-soft rounded-md shadow-soft p-4">
        <div className="font-bold text-[13px] mb-3">CA par jour — mois en cours</div>
        {lignes.length === 0 && <div className="text-ink-muted text-[12px]">Aucune vente sur la période.</div>}
        <div className="flex items-end gap-1 h-[110px]">
          {lignes.map((l) => (
            <div key={l.periode} className="flex-1 rounded-t-sm min-w-[6px]" title={`${l.periode} : ${fmtMoney(l.total_ttc)} DA`}
                 style={{ height: `${(Number(l.total_ttc) / maxJour) * 100}%`, background: 'var(--brand-500)', opacity: 0.85 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
