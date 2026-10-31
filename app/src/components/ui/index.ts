/**
 * Bibliothèque de composants de l'application (charte v2) — point d'entrée unique.
 * `import { Button, Card, PageHeader } from '../components/ui';`
 */
export { Icon, IconBadge, Kbd, TONE_VARS, hasIcon, type IconName, type Tone } from './Icon';
export { Button, IconButton, ButtonGroup, Spinner, type ButtonProps, type ButtonVariant, type ButtonSize } from './Button';
export {
  Field, TextInput, Select, Textarea, Checkbox, Switch, SearchField, SegmentedControl, DateRangeField, CONTROL,
} from './Field';
export { Card, CardHeader, DescriptionList, TotalsPanel, SectionTitle } from './Card';
export { Skeleton, EmptyState, StatePanel, Alert, LoadingOverlay, Loading } from './States';
export { KpiTile, BarList } from './Kpi';
export {
  Badge, DocBadge, DOC_TONE, StatusPill, PayStatus, StatusDot, Money, Tabs, PeriodPicker, SearchInput,
  Breadcrumb, usePageTitle, PageHeader, Toolbar, Pagination, ExportBtn, Bucket, type Crumb,
} from './atoms';
export { default as Modal, DialogButton, KeyHints, type ModalProps, type ModalSize } from './Dialog';
export { default as ConfirmDialog } from './ConfirmDialog';
export { default as FormModal } from './FormModal';
export { useToast, ToastProvider } from './Toast';
export { Menu, type MenuItem } from './Menu';
export { cn } from './cn';
