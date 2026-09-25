import { Link, useLocation } from 'react-router-dom';

export default function NotFound() {
  const { pathname } = useLocation();
  return (
    <div className="bg-surface border border-line-soft rounded-md shadow-soft p-6 max-w-[560px]">
      <div className="text-[15px] font-extrabold text-ink">Page introuvable</div>
      <div className="text-[12px] text-ink-muted mt-1">L’adresse <span className="money">{pathname}</span> ne correspond à aucun écran.</div>
      <Link to="/" className="inline-block mt-4 rounded-md px-3 py-1.5 font-bold text-[12px] text-white bg-brand-700">Tableau de bord</Link>
    </div>
  );
}
