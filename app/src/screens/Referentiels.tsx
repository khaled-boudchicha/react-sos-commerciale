import { useState } from 'react';
import { createPortal } from 'react-dom';
import { DocumentNode, useQuery } from '@apollo/client';
import {
  REFERENTIELS, SOUS_FAMILLES, RAYONS, COMMERCIAUX, CENTRES_COUT,
  CREATE_FAMILLE, UPDATE_FAMILLE, DELETE_FAMILLE,
  CREATE_SOUS_FAMILLE, DELETE_SOUS_FAMILLE,
  CREATE_DEPOT, UPDATE_DEPOT, DELETE_DEPOT,
  CREATE_RAYON, DELETE_RAYON,
  CREATE_UNITE, DELETE_UNITE,
  CREATE_TVA, DELETE_TVA,
  CREATE_BANQUE, UPDATE_BANQUE, DELETE_BANQUE,
  CREATE_MODE_PAYEMENT, DELETE_MODE_PAYEMENT,
  CREATE_COMMERCIAL, UPDATE_COMMERCIAL, DELETE_COMMERCIAL,
  CREATE_CENTRE_COUT, UPDATE_CENTRE_COUT, DELETE_CENTRE_COUT,
  CHARGES, CREATE_CHARGE, UPDATE_CHARGE, DELETE_CHARGE,
} from '../api/queries';
import { Section } from '../components/ui/FormModal';
import { useCrud } from '../forms/useCrud';
import { D, useDroits } from '../lib/droits';
import DataGrid, { Column } from '../components/ui/DataGrid';
import { PageHeader, Tabs } from '../components/ui/atoms';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { EmptyState } from '../components/ui/States';
import { fmtMoney } from '../lib/format';

type Ligne = { id: number } & Record<string, any>;

/** Description d'un référentiel : requête de lecture, mutations, colonnes, formulaire. */
type Ref = {
  code: string;
  label: string;
  /** Clé dans le résultat de la query (REFERENTIELS regroupe plusieurs listes). */
  champ: string;
  query: DocumentNode;
  create: DocumentNode;
  update?: DocumentNode;
  remove: DocumentNode;
  colonnes: Column<Ligne>[];
  sections: Section[];
  titres?: { creer?: string; editer?: string; supprimer?: string };
  /** true si la query renvoie { data, total } au lieu d'un tableau direct. */
  listeDansData?: boolean;
  nomLigne: (l: Ligne) => string;
  /** Valeurs du formulaire de modification (la lecture et l'écriture n'emploient pas toujours les mêmes noms). */
  versFormulaire?: (l: Ligne) => Record<string, unknown>;
  /** Champ du formulaire à proposer en liste, alimentée par une autre liste de REFERENTIELS. */
  listeDe?: { champ: string; source: string };
};

const col = (key: string, header: string, opts: Partial<Column<Ligne>> = {}): Column<Ligne> => ({
  key, header,
  render: (l) => <span className={opts.align === 'right' ? 'money' : ''}>{l[key] ?? '—'}</span>,
  ...opts,
});

