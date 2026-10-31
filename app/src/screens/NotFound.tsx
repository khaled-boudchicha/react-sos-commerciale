import { useLocation } from 'react-router-dom';
import { StatePanel } from '../components/ui/States';
import { Button } from '../components/ui/Button';

export default function NotFound() {
  const { pathname } = useLocation();
  return (
    <StatePanel kind="not-found"
                description={<>L’adresse <span className="money text-ink-label">{pathname}</span> ne correspond à aucun écran.</>}
                actions={<Button variant="primary" icon="dashboard" to="/">Tableau de bord</Button>} />
  );
}
