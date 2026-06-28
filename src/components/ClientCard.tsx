import React from 'react';
import { motion } from 'motion/react';
import { Phone, Mail, Briefcase, Calendar, ChevronRight, User } from 'lucide-react';

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  activeCases: number;
  upcomingHearing?: string;
  status: 'active' | 'inactive';
}

interface ClientCardProps {
  client: Client;
  index?: number;
  onClick?: () => void;
}

export const ClientCard: React.FC<ClientCardProps> = ({ client, index = 0, onClick }) => {
  const initials = client.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join('');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className="rounded-xl p-5 cursor-pointer transition-all group"
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)';
        (e.currentTarget as HTMLElement).style.borderColor = '#FED7AA';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)';
        (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB';
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold text-white"
          style={{ background: '#0A0A0A' }}
        >
          {initials || <User className="h-4 w-4" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{client.name}</h3>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{
                background: client.status === 'active' ? '#F0FDF4' : '#F9FAFB',
                color: client.status === 'active' ? '#15803D' : '#6B7280',
              }}
            >
              {client.status === 'active' ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-2 text-xs" style={{ color: '#6B7280' }}>
              <Phone className="h-3 w-3 flex-shrink-0" style={{ color: '#9CA3AF' }} />
              <span className="truncate">{client.phone}</span>
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: '#6B7280' }}>
              <Mail className="h-3 w-3 flex-shrink-0" style={{ color: '#9CA3AF' }} />
              <span className="truncate">{client.email}</span>
            </div>
          </div>

          <div
            className="flex items-center gap-4 mt-3 pt-3"
            style={{ borderTop: '1px solid #F3F4F6' }}
          >
            <div className="flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5" style={{ color: '#F97316' }} />
              <span className="text-xs font-semibold text-gray-900">{client.activeCases}</span>
              <span className="text-[11px]" style={{ color: '#9CA3AF' }}>cases</span>
            </div>
            {client.upcomingHearing && (
              <div className="flex items-center gap-1.5 min-w-0">
                <Calendar className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#F59E0B' }} />
                <span className="text-xs font-medium truncate" style={{ color: '#B45309' }}>
                  {client.upcomingHearing}
                </span>
              </div>
            )}
          </div>
        </div>

        <ChevronRight
          className="h-4 w-4 flex-shrink-0 mt-1 transition-transform group-hover:translate-x-0.5"
          style={{ color: '#D1D5DB' }}
        />
      </div>
    </motion.div>
  );
};

export default ClientCard;