const REFS: Ref[] = [
  {
    code: 'familles', label: 'Familles', champ: 'familles', query: REFERENTIELS,
    create: CREATE_FAMILLE, update: UPDATE_FAMILLE, remove: DELETE_FAMILLE,
    colonnes: [col('code', 'Code', { width: '120px' }), col('designation', 'Désignation')],
    sections: [{ title: 'Famille', fields: [
      { name: 'code', label: 'Code', span: 4 },
      { name: 'designation', label: 'Désignation', span: 8, required: true },
    ] }],
    titres: { creer: 'Nouvelle famille', editer: 'Modifier la famille', supprimer: 'Supprimer cette famille ?' },
    nomLigne: (l) => l.designation,
  },
  {
    code: 'sfamilles', label: 'Sous-familles', champ: 'sousFamilles', query: SOUS_FAMILLES,
    create: CREATE_SOUS_FAMILLE, remove: DELETE_SOUS_FAMILLE,
    colonnes: [col('code', 'Code', { width: '120px' }), col('designation', 'Désignation'), col('famille', 'Famille', { width: '160px' })],
    sections: [{ title: 'Sous-famille', fields: [
      { name: 'code', label: 'Code', span: 4 },
      { name: 'designation', label: 'Désignation', span: 8, required: true },
      { name: 'famille', label: 'Famille', span: 6 },
    ] }],
    // La famille se choisit dans la liste des familles (au lieu d'un code tapé à la main)
    listeDe: { champ: 'famille', source: 'familles' },
    titres: { creer: 'Nouvelle sous-famille', supprimer: 'Supprimer cette sous-famille ?' },
    nomLigne: (l) => l.designation,
  },
  {
    code: 'depots', label: 'Dépôts', champ: 'depots', query: REFERENTIELS,
    create: CREATE_DEPOT, update: UPDATE_DEPOT, remove: DELETE_DEPOT,
    colonnes: [col('code', 'Code', { width: '120px' }), col('designation', 'Désignation'), col('adresse', 'Adresse')],
    sections: [{ title: 'Dépôt', fields: [
      { name: 'code', label: 'Code', span: 4 },
      { name: 'designation', label: 'Désignation', span: 8, required: true },
      { name: 'adresse', label: 'Adresse', span: 12 },
    ] }],
    titres: { creer: 'Nouveau dépôt', editer: 'Modifier le dépôt', supprimer: 'Supprimer ce dépôt ?' },
    nomLigne: (l) => l.designation,
  },
  {
    code: 'rayons', label: 'Rayons', champ: 'rayons', query: RAYONS,
    create: CREATE_RAYON, remove: DELETE_RAYON,
    colonnes: [col('code', 'Code', { width: '120px' }), col('designation', 'Désignation')],
    sections: [{ title: 'Rayon', fields: [
      { name: 'code', label: 'Code', span: 4 },
      { name: 'designation', label: 'Désignation', span: 8, required: true },
    ] }],
    titres: { creer: 'Nouveau rayon', supprimer: 'Supprimer ce rayon ?' },
    nomLigne: (l) => l.designation,
  },
  {
    code: 'unites', label: 'Unités', champ: 'unitesMesure', query: REFERENTIELS,
    create: CREATE_UNITE, remove: DELETE_UNITE,
    colonnes: [col('code', 'Abréviation', { width: '140px' }), col('designation', 'Désignation')],
    sections: [{ title: 'Unité de mesure', fields: [
      { name: 'code', label: 'Abréviation', span: 4 },
      { name: 'designation', label: 'Désignation', span: 8, required: true },
    ] }],
    titres: { creer: 'Nouvelle unité', supprimer: 'Supprimer cette unité ?' },
    nomLigne: (l) => l.designation,
  },
  {
    code: 'tva', label: 'TVA', champ: 'tauxTVA', query: REFERENTIELS,
    create: CREATE_TVA, remove: DELETE_TVA,
    colonnes: [
      { key: 'taux', header: 'Taux %', align: 'right', width: '120px', render: (l) => <span className="money">{l.taux}</span> },
      col('designation', 'Désignation'),
    ],
    sections: [{ title: 'Taux de TVA', fields: [
      { name: 'taux', label: 'Taux %', type: 'number', step: '0.1', span: 4, required: true },
      { name: 'designation', label: 'Désignation', span: 8 },
    ] }],
    titres: { creer: 'Nouveau taux de TVA', supprimer: 'Supprimer ce taux ?' },
    nomLigne: (l) => `${l.taux} %`,
  },
  {
    code: 'banques', label: 'Comptes & banques', champ: 'banques', query: REFERENTIELS,
    create: CREATE_BANQUE, update: UPDATE_BANQUE, remove: DELETE_BANQUE,
    colonnes: [
      col('code', 'Code', { width: '110px' }),
      { key: 'nom', header: 'Compte / banque', sortAccessor: (l) => l.nom ?? l.banque ?? '', render: (l) => <b>{l.nom ?? l.banque ?? '—'}</b> },
      col('rib', 'RIB'),
      { key: 'solde_initial', header: 'Solde initial', align: 'right', width: '130px',
        render: (l) => <span className="money">{fmtMoney(l.solde_initial)}</span> },
    ],
    sections: [{ title: 'Compte / banque', fields: [
      { name: 'code', label: 'Code', span: 4 },
      { name: 'nom', label: 'Nom du compte', span: 8, required: true },
      { name: 'rib', label: 'RIB', span: 8 },
      { name: 'solde_initial', label: 'Solde initial', type: 'number', step: '0.01', span: 4 },
    ] }],
    titres: { creer: 'Nouveau compte', editer: 'Modifier le compte', supprimer: 'Supprimer ce compte ?' },
    nomLigne: (l) => l.nom ?? l.banque ?? String(l.id),
  },
  {
    code: 'modes', label: 'Modes de paiement', champ: 'modesPayement', query: REFERENTIELS,
    create: CREATE_MODE_PAYEMENT, remove: DELETE_MODE_PAYEMENT,
    colonnes: [col('code', 'Code', { width: '120px' }), col('designation', 'Désignation')],
    sections: [{ title: 'Mode de paiement', fields: [
      { name: 'code', label: 'Code', span: 4 },
      { name: 'designation', label: 'Désignation', span: 8, required: true },
    ] }],
    titres: { creer: 'Nouveau mode de paiement', supprimer: 'Supprimer ce mode ?' },
    nomLigne: (l) => l.designation,
  },
  {
    code: 'commerciaux', label: 'Commerciaux', champ: 'commerciaux', query: COMMERCIAUX,
    create: CREATE_COMMERCIAL, update: UPDATE_COMMERCIAL, remove: DELETE_COMMERCIAL,
    colonnes: [
      { key: 'nom', header: 'Nom', sortAccessor: (l) => [l.nom, l.prenom].filter(Boolean).join(' '), render: (l) => <b>{[l.nom, l.prenom].filter(Boolean).join(' ') || '—'}</b> },
      col('telephone', 'Téléphone', { width: '140px' }),
      col('email', 'Email', { width: '200px' }),
    ],
    sections: [{ title: 'Commercial', fields: [
      { name: 'nom', label: 'Nom', span: 6, required: true },
      { name: 'prenom', label: 'Prénom', span: 6 },
      // Champs de la table Delphi `commercieaux` (pas de commission ni d'observation)
      { name: 'telephone', label: 'Téléphone', span: 3 },
      { name: 'telephone2', label: 'Téléphone 2', span: 3 },
      { name: 'mobile', label: 'Mobile', span: 3 },
      { name: 'mobile2', label: 'Mobile 2', span: 3 },
      { name: 'email', label: 'Email', span: 5 },
      { name: 'adresse', label: 'Adresse', span: 7 },
    ] }],
    titres: { creer: 'Nouveau commercial', editer: 'Modifier le commercial', supprimer: 'Supprimer ce commercial ?' },
    nomLigne: (l) => [l.nom, l.prenom].filter(Boolean).join(' '),
  },
  {
    code: 'centres', label: 'Centres de coût', champ: 'centresCout', query: CENTRES_COUT,
    create: CREATE_CENTRE_COUT, update: UPDATE_CENTRE_COUT, remove: DELETE_CENTRE_COUT,
    colonnes: [
      { key: 'designation', header: 'Centre', sortAccessor: (l) => l.designation ?? l.Centre ?? '', render: (l) => <b>{l.designation ?? l.Centre ?? '—'}</b> },
      { key: 'observation', header: 'Observation', sortAccessor: (l) => l.observation ?? l.description ?? l.Observation ?? '', render: (l) => <span className="text-ink-muted">{l.observation ?? l.description ?? l.Observation ?? '—'}</span> },
    ],
    sections: [{ title: 'Centre de coût', fields: [
      { name: 'designation', label: 'Désignation', span: 12, required: true },
      { name: 'observation', label: 'Observation', type: 'textarea', span: 12 },
    ] }],
    titres: { creer: 'Nouveau centre de coût', editer: 'Modifier le centre de coût', supprimer: 'Supprimer ce centre ?' },
    nomLigne: (l) => l.designation ?? l.Centre ?? String(l.id),
  },
  {
    // Catalogue des TYPES de charges (les dépenses réelles sont des décaissements)
    code: 'charges', label: 'Types de charges', champ: 'charges', query: CHARGES,
    create: CREATE_CHARGE, update: UPDATE_CHARGE, remove: DELETE_CHARGE,
    listeDansData: true,
    colonnes: [
      { key: 'designation', header: 'Désignation', render: (l) => <b>{l.designation ?? '—'}</b> },
      col('description', 'Description'),
      { key: 'prix_unit', header: 'Prix unitaire', align: 'right', width: '130px',
        render: (l) => <span className="money">{fmtMoney(l.prix_unit)}</span> },
      col('unitmesure', 'Unité', { width: '110px' }),
    ],
    sections: [{ title: 'Type de charge', fields: [
      { name: 'designation', label: 'Désignation', span: 8, required: true },
      { name: 'unitmesure', label: 'Unité', span: 4 },
      { name: 'montant', label: 'Prix unitaire', type: 'number', step: '0.01', span: 4 },
      { name: 'description', label: 'Description', type: 'textarea', span: 12 },
    ] }],
    titres: { creer: 'Nouveau type de charge', editer: 'Modifier le type de charge', supprimer: 'Supprimer ce type de charge ?' },
    // Lecture : `prix_unit` ; écriture : `montant` → la modification reprend le prix actuel
    versFormulaire: (l) => ({ ...l, montant: l.montant ?? l.prix_unit }),
    nomLigne: (l) => l.designation,
  },
];

