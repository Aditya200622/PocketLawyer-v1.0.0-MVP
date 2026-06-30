import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Plus, LayoutGrid, List, SlidersHorizontal,
  Briefcase, Clock, ChevronRight, X, Gavel, ShieldAlert,
  ChevronDown,
} from 'lucide-react';
import { auth } from '../auth';
import {
  createCase,
  deleteCase,
  subscribeToCases,
  updateCase,
  type CaseDocument,
  type CreateCasePayload,
  type UpdateCasePayload,
  type CasePriority as ServiceCasePriority,
  type CaseStatus as ServiceCaseStatus,
  type CaseRiskLevel,
} from '../services/caseService';

// ─── Types ───────────────────────────────────────────────────────────────────
type CaseStatus = 'active' | 'pending' | 'closed' | 'hearing';
type CasePriority = 'high' | 'medium' | 'low';
type RiskLevel = 'low' | 'medium' | 'high';

export interface Case {
  // Identity
  id: string;
  userId?: string;

  // Client Details
  client: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;

  // Case Details
  caseNumber?: string;
  title: string;
  type: string;
  court: string;
  judgeName?: string;
  policeStation?: string;
  firNumber?: string;
  sections?: string;
  oppositeParty?: string;
  advocateName?: string;

  // Case Status
  priority: CasePriority;
  status: CaseStatus;

  // Dates
  date: string;
  nextHearing?: string;
  nextHearingTime?: string;
  expectedClosure?: string;

  // Other
  notes?: string;

  // Display / Computed
  riskScore?: number;
  riskLevel?: RiskLevel;
  updatedAt?: string;
}

// ─── Blank form state ─────────────────────────────────────────────────────────
const BLANK_FORM: Omit<Case, 'id' | 'caseNumber' | 'riskScore' | 'riskLevel' | 'updatedAt'> = {
  client: '',
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  city: '',
  state: '',
  pinCode: '',
  title: '',
  type: '',
  court: '',
  judgeName: '',
  policeStation: '',
  firNumber: '',
  sections: '',
  oppositeParty: '',
  advocateName: '',
  priority: 'medium',
  status: 'pending',
  date: '',
  nextHearing: '',
  nextHearingTime: '',
  expectedClosure: '',
  notes: '',
};

interface CasesProps {
  cases?: Case[];
  onOpenCase?: (c: Case) => void;
  onNewCase?: () => void;
}

const toDisplayDate = (value: unknown) => {
  if (!value || typeof value !== 'object' || !('toDate' in value)) return '';
  const ts = value as { toDate: () => Date };
  return ts.toDate().toISOString().slice(0, 10);
};

const mapServiceStatusToUi = (status: ServiceCaseStatus | string, nextHearingDate?: string): CaseStatus => {
  if (status === 'closed') return 'closed';
  if (status === 'pending' || status === 'on_hold' || status === 'archived') return 'pending';
  if (nextHearingDate) return 'hearing';
  return 'active';
};

const mapUiStatusToService = (status: CaseStatus): ServiceCaseStatus => {
  switch (status) {
    case 'hearing':
    case 'active':
      return 'active';
    case 'pending':
      return 'pending';
    case 'closed':
      return 'closed';
    default:
      return 'active';
  }
};

const mapServicePriorityToUi = (priority: ServiceCasePriority | string): CasePriority => {
  if (priority === 'urgent') return 'high';
  return (priority as CasePriority) || 'medium';
};

const mapUiPriorityToService = (priority: CasePriority): ServiceCasePriority => {
  if (priority === 'high') return 'high';
  if (priority === 'medium') return 'medium';
  return 'low';
};

const mapServiceRiskToUi = (riskLevel: CaseRiskLevel | string | undefined): RiskLevel => {
  if (riskLevel === 'critical' || riskLevel === 'high') return 'high';
  if (riskLevel === 'medium') return 'medium';
  return 'low';
};

const mapUiRiskToService = (riskLevel?: RiskLevel): CaseRiskLevel | undefined => {
  if (riskLevel === 'high') return 'high';
  if (riskLevel === 'medium') return 'medium';
  if (riskLevel === 'low') return 'low';
  return undefined;
};

const parseSections = (value?: string) => {
  if (!value) return [];
  return value.split(',').map(item => item.trim()).filter(Boolean);
};

