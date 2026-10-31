import { useState, type ReactNode } from 'react';
import {
  Alert, Badge, BarList, Button, ButtonGroup, Card, CardHeader, Checkbox, ConfirmDialog, ContextMenu, DateRangeField, DescriptionList,
  DocBadge, EmptyState, Field, Icon, IconBadge, IconButton, Kbd, KpiTile, Menu, Modal, Money, PageHeader, PayStatus,
  SearchField, SectionTitle, SegmentedControl, Select, Skeleton, StatusDot, Switch, Tabs, TextInput, Tooltip, TotalsPanel, useToast,
  type ContextMenuAnchor, type ContextMenuItem, type IconName, type Tone,
} from '../components/ui';
import { isoFirstOfMonth, isoToday } from '../lib/format';

/**
 * Vitrine de la charte graphique v2 (documentation vivante, recette visuelle clair / sombre) :
 * chaque composant réutilisable dans ses variantes. Aucune donnée métier.
 */
const TONES: Tone[] = ['brand', 'neutral', 'success', 'warning', 'danger', 'info', 'teal', 'violet', 'orange'];
const ICONES: IconName[] = [
  'search', 'plus', 'edit', 'trash', 'download', 'printer', 'check', 'close', 'alert', 'info', 'filter', 'columns', 'refresh',
  'invoice', 'delivery', 'order', 'quote', 'creditNote', 'return', 'receipt', 'cart', 'package', 'movements', 'inventory',
  'expiry', 'users', 'building', 'wallet', 'bank', 'dueDates', 'stats', 'pie', 'trend', 'settings', 'lock', 'keyboard', 'sun', 'moon',
];

function Bloc({ titre, description, children }: { titre: string; description?: string; children: ReactNode }) {
  return (
    <Card padding="lg">
      <CardHeader title={titre} description={description} />
      {children}
    </Card>
  );
}

