import { useEffect, useId, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Building2,
  Bell,
  Palette,
  ShieldCheck,
  Plug,
  Check,
  Loader2,
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth } from '../auth';
import { db } from '../firebase';

/**
 * Settings.tsx
 * Self-contained settings panel: Profile, Law Firm, Notifications,
 * Appearance, Security, Integrations.
 *
 * Loads the authenticated user's profile from Firestore (users/{uid})
 * and persists all changes there on Save. Props are kept for backward
 * compatibility but are superseded by Firestore data once the user doc
 * is loaded.
 */

export interface UserSettings {
  name: string;
  email: string;
  firmName: string;
  role: string;
  notifications: {
    email: boolean;
    sms: boolean;
    hearingReminders: boolean;
  };
  theme: 'light' | 'dark' | 'system';
  twoFactorEnabled: boolean;
}

export interface SettingsProps {
  initialSettings: UserSettings;
  onSave?: (settings: UserSettings) => Promise<void> | void;
  className?: string;
}

type SectionId = 'profile' | 'firm' | 'notifications' | 'appearance' | 'security' | 'integrations';

const sections: { id: SectionId; label: string; icon: typeof User }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'firm', label: 'Law Firm', icon: Building2 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'security', label: 'Security', icon: ShieldCheck },
  { id: 'integrations', label: 'Integrations', icon: Plug },
];

