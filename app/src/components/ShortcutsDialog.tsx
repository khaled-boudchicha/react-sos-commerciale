import Dialog from './ui/Dialog';
import { Kbd } from './ui/Icon';
import { Button } from './ui/Button';
import { SectionTitle } from './ui/Card';

/** Aide « Raccourcis clavier » (Ctrl+/) — héritage Delphi : tout se fait au clavier. */
const GROUPES: { titre: string; items: [string[], string][] }[] = [
  {
    titre: 'Partout',
    items: [
      [['Ctrl', 'K'], 'Rechercher un client, un article, une pièce ou un écran'],
      [['Ctrl', '/'], 'Afficher cette aide'],
      [['Ctrl', 'N'], 'Nouvelle pièce (tableau de bord, ventes, achats)'],
      [['Échap'], 'Fermer la fenêtre ou le panneau ouvert'],
      [['Tab'], 'Passer au champ suivant (Maj+Tab : précédent)'],
    ],
  },
  {
    titre: 'Ruban de commandes',
    items: [
      [['Alt'], 'Afficher les touches d’accès, puis la lettre de l’onglet et de la commande'],
      [['Ctrl', 'F1'], 'Réduire / épingler le ruban'],
    ],
  },
  {
    titre: 'Saisie d’une pièce',
    items: [
      [['F2'], 'Aller à la recherche d’article'],
      [['F3'], 'Aller à la recherche de client'],
      [['F10'], 'Encaisser tout et enregistrer'],
    ],
  },
  {
    titre: 'Vente au comptoir',
    items: [
      [['F2'], 'Encaisser'],
      [['F12'], 'Montant exact + ticket'],
      [['F11'], 'Montant exact sans ticket'],
      [['F4'], 'Annuler le ticket'],
      [['F6'], 'Revenir au scan'],
      [['F7'], 'Remise'],
      [['F8'], 'Client'],
      [['F9'], 'Réimprimer le dernier ticket'],
      [['F10'], 'Ventes du jour'],
      [['↑', '↓'], 'Changer de ligne'],
      [['+', '−'], 'Modifier la quantité'],
      [['Ctrl', 'Q'], 'Quantité calculée depuis un montant TTC'],
      [['Suppr'], 'Retirer la ligne sélectionnée'],
      [['Ctrl', '1…5'], 'Passer d’un ticket en attente à l’autre'],
    ],
  },
  {
    titre: 'Listes et grilles',
    items: [
      [['↑', '↓'], 'Se déplacer de ligne en ligne'],
      [['Entrée'], 'Ouvrir la ligne sélectionnée'],
    ],
  },
];

export default function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Raccourcis clavier" subtitle="Travaillez sans la souris, comme dans la version Delphi" icon="keyboard"
            onClose={onClose} size="lg" footer={<Button variant="primary" onClick={onClose}>Compris</Button>}>
      <div className="grid grid-cols-2 gap-x-8 gap-y-5">
        {GROUPES.map((g) => (
          <section key={g.titre}>
            <SectionTitle>{g.titre}</SectionTitle>
            <ul className="flex flex-col gap-1.5">
              {g.items.map(([touches, libelle]) => (
                <li key={libelle} className="flex items-center gap-3 text-sm text-ink-label">
                  <span className="flex items-center gap-1 min-w-[78px]">
                    {touches.map((t) => <Kbd key={t}>{t}</Kbd>)}
                  </span>
                  <span>{libelle}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