export default function DemoUI() {
  const toast = useToast();
  const [onglet, setOnglet] = useState<'a' | 'b' | 'c'>('a');
  const [type, setType] = useState<'FA' | 'BL' | 'BC' | 'FAV'>('FA');
  const [densite, setDensite] = useState<'compact' | 'confort'>('compact');
  const [recherche, setRecherche] = useState('');
  const [periode, setPeriode] = useState<[string, string]>([isoFirstOfMonth(), isoToday()]);
  const [modale, setModale] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [actif, setActif] = useState(true);
  const [menuCtx, setMenuCtx] = useState<{ anchor: ContextMenuAnchor; trigger?: HTMLElement } | null>(null);
  const [colonnes, setColonnes] = useState({ ht: true, tva: true, marge: false });
  const [densiteMenu, setDensiteMenu] = useState<'compacte' | 'confort'>('compacte');
  const elementsCtx: ContextMenuItem[] = [
    { heading: 'Pièce FA 2026/0042' },
    { label: 'Ouvrir', icon: 'eye', kbd: 'Entrée', onSelect: () => toast.info('Ouvrir (démo).') },
    { label: 'Dupliquer', icon: 'copy', kbd: 'Ctrl+D', onSelect: () => toast.success('Pièce dupliquée (démo).') },
    { label: 'Imprimer', icon: 'printer', kbd: 'Ctrl+P', onSelect: () => undefined },
    { label: 'Transformer en avoir', icon: 'creditNote', disabled: true, onSelect: () => undefined },
    'separator',
    { heading: 'Colonnes' },
    { label: 'Total HT', checked: colonnes.ht, keepOpen: true, onSelect: () => setColonnes((c) => ({ ...c, ht: !c.ht })) },
    { label: 'TVA', checked: colonnes.tva, keepOpen: true, onSelect: () => setColonnes((c) => ({ ...c, tva: !c.tva })) },
    { label: 'Marge', checked: colonnes.marge, keepOpen: true, onSelect: () => setColonnes((c) => ({ ...c, marge: !c.marge })) },
    { heading: 'Densité' },
    { label: 'Compacte', checked: densiteMenu === 'compacte', radio: true, onSelect: () => setDensiteMenu('compacte') },
    { label: 'Confort', checked: densiteMenu === 'confort', radio: true, onSelect: () => setDensiteMenu('confort') },
    'separator',
    { label: 'Supprimer', icon: 'trash', tone: 'danger', kbd: 'Suppr', onSelect: () => setConfirm(true) },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Charte graphique & composants" icon="layers"
                  breadcrumb={[{ label: 'Configuration', to: '/parametres' }, { label: 'Charte graphique' }]}
                  description="Référence visuelle de l’application : jetons, typographie, composants et états. Basculez en mode sombre pour la recette.">
        <Button icon="keyboard" onClick={() => toast.info('Ctrl+/ affiche tous les raccourcis clavier.')}>Raccourcis</Button>
        <Button variant="primary" icon="plus" onClick={() => setModale(true)}>Ouvrir une modale</Button>
      </PageHeader>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Bloc titre="Couleurs sémantiques" description="Texte *-text sur fond *-soft : contraste AA en clair et en sombre.">
          <div className="grid grid-cols-3 gap-2">
            {TONES.map((t) => (
              <div key={t} className="flex items-center gap-2 rounded-md border border-line-soft p-2">
                <IconBadge name="check" tone={t} size="sm" />
                <span className="text-sm font-semibold text-ink-label">{t}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-4">
            {(['FA', 'BL', 'BCT', 'BC', 'DO', 'FP', 'FAV', 'BRT', 'BR'] as const).map((c) => <DocBadge key={c} code={c} />)}
            <PayStatus regler={0} reste={0} /><PayStatus regler={5} reste={5} /><PayStatus regler={0} reste={5} />
            <Badge tone="info" icon="clock">En attente</Badge>
          </div>
        </Bloc>

        <Bloc titre="Typographie" description="Échelle nommée — Plus Jakarta Sans (interface) et JetBrains Mono (montants).">
          <div className="flex flex-col gap-1.5">
            <span className="text-display font-extrabold money">1 234 567,89</span>
            <span className="text-3xl font-extrabold">Indicateur principal — 3xl</span>
            <span className="text-2xl font-extrabold tracking-tight">Titre d’écran — 2xl</span>
            <span className="text-xl font-extrabold">Titre de modale — xl</span>
            <span className="text-lg font-bold">Titre de section — lg</span>
            <span className="text-base">Corps de texte — base (13 px)</span>
            <span className="text-sm text-ink-label">Cellules de grille, formulaires denses — sm</span>
            <span className="text-xs text-ink-muted">Libellés, aides, sous-textes — xs</span>
            <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted">Surtitre — 2xs</span>
          </div>
        </Bloc>

        <Bloc titre="Boutons" description="Une seule action primaire par zone ; le destructif est isolé.">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" icon="plus">Nouvelle pièce</Button>
              <Button icon="printer">Imprimer</Button>
              <Button variant="ghost" icon="filter">Filtres</Button>
              <Button variant="danger" icon="trash">Supprimer</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="success" icon="cash" kbd="F10">Encaisser</Button>
              <Button variant="accent" kbd="F10">Encaisser tout</Button>
              <Button variant="danger-solid">Supprimer la pièce</Button>
              <Button variant="link" iconRight="arrowRight">Voir le détail</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm">Petit</Button><Button>Moyen</Button><Button size="lg">Grand</Button>
              <Button variant="primary" loading>Enregistrement…</Button>
              <Button disabled>Désactivé</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <IconButton icon="edit" label="Modifier" />
              <IconButton icon="trash" label="Supprimer" tone="danger" />
              <IconButton icon="download" label="Exporter" variant="secondary" />
              <ButtonGroup attached>
                <Button size="sm" pressed>Jour</Button><Button size="sm">Semaine</Button><Button size="sm">Mois</Button>
              </ButtonGroup>
              <Menu label="Plus d’actions" items={[
                { label: 'Dupliquer', icon: 'copy', onSelect: () => toast.success('Pièce dupliquée (démo).') },
                { label: 'Ticket 80 mm', icon: 'receipt', onSelect: () => undefined },
                'separator',
                { label: 'Supprimer', icon: 'trash', tone: 'danger', onSelect: () => setConfirm(true) },
              ]} />
            </div>
          </div>
        </Bloc>

        <Bloc titre="Champs de saisie" description="Libellé au-dessus, requis marqués, erreurs reliées au champ.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Client" required><TextInput leading="users" placeholder="Nom ou code" /></Field>
            <Field label="Mode de paiement"><Select placeholder="—"><option>Espèces</option><option>Chèque</option></Select></Field>
            <Field label="Montant" hint="DA"><TextInput mono align="right" defaultValue="12 500,00" /></Field>
            <Field label="Remise %" error="La remise ne peut pas dépasser 100 %"><TextInput mono align="right" defaultValue="120" /></Field>
            <div className="col-span-2 flex flex-wrap items-center gap-3">
              <SearchField value={recherche} onChange={setRecherche} shortcut="Ctrl K" width={240} />
              <DateRangeField from={periode[0]} to={periode[1]} onChange={(a, b) => setPeriode([a, b])} />
            </div>
            <div className="col-span-2 flex flex-wrap items-center gap-5">
              <Checkbox label="Imprimer le ticket" defaultChecked />
              <Switch checked={actif} onChange={setActif} label="Article actif" />
              <SegmentedControl label="Densité" value={densite} onChange={setDensite}
                                options={[{ value: 'compact', label: 'Compacte' }, { value: 'confort', label: 'Confort' }]} />
            </div>
          </div>
        </Bloc>

        <Bloc titre="Onglets" description="Vues d’un écran en « pill », sous-filtres en « underline » teintés par type de pièce.">
          <div className="flex flex-col gap-3">
            <Tabs label="Vue" value={onglet} onChange={setOnglet} options={[
              { code: 'a', label: 'Documents', icon: 'invoice' }, { code: 'b', label: 'Journal', icon: 'journal' }, { code: 'c', label: 'Échéances', count: 12 },
            ]} />
            <Tabs label="Type" variant="underline" value={type} onChange={setType} options={[
              { code: 'FA', label: 'Factures', tone: 'brand', count: 128 }, { code: 'BL', label: 'Bons de livraison', tone: 'teal' },
              { code: 'BC', label: 'Commandes', tone: 'violet' }, { code: 'FAV', label: 'Avoirs', tone: 'danger' },
            ]} />
          </div>
        </Bloc>

        <Bloc titre="Menu contextuel et info-bulles"
              description="Clic droit (ou Maj+F10) sur la zone, ou bouton : ↑ ↓ Début Fin, une lettre pour sauter, Échap. Info-bulles au survol (450 ms) et au focus clavier.">
          <div className="flex flex-col gap-3">
            <div tabIndex={0} role="button" aria-haspopup="menu" aria-label="Zone de démonstration du menu contextuel"
                 onContextMenu={(e) => {
                   e.preventDefault();
                   setMenuCtx({ anchor: e.clientX || e.clientY ? { x: e.clientX, y: e.clientY } : e.currentTarget.getBoundingClientRect() });
                 }}
                 className="h-20 rounded-md border border-dashed border-line-strong bg-sunken flex items-center justify-center gap-2 text-sm text-ink-muted">
              <Icon name="more" size={16} /> Clic droit ici
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button icon="columns" iconRight="chevronDown" aria-haspopup="menu" aria-expanded={!!menuCtx?.trigger}
                      onClick={(e) => {
                        const b = e.currentTarget;
                        setMenuCtx((m) => (m?.trigger === b ? null : { anchor: b.getBoundingClientRect(), trigger: b }));
                      }}>
                Affichage
              </Button>
              <Tooltip content="Enregistrer la pièce" kbd="Ctrl+S"><Button variant="primary" icon="save">Enregistrer</Button></Tooltip>
              <Tooltip content="Encaisser" kbd="F10" side="bottom"
                       description="Enregistre le règlement du client et imprime le ticket si l’option est cochée.">
                <Button variant="success" icon="cash">Encaisser</Button>
              </Tooltip>
              <IconButton icon="printer" label="Imprimer" tooltip kbd="Ctrl+P" />
              <IconButton icon="refresh" label="Actualiser" tooltip tooltipSide="bottom" />
              <IconButton icon="trash" label="Supprimer" tone="danger" tooltip />
            </div>
          </div>
        </Bloc>

        <Bloc titre="États et retours" description="Dire ce qui se passe : alertes, notifications, squelettes, vides.">
          <div className="flex flex-col gap-2.5">
            <Alert tone="success" compact>Pièce FA 2026/0042 enregistrée.</Alert>
            <Alert tone="warning" title="Stock insuffisant">2 articles dépassent le stock disponible.</Alert>
            <Alert tone="danger" compact action={<Button size="sm" icon="refresh">Réessayer</Button>}>Agent injoignable.</Alert>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => toast.success('Enregistrement réussi.')}>Toast succès</Button>
              <Button size="sm" onClick={() => toast.warning('Échéance dépassée pour 3 clients.')}>Toast attention</Button>
              <Button size="sm" onClick={() => toast.error('Connexion à l’agent perdue.')}>Toast erreur</Button>
            </div>
            <div className="flex items-center gap-3"><Skeleton width={120} /><Skeleton width={60} /><Skeleton width={180} /></div>
            <div className="flex items-center gap-4 text-sm text-ink-label">
              <StatusDot online label="Agent connecté" /><StatusDot online={false} label="Hors ligne" />
              <span className="inline-flex items-center gap-1"><Kbd>Ctrl</Kbd><Kbd>K</Kbd></span>
              <Money value={-1520.5} /><Money value={980} signed currency />
            </div>
          </div>
        </Bloc>
      </div>

      <SectionTitle icon="dashboard">Indicateurs</SectionTitle>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiTile label="Chiffre d’affaires" icon="stats" value="1 245 800,00" sub="+12 % vs mois dernier" to="/" />
        <KpiTile label="Créances" icon="debtors" tone="danger" valueTone="danger" value="312 400,00" sub="18 débiteurs" />
        <KpiTile label="Chargement" icon="wallet" tone="success" loading />
        <KpiTile label="Marge" icon="trend" tone="neutral" locked="Réservé aux responsables" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card>
          <CardHeader title="Fiche" icon="users" iconTone="violet" />
          <DescriptionList items={[
            { label: 'Code', value: 'C0042', mono: true }, { label: 'Téléphone', value: '0550 12 34 56' },
            { label: 'Adresse', value: 'Rue des Frères Bouadou, Alger', full: true }, { label: 'NIF', value: '' },
          ]} />
        </Card>
        <TotalsPanel rows={[
          { label: 'Total HT', value: 100000 }, { label: 'Remise', value: -5000 }, { label: 'TVA', value: 18050 }, { label: 'Timbre', value: 1131.5, muted: true },
        ]} total={{ label: 'Net à payer', value: 114181.5 }} />
        <Card>
          <CardHeader title="Top familles" icon="pie" iconTone="teal" />
          <BarList tone="teal" items={[
            { label: 'Antalgiques', value: 420000 }, { label: 'Antibiotiques', value: 310000 }, { label: 'Vitamines', value: 120000 },
          ]} />
        </Card>
      </div>

      <Card padding="none">
        <EmptyState icon="inbox" title="Aucune pièce sur la période" description="Modifiez la période ou créez votre première pièce de vente."
                    action={<Button variant="primary" icon="plus">Nouvelle pièce</Button>} />
      </Card>

      <SectionTitle icon="grid">Icônes</SectionTitle>
      <Card>
        <div className="grid grid-cols-6 md:grid-cols-10 xl:grid-cols-[repeat(19,minmax(0,1fr))] gap-2">
          {ICONES.map((n) => (
            <div key={n} className="flex flex-col items-center gap-1 rounded-md p-2 text-ink-label hover:bg-hover" title={n}>
              <Icon name={n} size={20} /><span className="text-2xs text-ink-muted truncate max-w-full">{n}</span>
            </div>
          ))}
        </div>
      </Card>

      {menuCtx && (
        <ContextMenu label="Actions de la pièce" anchor={menuCtx.anchor} trigger={menuCtx.trigger} items={elementsCtx}
                     width={menuCtx.trigger ? 240 : 270} onClose={() => setMenuCtx(null)} />
      )}
      {modale && (
        <Modal title="Nouveau règlement" subtitle="Client C0042 — Pharmacie El Amel" icon="cash" iconTone="success"
               onClose={() => setModale(false)} closeOnOverlay={false}
               footer={<><Button onClick={() => setModale(false)}>Annuler</Button><Button variant="primary" icon="check" onClick={() => { setModale(false); toast.success('Règlement enregistré (démo).'); }}>Enregistrer</Button></>}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Montant" required><TextInput mono align="right" autoFocus /></Field>
            <Field label="Mode"><Select><option>Espèces</option><option>Chèque</option></Select></Field>
            <Field label="Observation" span={2}><TextInput /></Field>
          </div>
        </Modal>
      )}
      {confirm && (
        <ConfirmDialog danger title="Supprimer la pièce ?" message="La pièce FA 2026/0042 et ses règlements seront supprimés définitivement."
                       confirmLabel="Supprimer la pièce" onConfirm={() => setConfirm(false)} onCancel={() => setConfirm(false)} />
      )}
    </div>
  );
}