/** Libellé de droit Delphi (module Tiers) de chaque onglet ; « charges » relève de la trésorerie. */
const DROIT_ONGLET: Record<string, { module: 'tiers' | 'autre'; libelle: string }> = {
  familles: { module: 'tiers', libelle: D.tiers.familles },
  sfamilles: { module: 'tiers', libelle: D.tiers.sousFamilles },
  depots: { module: 'tiers', libelle: D.tiers.depots },
  rayons: { module: 'tiers', libelle: D.tiers.rayons },
  unites: { module: 'tiers', libelle: D.tiers.unites },
  tva: { module: 'tiers', libelle: D.tiers.tva },
  banques: { module: 'tiers', libelle: D.tiers.banques },
  modes: { module: 'tiers', libelle: D.tiers.modes },
  commerciaux: { module: 'tiers', libelle: D.tiers.commerciaux },
  centres: { module: 'tiers', libelle: D.tiers.centresCout },
  charges: { module: 'autre', libelle: D.autre.tresorerie },
};

export default function Referentiels() {
  const { peut } = useDroits();
  const refs = REFS.filter((r) => { const d = DROIT_ONGLET[r.code]; return !d || peut(d.module, d.libelle); });
  const [onglet, setOnglet] = useState(refs[0]?.code ?? REFS[0].code);
  // Emplacement de l'action « Nouveau … » dans l'en-tête (projetée par l'onglet actif)
  const [slotAction, setSlotAction] = useState<HTMLElement | null>(null);
  const ref = refs.find((r) => r.code === onglet) ?? refs[0];
  if (!ref) {
    return (
      <div className="flex flex-col gap-3.5">
        <PageHeader title="Référentiels" icon="book" />
        <EmptyState icon="lock" title="Aucun référentiel accessible" description="Vos droits ne donnent accès à aucun référentiel." />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title="Référentiels" icon="book" description="Listes de base : familles, dépôts, TVA, comptes, modes de paiement…">
        <span ref={setSlotAction} className="contents" />
      </PageHeader>
      <Tabs value={ref.code} onChange={setOnglet} options={refs.map((r) => ({ code: r.code, label: r.label }))} label="Référentiels" />
      {/* key = remount complet au changement d'onglet (hooks propres à chaque référentiel) */}
      <TableRef key={ref.code} ref_={ref} slotAction={slotAction} />
    </div>
  );
}

function TableRef({ ref_, slotAction }: { ref_: Ref; slotAction: HTMLElement | null }) {
  const { data, loading, error, refetch } = useQuery(ref_.query, { fetchPolicy: 'cache-and-network' });
  const brut = data?.[ref_.champ];
  const lignes: Ligne[] = ref_.listeDansData
    ? (Array.isArray(brut?.data) ? brut.data : [])
    : (Array.isArray(brut) ? brut : []);

  // Liste de choix alimentée par une autre liste des référentiels (ex. familles d'une sous-famille)
  const { data: sources } = useQuery(REFERENTIELS, { skip: !ref_.listeDe, fetchPolicy: 'cache-first' });
  const options = ref_.listeDe ? optionsDe(sources?.[ref_.listeDe.source]) : [];
  const sections = ref_.listeDe && options.length
    ? ref_.sections.map((s) => ({ ...s, fields: s.fields.map((f) => (f.name === ref_.listeDe!.champ ? { ...f, type: 'select' as const, options } : f)) }))
    : ref_.sections;

  const crud = useCrud<Ligne>({
    label: ref_.label.toLowerCase(),
    createTitle: ref_.titres?.creer,
    editTitle: ref_.titres?.editer,
    deleteTitle: ref_.titres?.supprimer,
    sections,
    versFormulaire: ref_.versFormulaire,
    createDoc: ref_.create, updateDoc: ref_.update, deleteDoc: ref_.remove,
    onDone: () => { void refetch(); },
    labelOf: ref_.nomLigne,
  });

  const colonnes: Column<Ligne>[] = [
    ...ref_.colonnes,
    { key: '_actions', header: '', align: 'right', width: '70px', render: (l) => crud.rowActions(l) },
  ];

  return (
    <>
      {slotAction && createPortal(
        <Button variant="primary" icon="plus" onClick={crud.openCreate}>{ref_.titres?.creer ?? 'Nouveau'}</Button>,
        slotAction,
      )}
      {crud.modals}
      <DataGrid complet columns={colonnes} rows={lignes} rowKey={(l, i) => l.id ?? i}
                loading={loading} error={error?.message}
                emptyMessage={`Aucun élément dans « ${ref_.label} ».`}
                footer={{ _label: `${lignes.length} élément(s)` }} />
      {!ref_.update && lignes.length > 0 && (
        <p className="text-xs text-ink-muted flex items-center gap-1.5">
          <Icon name="info" size={14} />
          Ce référentiel ne se modifie pas : supprimez puis recréez l'élément (limite du serveur).
        </p>
      )}
    </>
  );
}

/** Options d'une liste de référentiel (chaînes ou objets {code, designation}) : valeur = code, libellé lisible. */
function optionsDe(liste: unknown): { value: string; label: string }[] {
  if (!Array.isArray(liste)) return [];
  return liste.map((x) => {
    if (typeof x === 'string') return { value: x, label: x };
    const o = (x ?? {}) as Record<string, unknown>;
    const code = String(o.code ?? o.Code ?? o.designation ?? o.id ?? '');
    const lib = String(o.designation ?? o.Designation ?? code);
    return { value: code, label: code && lib !== code ? `${lib} (${code})` : lib };
  }).filter((o) => o.value);
}
