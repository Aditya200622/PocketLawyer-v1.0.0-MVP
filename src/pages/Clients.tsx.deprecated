import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  subscribeToClients,
  createClient,
  updateClient,
  deleteClient,
  Client as ServiceClient,
  type Gender,
} from '../services/clientService';

import { auth } from '../firebase';
import { Search, SlidersHorizontal, Plus, Users, X, Pencil, Trash2, Phone, Mail, Briefcase, User } from 'lucide-react';
import ClientCard, { Client } from '../components/ClientCard';

type FilterType = 'all' | 'active' | 'inactive' | 'hearing-soon';

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'hearing-soon', label: 'Hearing Soon' },
];

const EMPTY_FORM: {
  fullName: string; fatherName: string; motherName: string; dateOfBirth: string;
  gender: Gender; phone: string; whatsapp: string;
  alternatePhone: string; email: string; address: string; city: string; state: string;
  pinCode: string; country: string; aadhaar: string; pan: string;
  occupation: string; companyName: string; notes: string;
} = {
  fullName: '', fatherName: '', motherName: '', dateOfBirth: '',
  gender: 'prefer_not_to_say' as const, phone: '', whatsapp: '',
  alternatePhone: '', email: '', address: '', city: '', state: '',
  pinCode: '', country: 'India', aadhaar: '', pan: '',
  occupation: '', companyName: '', notes: '',
};