const mapCaseDocumentToUi = (doc: CaseDocument): Case => ({
  id: doc.id,
  userId: doc.userId,
  client: doc.clientName || '',
  phone: doc.phone || '',
  whatsapp: doc.whatsapp || '',
  email: doc.email || '',
  address: doc.address || '',
  city: doc.city || '',
  state: doc.state || '',
  pinCode: doc.pinCode || '',
  caseNumber: doc.caseNumber || '',
  title: doc.title || '',
  type: doc.caseType || '',
  court: doc.courtName || '',
  judgeName: doc.judgeName || '',
  policeStation: doc.policeStation || '',
  firNumber: doc.firNumber || '',
  sections: Array.isArray(doc.sections) ? doc.sections.join(', ') : '',
  oppositeParty: doc.oppositeParty || '',
  advocateName: doc.advocateName || '',
  priority: mapServicePriorityToUi(doc.priority),
  status: mapServiceStatusToUi(doc.status, doc.nextHearingDate),
  date: doc.openedDate || '',
  nextHearing: doc.nextHearingDate || '',
  nextHearingTime: doc.nextHearingTime || '',
  expectedClosure: doc.expectedClosure || '',
  notes: doc.notes || doc.description || '',
  riskScore: doc.riskScore ?? 0,
  riskLevel: mapServiceRiskToUi(doc.riskLevel),
  updatedAt: toDisplayDate(doc.updatedAt),
});

const buildCasePayload = (data: FormData, userId?: string): CreateCasePayload => ({
  clientName: data.client,
  phone: data.phone || undefined,
  whatsapp: data.whatsapp || undefined,
  email: data.email || undefined,
  address: data.address || undefined,
  city: data.city || undefined,
  state: data.state || undefined,
  pinCode: data.pinCode || undefined,
  title: data.title,
  caseType: data.type || 'Other',
  courtName: data.court || undefined,
  judgeName: data.judgeName || undefined,
  policeStation: data.policeStation || undefined,
  firNumber: data.firNumber || undefined,
  sections: parseSections(data.sections),
  oppositeParty: data.oppositeParty || undefined,
  advocateName: data.advocateName || undefined,
  priority: mapUiPriorityToService(data.priority),
  status: mapUiStatusToService(data.status),
  openedDate: data.date,
  nextHearingDate: data.nextHearing || undefined,
  nextHearingTime: data.nextHearingTime || undefined,
  expectedClosure: data.expectedClosure || undefined,
  description: data.notes || '',
  notes: data.notes || '',
  riskScore: 0,
  riskLevel: mapUiRiskToService(data.priority === 'high' ? 'high' : data.priority === 'medium' ? 'medium' : 'low'),
  userId,
  createdBy: userId || undefined,
});

const buildCaseUpdatePayload = (data: FormData, userId?: string): UpdateCasePayload => {
  const payload = buildCasePayload(data, userId);
  const { caseNumber: _caseNumber, ...rest } = payload as CreateCasePayload & { caseNumber?: string };
  return rest as UpdateCasePayload;
};

// ─── Style maps ───────────────────────────────────────────────────────────────
const statusColor: Record<CaseStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
  closed: 'bg-gray-100 text-gray-500',
  hearing: 'bg-orange-50 text-orange-600',
};

const statusDot: Record<CaseStatus, string> = {
  active: '#22C55E',
  pending: '#F59E0B',
  closed: '#9CA3AF',
  hearing: '#F97316',
};

const priorityDot: Record<CasePriority, string> = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#9CA3AF',
};

const riskColor: Record<RiskLevel, { text: string; bg: string; bar: string }> = {
  high: { text: '#EF4444', bg: '#FEF2F2', bar: '#EF4444' },
  medium: { text: '#F59E0B', bg: '#FFFBEB', bar: '#F59E0B' },
  low: { text: '#22C55E', bg: '#F0FDF4', bar: '#22C55E' },
};

const FILTERS: Array<{ id: 'all' | CaseStatus; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'hearing', label: 'Hearing' },
  { id: 'pending', label: 'Pending' },
  { id: 'closed', label: 'Closed' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
};