/** Default empty settings — used only until Firestore data arrives. */
const EMPTY_SETTINGS: UserSettings = {
  name: '',
  email: '',
  firmName: '',
  role: '',
  notifications: { email: true, sms: false, hearingReminders: true },
  theme: 'light',
  twoFactorEnabled: false,
};

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] focus-visible:ring-offset-2 ${
        checked ? 'bg-[#F97316]' : 'bg-gray-200'
      }`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm"
        style={{ left: checked ? '22px' : '2px' }}
      />
    </button>
  );
}

function FieldRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-[#111827]">{label}</p>
        {description && <p className="mt-0.5 text-[12px] text-[#6B7280]">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function TextInput({
  id,
  label,
  value,
  onChange,
  type = 'text',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[12px] font-medium text-[#6B7280]">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[14px] text-[#111827] outline-none transition-colors focus:border-[#F97316] focus-visible:ring-2 focus-visible:ring-[#F97316]/30"
      />
    </div>
  );
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">{children}</div>
  );
}

export default function Settings({ className = '' }: SettingsProps) {
  const [activeSection, setActiveSection] = useState<SectionId>('profile');
  /** Settings currently committed to Firestore (used for dirty-check). */
  const [committed, setCommitted] = useState<UserSettings>(EMPTY_SETTINGS);
  const [draft, setDraft] = useState<UserSettings>(EMPTY_SETTINGS);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'success'>('idle');
  const [loading, setLoading] = useState(true);
  const tabsId = useId();

  // ── Load user settings from Firestore ──────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
        const data = snap.exists() ? snap.data() : {};

        const loaded: UserSettings = {
          name: data.name ?? firebaseUser.displayName ?? '',
          email: data.email ?? firebaseUser.email ?? '',
          firmName: data.firmName ?? '',
          role: data.role ?? '',
          notifications: {
            email: data.notifications?.email ?? true,
            sms: data.notifications?.sms ?? false,
            hearingReminders: data.notifications?.hearingReminders ?? true,
          },
          theme: (['light', 'dark', 'system'] as const).includes(data.theme)
            ? data.theme
            : 'light',
          twoFactorEnabled: data.twoFactorEnabled ?? false,
        };

        setCommitted(loaded);
        setDraft(loaded);
      } catch (_) {
        // Fallback — remain on EMPTY_SETTINGS
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // ── Dirty detection ────────────────────────────────────────────────────────
  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(committed),
    [draft, committed]
  );

  // ── Persist to Firestore ───────────────────────────────────────────────────
  const handleSave = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;

    setSaveState('saving');
    try {
      await setDoc(
        doc(db, 'users', firebaseUser.uid),
        {
          name: draft.name,
          email: draft.email,
          firmName: draft.firmName,
          role: draft.role,
          notifications: draft.notifications,
          theme: draft.theme,
          twoFactorEnabled: draft.twoFactorEnabled,
        },
        { merge: true }
      );
      setCommitted(draft);
      setSaveState('success');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('idle');
    }
  };

  const updateNotification = (key: keyof UserSettings['notifications'], value: boolean) => {
    setDraft((prev) => ({ ...prev, notifications: { ...prev.notifications, [key]: value } }));
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`flex items-center justify-center py-16 ${className}`}>
        <Loader2 className="h-6 w-6 animate-spin text-[#F97316]" />
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 lg:flex-row ${className}`}>
      {/* Tab nav */}
      <nav
        aria-label="Settings sections"
        className="flex shrink-0 gap-1 overflow-x-auto lg:w-48 lg:flex-col lg:overflow-visible"
      >
        {sections.map(({ id, label, icon: Icon }) => {
          const isActive = activeSection === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveSection(id)}
              aria-current={isActive ? 'true' : undefined}
              className={`relative flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-left text-[14px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] ${
                isActive ? 'text-[#111827]' : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId={`${tabsId}-active-section`}
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  className="absolute inset-0 rounded-lg bg-orange-50"
                />
              )}
              <Icon className="relative h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="relative">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeSection === 'profile' && (
              <SettingsCard>
                <h3 className="text-[18px] font-semibold text-[#111827]">Profile</h3>
                <p className="mt-1 text-[12px] text-[#6B7280]">
                  Your personal information and role.
                </p>
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextInput
                    id="settings-name"
                    label="Full name"
                    value={draft.name}
                    onChange={(v) => setDraft((p) => ({ ...p, name: v }))}
                  />
                  <TextInput
                    id="settings-email"
                    label="Email address"
                    type="email"
                    value={draft.email}
                    onChange={(v) => setDraft((p) => ({ ...p, email: v }))}
                  />
                  <TextInput
                    id="settings-role"
                    label="Role"
                    value={draft.role}
                    onChange={(v) => setDraft((p) => ({ ...p, role: v }))}
                  />
                </div>
              </SettingsCard>
            )}

            {activeSection === 'firm' && (
              <SettingsCard>
                <h3 className="text-[18px] font-semibold text-[#111827]">Law Firm</h3>
                <p className="mt-1 text-[12px] text-[#6B7280]">
                  Details about your firm shown on documents and drafts.
                </p>
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextInput
                    id="settings-firm-name"
                    label="Firm name"
                    value={draft.firmName}
                    onChange={(v) => setDraft((p) => ({ ...p, firmName: v }))}
                  />
                </div>
              </SettingsCard>
            )}

            {activeSection === 'notifications' && (
              <SettingsCard>
                <h3 className="text-[18px] font-semibold text-[#111827]">Notifications</h3>
                <p className="mt-1 text-[12px] text-[#6B7280]">
                  Choose how PocketLawyer keeps you informed.
                </p>
                <div className="mt-2 divide-y divide-[#E5E7EB]">
                  <FieldRow label="Email notifications" description="Case updates and summaries by email.">
                    <Toggle
                      checked={draft.notifications.email}
                      onChange={(v) => updateNotification('email', v)}
                      label="Email notifications"
                    />
                  </FieldRow>
                  <FieldRow label="SMS notifications" description="Urgent alerts sent to your phone.">
                    <Toggle
                      checked={draft.notifications.sms}
                      onChange={(v) => updateNotification('sms', v)}
                      label="SMS notifications"
                    />
                  </FieldRow>
                  <FieldRow label="Hearing reminders" description="Reminders before scheduled hearings.">
                    <Toggle
                      checked={draft.notifications.hearingReminders}
                      onChange={(v) => updateNotification('hearingReminders', v)}
                      label="Hearing reminders"
                    />
                  </FieldRow>
                </div>
              </SettingsCard>
            )}

            {activeSection === 'appearance' && (
              <SettingsCard>
                <h3 className="text-[18px] font-semibold text-[#111827]">Appearance</h3>
                <p className="mt-1 text-[12px] text-[#6B7280]">Choose how PocketLawyer looks for you.</p>
                <div className="mt-5 flex gap-2">
                  {(['light', 'dark', 'system'] as const).map((theme) => (
                    <button
                      key={theme}
                      type="button"
                      onClick={() => setDraft((p) => ({ ...p, theme }))}
                      aria-pressed={draft.theme === theme}
                      className={`rounded-lg border px-4 py-2 text-[13px] font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] ${
                        draft.theme === theme
                          ? 'border-[#F97316] bg-orange-50 text-[#F97316]'
                          : 'border-[#E5E7EB] text-[#6B7280] hover:bg-gray-50'
                      }`}
                    >
                      {theme}
                    </button>
                  ))}
                </div>
              </SettingsCard>
            )}

            {activeSection === 'security' && (
              <SettingsCard>
                <h3 className="text-[18px] font-semibold text-[#111827]">Security</h3>
                <p className="mt-1 text-[12px] text-[#6B7280]">
                  Protect your account and client data.
                </p>
                <div className="mt-2 divide-y divide-[#E5E7EB]">
                  <FieldRow
                    label="Two-factor authentication"
                    description="Require a verification code at sign-in."
                  >
                    <Toggle
                      checked={draft.twoFactorEnabled}
                      onChange={(v) => setDraft((p) => ({ ...p, twoFactorEnabled: v }))}
                      label="Two-factor authentication"
                    />
                  </FieldRow>
                </div>
              </SettingsCard>
            )}

            {activeSection === 'integrations' && (
              <SettingsCard>
                <h3 className="text-[18px] font-semibold text-[#111827]">Integrations</h3>
                <p className="mt-1 text-[12px] text-[#6B7280]">
                  Connect PocketLawyer with the tools your firm already uses.
                </p>
                <div className="mt-5 flex flex-col items-center justify-center rounded-lg border border-dashed border-[#E5E7EB] bg-gray-50/50 py-10 text-center">
                  <Plug className="h-5 w-5 text-[#6B7280]" aria-hidden="true" />
                  <p className="mt-2 text-[13px] text-[#6B7280]">No integrations connected yet.</p>
                </div>
              </SettingsCard>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Save bar */}
        <div className="mt-5 flex items-center justify-end gap-3">
          <AnimatePresence>
            {isDirty && saveState === 'idle' && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[12px] text-[#6B7280]"
              >
                Unsaved changes
              </motion.span>
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            disabled={!isDirty || saveState === 'saving'}
            onClick={handleSave}
            whileTap={{ scale: 0.98 }}
            className="inline-flex min-w-[112px] items-center justify-center gap-1.5 rounded-lg bg-[#F97316] px-4 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-[#EA6A0C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <AnimatePresence mode="wait" initial={false}>
              {saveState === 'saving' && (
                <motion.span
                  key="saving"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="inline-flex items-center gap-1.5"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Saving…
                </motion.span>
              )}
              {saveState === 'success' && (
                <motion.span
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="inline-flex items-center gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Saved
                </motion.span>
              )}
              {saveState === 'idle' && (
                <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  Save changes
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    </div>
  );
}