export const Clients: React.FC = () => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [serviceClients, setServiceClients] = useState<ServiceClient[]>([]);

  // New / Edit modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Profile view state
  const [viewingClient, setViewingClient] = useState<ServiceClient | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    const userId = user?.uid || 'anonymous';
    const unsub = subscribeToClients(userId, (sClients) => {
      setServiceClients(sClients);
      const mapped: Client[] = sClients.map(sc => ({
        id: sc.clientId,
        name: sc.fullName,
        phone: sc.phone,
        email: sc.email,
        activeCases: sc.linkedCaseCount,
        status: 'active',
      }));
      setClients(mapped);
    });
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    return clients.filter(c => {
      const matchesQuery =
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.email.toLowerCase().includes(query.toLowerCase()) ||
        c.phone.includes(query);
      const matchesFilter =
        filter === 'all' ? true :
        filter === 'active' ? c.status === 'active' :
        filter === 'inactive' ? c.status === 'inactive' :
        filter === 'hearing-soon' ? Boolean(c.upcomingHearing) : true;
      return matchesQuery && matchesFilter;
    });
  }, [clients, query, filter]);

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (clientId: string) => {
    const sc = serviceClients.find(c => c.clientId === clientId);
    if (!sc) return;
    setEditingId(clientId);
    setForm({
      fullName: sc.fullName, fatherName: sc.fatherName, motherName: sc.motherName,
      dateOfBirth: sc.dateOfBirth, gender: sc.gender, phone: sc.phone,
      whatsapp: sc.whatsapp, alternatePhone: sc.alternatePhone, email: sc.email,
      address: sc.address, city: sc.city, state: sc.state, pinCode: sc.pinCode,
      country: sc.country, aadhaar: sc.aadhaar, pan: sc.pan,
      occupation: sc.occupation, companyName: sc.companyName, notes: sc.notes,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.fullName.trim()) { alert('Full name is required'); return; }
    const user = auth.currentUser;
    if (!user) { alert('Not logged in'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await updateClient(editingId, { fullName: form.fullName, phone: form.phone, email: form.email, notes: form.notes });
      } else {
        await createClient({ ...form, userId: user.uid, createdBy: user.displayName || user.email || 'System' });
      }
      setShowModal(false);
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  const handleDelete = async (clientId: string) => {
    if (!window.confirm('Delete this client? This cannot be undone.')) return;
    try { await deleteClient(clientId); }
    catch (err: any) { alert(err.message); }
  };

  const viewClient = (clientId: string) => {
    const sc = serviceClients.find(c => c.clientId === clientId);
    setViewingClient(sc || null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Clients</h2>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
            {clients.length} total clients
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: '#0A0A0A' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#1A1A1A')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#0A0A0A')}
        >
          <Plus className="h-4 w-4" /> New Client
        </button>
      </div>

      {/* Search + filters bar */}
      <div className="flex items-center gap-3">
        <div
          className="flex-1 flex items-center gap-2.5 px-4 py-2.5 rounded-xl"
          style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}
        >
          <Search className="h-4 w-4 flex-shrink-0" style={{ color: '#9CA3AF' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search clients by name, email or phone…"
            className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400"
          />
          {query && (
            <button onClick={() => setQuery('')}>
              <X className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} />
            </button>
          )}
        </div>
        <button
          onClick={() => setFiltersOpen(p => !p)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex-shrink-0"
          style={{
            background: filtersOpen ? '#0A0A0A' : '#FFFFFF',
            color: filtersOpen ? '#FFFFFF' : '#6B7280',
            border: '1px solid #E5E7EB',
          }}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Filters</span>
        </button>
      </div>

      {/* Filter chips */}
      <AnimatePresence>
        {filtersOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 flex-wrap pb-1">
              {FILTERS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className="px-4 py-1.5 text-xs font-semibold rounded-full transition-all"
                  style={filter === f.id ? {
                    background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA',
                  } : {
                    background: '#FFFFFF', color: '#6B7280', border: '1px solid #E5E7EB',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Client grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c, idx) => (
            <div key={c.id} className="relative group">
              <ClientCard client={c} index={idx} onClick={() => viewClient(c.id)} />
              {/* Edit / Delete overlay */}
              <div className="absolute top-3 right-8 hidden group-hover:flex items-center gap-1.5">
                <button
                  onClick={e => { e.stopPropagation(); openEdit(c.id); }}
                  className="p-1.5 rounded-lg bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition"
                  title="Edit client"
                >
                  <Pencil className="h-3 w-3 text-gray-500" />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(c.id); }}
                  className="p-1.5 rounded-lg bg-white border border-red-100 shadow-sm hover:bg-red-50 transition"
                  title="Delete client"
                >
                  <Trash2 className="h-3 w-3 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
            style={{ background: '#F3F4F6' }}
          >
            <Users className="h-5 w-5" style={{ color: '#6B7280' }} />
          </div>
          <p className="text-sm font-semibold text-gray-900">No clients found</p>
          <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
            Try adjusting your search or filters
          </p>
        </div>
      )}

      {/* ───── New / Edit Client Modal ───── */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.45)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowModal(false)}
          >
            <motion.div
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[85vh] overflow-y-auto"
              initial={{ scale: 0.95, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 16 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-semibold text-gray-900">
                  {editingId ? 'Edit Client' : 'New Client'}
                </h3>
                <button onClick={() => setShowModal(false)}>
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Full Name *', key: 'fullName', type: 'text' },
                  { label: 'Email', key: 'email', type: 'email' },
                  { label: 'Phone', key: 'phone', type: 'tel' },
                  { label: 'City', key: 'city', type: 'text' },
                  { label: 'Occupation', key: 'occupation', type: 'text' },
                  { label: 'Notes', key: 'notes', type: 'text' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">{f.label}</label>
                    <input
                      type={f.type}
                      value={(form as any)[f.key]}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 outline-none focus:border-orange-400 transition"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition"
                  style={{ background: saving ? '#D1D5DB' : '#0A0A0A' }}
                >
                  {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ───── Client Profile View Modal ───── */}
      <AnimatePresence>
        {viewingClient && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.45)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setViewingClient(null)}
          >
            <motion.div
              className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
              initial={{ scale: 0.95, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 16 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-semibold text-gray-900">Client Profile</h3>
                <button onClick={() => setViewingClient(null)}>
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              </div>
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white bg-gray-900">
                  {viewingClient.fullName.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || <User />}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{viewingClient.fullName}</p>
                  <p className="text-sm text-gray-500">{viewingClient.occupation || 'Client'}</p>
                </div>
              </div>
              <div className="space-y-2.5">
                {[
                  { icon: Phone, label: viewingClient.phone },
                  { icon: Mail, label: viewingClient.email },
                  { icon: Briefcase, label: `${viewingClient.linkedCaseCount} linked case(s)` },
                ].map(({ icon: Icon, label }, i) => label ? (
                  <div key={i} className="flex items-center gap-3 text-sm text-gray-600">
                    <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    {label}
                  </div>
                ) : null)}
              </div>
              {viewingClient.notes && (
                <div className="mt-4 p-3 rounded-xl bg-gray-50 text-sm text-gray-600">
                  {viewingClient.notes}
                </div>
              )}
              <button
                onClick={() => { setViewingClient(null); openEdit(viewingClient.clientId); }}
                className="w-full mt-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 transition"
              >
                Edit Client
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Clients;