const relativeTime = (dateStr?: string) => {
  if (!dateStr) return '—';
  const diff = Math.floor((Date.now() - new Date(dateStr + 'T00:00:00').getTime()) / 86400000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff}d ago`;
  return `${Math.floor(diff / 7)}w ago`;
};

const daysUntil = (dateStr?: string) => {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr + 'T00:00:00').getTime() - Date.now()) / 86400000);
};

const generateCaseNumber = () => {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `CN-${year}-${rand}`;
};

// ─── Shared form field styles ─────────────────────────────────────────────────
const inputBase: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: '8px',
  border: '1px solid #E5E7EB',
  fontSize: '13px',
  color: '#111827',
  background: '#FFFFFF',
  outline: 'none',
  fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  color: '#6B7280',
  marginBottom: '4px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const sectionHeadStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#F97316',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  padding: '0 0 6px 0',
  borderBottom: '1px solid #FED7AA',
  marginBottom: '12px',
};

// ─── Field component ──────────────────────────────────────────────────────────
interface FieldProps {
  label: string;
  children: React.ReactNode;
}
const Field: React.FC<FieldProps> = ({ label, children }) => (
  <div>
    <label style={labelStyle}>{label}</label>
    {children}
  </div>
);

// ─── Case Form Modal ──────────────────────────────────────────────────────────
type FormData = Omit<Case, 'id' | 'riskScore' | 'riskLevel' | 'updatedAt'>;

interface CaseFormModalProps {
  mode: 'add' | 'edit';
  initial?: FormData;
  onSubmit: (data: FormData) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const CaseFormModal: React.FC<CaseFormModalProps> = ({ mode, initial, onSubmit, onDelete, onClose }) => {
  const [form, setForm] = useState<FormData>(
    initial ?? { ...BLANK_FORM, caseNumber: generateCaseNumber() }
  );

  const set = (field: keyof FormData, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 12 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl flex flex-col"
          style={{ background: '#FFFFFF', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}
        >
          {/* Modal header */}
          <div
            className="flex items-center justify-between px-6 py-4 flex-shrink-0 sticky top-0 z-10"
            style={{ background: '#FFFFFF', borderBottom: '1px solid #F3F4F6' }}
          >
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {mode === 'add' ? 'New Case' : 'Edit Case'}
              </h2>
              {mode === 'edit' && (
                <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
                  {form.caseNumber}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: '#F3F4F6', color: '#6B7280' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#E5E7EB')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#F3F4F6')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Form body */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-6 px-6 py-5">

            {/* ── Client Details ── */}
            <div>
              <p style={sectionHeadStyle}>Client Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Field label="Client Name *">
                    <input
                      style={inputBase}
                      required
                      placeholder="Full name"
                      value={form.client}
                      onChange={e => set('client', e.target.value)}
                      onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#F97316')}
                      onBlur={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')}
                    />
                  </Field>
                </div>
                <Field label="Phone">
                  <input
                    style={inputBase}
                    placeholder="10-digit mobile"
                    value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                    onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#F97316')}
                    onBlur={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')}
                  />
                </Field>
                <Field label="WhatsApp">
                  <input
                    style={inputBase}
                    placeholder="WhatsApp number"
                    value={form.whatsapp}
                    onChange={e => set('whatsapp', e.target.value)}
                    onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#F97316')}
                    onBlur={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Email">
                    <input
                      style={inputBase}
                      type="email"
                      placeholder="email@example.com"
                      value={form.email}
                      onChange={e => set('email', e.target.value)}
                      onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#F97316')}
                      onBlur={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Address">
                    <input
                      style={inputBase}
                      placeholder="Street / locality"
                      value={form.address}
                      onChange={e => set('address', e.target.value)}
                      onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#F97316')}
                      onBlur={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')}
                    />
                  </Field>
                </div>
                <Field label="City">
                  <input
                    style={inputBase}
                    placeholder="City"
                    value={form.city}
                    onChange={e => set('city', e.target.value)}
                    onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#F97316')}
                    onBlur={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')}
                  />
                </Field>
                <Field label="State">
                  <input
                    style={inputBase}
                    placeholder="State"
                    value={form.state}
                    onChange={e => set('state', e.target.value)}
                    onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#F97316')}
                    onBlur={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')}
                  />
                </Field>
                <Field label="PIN Code">
                  <input
                    style={inputBase}
                    placeholder="6-digit PIN"
                    maxLength={6}
                    value={form.pinCode}
                    onChange={e => set('pinCode', e.target.value)}
                    onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#F97316')}
                    onBlur={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')}
                  />
                </Field>
              </div>
            </div>

            {/* ── Case Details ── */}
            <div>
              <p style={sectionHeadStyle}>Case Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Case Number">
                  <input
                    style={{ ...inputBase, background: '#F9FAFB', color: '#9CA3AF', cursor: 'not-allowed' }}
                    value={form.caseNumber}
                    readOnly
                  />
                </Field>
                <Field label="Case Title *">
                  <input
                    style={inputBase}
                    required
                    placeholder="e.g. Sharma vs. State of UP"
                    value={form.title}
                    onChange={e => set('title', e.target.value)}
                    onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#F97316')}
                    onBlur={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')}
                  />
                </Field>
                <Field label="Case Type">
                  <div className="relative">
                    <select
                      style={{ ...inputBase, appearance: 'none', paddingRight: '32px' }}
                      value={form.type}
                      onChange={e => set('type', e.target.value)}
                      onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#F97316')}
                      onBlur={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')}
                    >
                      <option value="">Select type</option>
                      {['Criminal', 'Civil', 'Consumer', 'Family', 'Labour', 'IP', 'MACT', 'Revenue', 'Writ', 'Other'].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#9CA3AF' }} />
                  </div>
                </Field>
                <Field label="Court Name">
                  <input
                    style={inputBase}
                    placeholder="Court / tribunal name"
                    value={form.court}
                    onChange={e => set('court', e.target.value)}
                    onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#F97316')}
                    onBlur={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')}
                  />
                </Field>
                <Field label="Judge Name">
                  <input
                    style={inputBase}
                    placeholder="Presiding judge"
                    value={form.judgeName}
                    onChange={e => set('judgeName', e.target.value)}
                    onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#F97316')}
                    onBlur={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')}
                  />
                </Field>
                <Field label="Police Station">
                  <input
                    style={inputBase}
                    placeholder="Police station (if applicable)"
                    value={form.policeStation}
                    onChange={e => set('policeStation', e.target.value)}
                    onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#F97316')}
                    onBlur={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')}
                  />
                </Field>
                <Field label="FIR Number">
                  <input
                    style={inputBase}
                    placeholder="FIR / complaint number"
                    value={form.firNumber}
                    onChange={e => set('firNumber', e.target.value)}
                    onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#F97316')}
                    onBlur={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')}
                  />
                </Field>
                <Field label="Sections">
                  <input
                    style={inputBase}
                    placeholder="IPC 302, 307…"
                    value={form.sections}
                    onChange={e => set('sections', e.target.value)}
                    onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#F97316')}
                    onBlur={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')}
                  />
                </Field>
                <Field label="Opposite Party">
                  <input
                    style={inputBase}
                    placeholder="Respondent / defendant"
                    value={form.oppositeParty}
                    onChange={e => set('oppositeParty', e.target.value)}
                    onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#F97316')}
                    onBlur={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')}
                  />
                </Field>
                <Field label="Advocate Name">
                  <input
                    style={inputBase}
                    placeholder="Handling advocate"
                    value={form.advocateName}
                    onChange={e => set('advocateName', e.target.value)}
                    onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#F97316')}
                    onBlur={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')}
                  />
                </Field>
              </div>
            </div>

            {/* ── Case Status ── */}
            <div>
              <p style={sectionHeadStyle}>Case Status</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Priority">
                  <div className="relative">
                    <select
                      style={{ ...inputBase, appearance: 'none', paddingRight: '32px' }}
                      value={form.priority}
                      onChange={e => set('priority', e.target.value as CasePriority)}
                      onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#F97316')}
                      onBlur={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')}
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#9CA3AF' }} />
                  </div>
                </Field>
                <Field label="Status">
                  <div className="relative">
                    <select
                      style={{ ...inputBase, appearance: 'none', paddingRight: '32px' }}
                      value={form.status}
                      onChange={e => set('status', e.target.value as CaseStatus)}
                      onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#F97316')}
                      onBlur={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')}
                    >
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="hearing">Hearing</option>
                      <option value="closed">Closed</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#9CA3AF' }} />
                  </div>
                </Field>
              </div>
            </div>

            {/* ── Dates ── */}
            <div>
              <p style={sectionHeadStyle}>Dates</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Opened Date *">
                  <input
                    style={inputBase}
                    type="date"
                    required
                    value={form.date}
                    onChange={e => set('date', e.target.value)}
                    onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#F97316')}
                    onBlur={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')}
                  />
                </Field>
                <Field label="Expected Closure">
                  <input
                    style={inputBase}
                    type="date"
                    value={form.expectedClosure ?? ''}
                    onChange={e => set('expectedClosure', e.target.value)}
                    onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#F97316')}
                    onBlur={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')}
                  />
                </Field>
                <Field label="Next Hearing Date">
                  <input
                    style={inputBase}
                    type="date"
                    value={form.nextHearing ?? ''}
                    onChange={e => set('nextHearing', e.target.value)}
                    onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#F97316')}
                    onBlur={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')}
                  />
                </Field>
                <Field label="Next Hearing Time">
                  <input
                    style={inputBase}
                    type="time"
                    value={form.nextHearingTime ?? ''}
                    onChange={e => set('nextHearingTime', e.target.value)}
                    onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#F97316')}
                    onBlur={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')}
                  />
                </Field>
              </div>
            </div>

            {/* ── Other ── */}
            <div>
              <p style={sectionHeadStyle}>Other</p>
              <Field label="Notes">
                <textarea
                  style={{ ...inputBase, minHeight: '80px', resize: 'vertical' }}
                  placeholder="Case notes, instructions, observations…"
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#F97316')}
                  onBlur={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')}
                />
              </Field>
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-end gap-3 sticky bottom-0 py-4"
              style={{ background: '#FFFFFF', borderTop: '1px solid #F3F4F6', marginTop: '4px' }}
            >
              {mode === 'edit' && onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors mr-auto"
                  style={{ background: '#FEE2E2', color: '#B91C1C' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#FECACA')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#FEE2E2')}
                >
                  Delete Case
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                style={{ background: '#F3F4F6', color: '#374151' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#E5E7EB')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#F3F4F6')}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all active:scale-[0.97]"
                style={{ background: '#F97316' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#EA580C')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#F97316')}
              >
                {mode === 'add' ? 'Create Case' : 'Save Changes'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ─── Component ───────────────────────────────────────────────────────────────
const Cases: React.FC<CasesProps> = ({ cases: propCases, onOpenCase, onNewCase }) => {
  const [localCases, setLocalCases] = useState<Case[]>(() =>
    (propCases ?? []).map(caseItem => ({ ...caseItem }))
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | CaseStatus>('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(auth.currentUser?.uid);

  // Modal state
  const [showAdd, setShowAdd] = useState(false);
  const [editCase, setEditCase] = useState<Case | null>(null);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(user => {
      setCurrentUserId(user?.uid);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (propCases && propCases.length > 0) {
      setLocalCases(propCases.map(caseItem => ({ ...caseItem })));
    }
  }, [propCases]);

  useEffect(() => {
    const unsubscribe = subscribeToCases(currentUserId || 'anonymous', (documents) => {
      const mappedCases = documents
        .map(mapCaseDocumentToUi)
        .filter(caseItem => !currentUserId || !caseItem.userId || caseItem.userId === currentUserId);

      setLocalCases(mappedCases);
    }, (error) => {
      console.error('Cases subscription error:', error);
    });

    return () => unsubscribe();
  }, [currentUserId]);

  const filtered = useMemo(() => {
    return localCases.filter(c => {
      const matchesFilter = activeFilter === 'all' || c.status === activeFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery = !q ||
        c.title.toLowerCase().includes(q) ||
        c.client.toLowerCase().includes(q) ||
        c.court.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.caseNumber ?? "").toLowerCase().includes(q)
      return matchesFilter && matchesQuery;
    });
  }, [localCases, activeFilter, searchQuery]);

  const handleAdd = async (data: FormData) => {
    const result = await createCase(buildCasePayload(data, auth.currentUser?.uid));

    if ('error' in result) {
      alert(result.error);
      return;
    }

    setLocalCases(prev => [mapCaseDocumentToUi(result.data), ...prev]);
    setShowAdd(false);
    onNewCase?.();
  };

  const handleEdit = async (data: FormData) => {
    if (!editCase?.id) return;

    const result = await updateCase(editCase.id, buildCaseUpdatePayload(data, auth.currentUser?.uid));

    if ('error' in result) {
      alert(result.error);
      return;
    }

    setLocalCases(prev => prev.map(c => c.id === editCase.id ? mapCaseDocumentToUi(result.data) : c));
    setEditCase(null);
  };

  const handleDelete = async () => {
    if (!editCase?.id) return;

    const result = await deleteCase(editCase.id);

    if ('error' in result) {
      alert(result.error);
      return;
    }

    setLocalCases(prev => prev.filter(c => c.id !== editCase.id));
    setEditCase(null);
  };

  const openEdit = (c: Case) => {
    setEditCase(c);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Cases</h1>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
            {filtered.length} of {localCases.length} case{localCases.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center justify-center gap-2 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-[0.97]"
          style={{ background: '#F97316', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#EA580C')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#F97316')}
        >
          <Plus className="h-4 w-4" />
          New Case
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#9CA3AF' }} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by case, client, or court…"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm font-medium text-gray-900 placeholder-gray-400 outline-none transition-all"
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}
            onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#F97316')}
            onBlur={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')}
          />
        </div>

        {/* Filters toggle (mobile) */}
        <button
          onClick={() => setFiltersOpen(p => !p)}
          className="sm:hidden flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium"
          style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', color: '#374151' }}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
        </button>

        {/* Filter chips (desktop) */}
        <div className="hidden sm:flex items-center gap-1.5 p-1 rounded-lg" style={{ background: '#F3F4F6' }}>
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
              style={activeFilter === f.id
                ? { background: '#FFFFFF', color: '#111827', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }
                : { background: 'transparent', color: '#6B7280' }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-0.5 p-1 rounded-lg flex-shrink-0" style={{ background: '#F3F4F6' }}>
          <button
            onClick={() => setView('grid')}
            className="w-8 h-8 rounded-md flex items-center justify-center transition-all"
            style={view === 'grid'
              ? { background: '#FFFFFF', color: '#111827', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }
              : { background: 'transparent', color: '#9CA3AF' }}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setView('list')}
            className="w-8 h-8 rounded-md flex items-center justify-center transition-all"
            style={view === 'list'
              ? { background: '#FFFFFF', color: '#111827', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }
              : { background: 'transparent', color: '#9CA3AF' }}
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Mobile filter chips */}
      <AnimatePresence>
        {filtersOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="sm:hidden overflow-hidden"
          >
            <div className="flex items-center gap-1.5 p-1 rounded-lg flex-wrap" style={{ background: '#F3F4F6' }}>
              {FILTERS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                  style={activeFilter === f.id
                    ? { background: '#FFFFFF', color: '#111827', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }
                    : { background: 'transparent', color: '#6B7280' }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="rounded-xl p-16 flex flex-col items-center justify-center text-center" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
          <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mb-4 border border-slate-100">
            <Briefcase className="h-6 w-6 text-slate-300" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-semibold text-slate-900">No matching cases</p>
          <p className="text-xs text-slate-500 mt-1.5 max-w-[220px]">
            We couldn't find any cases matching your current search or filter criteria.
          </p>
          {(searchQuery !== '' || activeFilter !== 'all') && (
            <button
              onClick={() => { setSearchQuery(''); setActiveFilter('all'); }}
              className="mt-4 text-xs font-semibold px-4 py-2 rounded-lg transition-colors hover:bg-slate-100"
              style={{ color: '#374151', background: '#F3F4F6' }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Grid view */}
      {view === 'grid' && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c, idx) => {
            const risk = riskColor[c.riskLevel || 'low'];
            const remaining = daysUntil(c.nextHearing);
            const urgent = remaining !== null && remaining <= 3;
            return (
              <motion.button
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03, duration: 0.25 }}
               onClick={() => {
    onOpenCase?.(c);
}}
                className="text-left rounded-xl p-5 flex flex-col gap-4 transition-all group"
                style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#D1D5DB';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: priorityDot[c.priority] }} />
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded" style={{ background: '#F3F4F6', color: '#9CA3AF' }}>
                        {c.caseNumber || c.id}
                      </span>
                      <h3 className="text-sm font-semibold text-gray-900 mt-1.5 leading-snug line-clamp-2">{c.title}</h3>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 mt-0.5 transition-transform group-hover:translate-x-0.5" style={{ color: '#D1D5DB' }} />
                </div>

                {/* Meta */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs" style={{ color: '#6B7280' }}>
                    <span className="font-medium text-gray-700 truncate">{c.client}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs" style={{ color: '#9CA3AF' }}>
                    <Gavel className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{c.court}</span>
                  </div>
                </div>

                {/* Hearing */}
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: urgent ? '#FFF7ED' : '#F9FAFB', border: `1px solid ${urgent ? '#FED7AA' : '#F3F4F6'}` }}
                >
                  <Clock className="h-3.5 w-3.5 flex-shrink-0" style={{ color: urgent ? '#F97316' : '#9CA3AF' }} />
                  <span className="text-xs font-medium" style={{ color: urgent ? '#C2410C' : '#6B7280' }}>
                    {c.nextHearing
                      ? `Next: ${formatDate(c.nextHearing)}${c.nextHearingTime ? ` · ${c.nextHearingTime}` : ''}`
                      : 'No hearing scheduled'}
                  </span>
                </div>

                {/* Footer row: status + risk */}
                <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid #F3F4F6' }}>
                  <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold flex items-center gap-1.5 ${statusColor[c.status]}`}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusDot[c.status] }} />
                    {c.status}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <ShieldAlert className="h-3 w-3" style={{ color: risk.text }} />
                    <span className="text-[11px] font-bold" style={{ color: risk.text }}>{c.riskScore ?? 0}</span>
                  </div>
                </div>

                <p className="text-[10px]" style={{ color: '#D1D5DB' }}>Updated {relativeTime(c.updatedAt)}</p>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* List view */}
      {view === 'list' && filtered.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
          <div className="divide-y" style={{ borderColor: '#F3F4F6' }}>
            {filtered.map((c, idx) => {
              const risk = riskColor[c.riskLevel || 'low'];
              return (
                <motion.button
                  key={c.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.02 }}
                  onClick={() => {
                    onOpenCase?.(c);
                    openEdit(c);
                  }}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors"
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#FAFAFA')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: priorityDot[c.priority] }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: '#F3F4F6', color: '#9CA3AF' }}>
                        {c.caseNumber || c.id}
                      </span>
                      <p className="text-sm font-semibold text-gray-900 truncate">{c.title}</p>
                    </div>
                    <p className="text-xs mt-0.5 truncate" style={{ color: '#9CA3AF' }}>{c.client} · {c.court}</p>
                  </div>
                  <div className="hidden md:block text-xs flex-shrink-0 w-32" style={{ color: '#6B7280' }}>
                    {c.nextHearing ? formatDate(c.nextHearing) : '—'}
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0 w-14">
                    <ShieldAlert className="h-3 w-3" style={{ color: risk.text }} />
                    <span className="text-xs font-bold" style={{ color: risk.text }}>{c.riskScore ?? 0}</span>
                  </div>
                  <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold flex items-center gap-1.5 flex-shrink-0 ${statusColor[c.status]}`}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusDot[c.status] }} />
                    {c.status}
                  </span>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 hidden sm:block" style={{ color: '#D1D5DB' }} />
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Case Modal */}
      {showAdd && (
        <CaseFormModal
          mode="add"
          onSubmit={handleAdd}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* Edit Case Modal */}
      {editCase && (
        <CaseFormModal
          mode="edit"
          initial={{
            caseNumber: editCase.caseNumber,
            client: editCase.client,
            phone: editCase.phone,
            whatsapp: editCase.whatsapp,
            email: editCase.email,
            address: editCase.address,
            city: editCase.city,
            state: editCase.state,
            pinCode: editCase.pinCode,
            title: editCase.title,
            type: editCase.type,
            court: editCase.court,
            judgeName: editCase.judgeName,
            policeStation: editCase.policeStation,
            firNumber: editCase.firNumber,
            sections: editCase.sections,
            oppositeParty: editCase.oppositeParty,
            advocateName: editCase.advocateName,
            priority: editCase.priority,
            status: editCase.status,
            date: editCase.date,
            nextHearing: editCase.nextHearing ?? '',
            nextHearingTime: editCase.nextHearingTime ?? '',
            expectedClosure: editCase.expectedClosure ?? '',
            notes: editCase.notes,
          }}
          onSubmit={handleEdit}
          onDelete={handleDelete}
          onClose={() => setEditCase(null)}
        />
      )}
    </div>
  );
};

export default Cases;