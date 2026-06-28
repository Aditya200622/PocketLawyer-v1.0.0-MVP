import re

def refactor():
    with open('src/pages/workspace/Hearings.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Imports
    imports = """
import { subscribeHearings, Hearing as ServiceHearing, createHearing, updateHearing, deleteHearing } from '../../services/hearingService';
import { auth } from '../../firebase';
import { useEffect } from 'react';
"""
    content = content.replace("import { motion, AnimatePresence } from 'motion/react';", "import { motion, AnimatePresence } from 'motion/react';" + imports)

    # Remove MOCK_HEARINGS
    mock_start = content.find("const TODAY = '2025-04-18';")
    mock_end = content.find("const MONTH_NAMES = [", mock_start)
    content = content[:mock_start] + content[mock_end:]

    # Remove TODAY reference and use real TODAY
    # Replace daysUntil logic to use new Date().toISOString().split('T')[0] instead of TODAY
    content = content.replace(
        "const diff = Math.ceil((new Date(dateStr).getTime() - new Date(TODAY).getTime()) / 86400000);",
        "const todayStr = new Date().toISOString().split('T')[0];\n  const diff = Math.ceil((new Date(dateStr).getTime() - new Date(todayStr).getTime()) / 86400000);"
    )

    # Component State
    comp_start = content.find("export default function Hearings() {")
    comp_end = content.find("const filtered = ", comp_start)

    new_comp_start = """export default function Hearings() {
  const [hearings, setHearings]                 = useState<Hearing[]>([]);
  const [selected, setSelected]                 = useState<Hearing | null>(null);
  const [filterStatus, setFilterStatus]         = useState<string>('all');
  const [search, setSearch]                     = useState('');
  const [calYear,  setCalYear]                  = useState(new Date().getFullYear());
  const [calMonth, setCalMonth]                 = useState(new Date().getMonth());

  useEffect(() => {
    const user = auth.currentUser;
    const userId = user?.uid || 'anonymous';
    const unsub = subscribeHearings(userId, (serviceHearings) => {
      const todayStr = new Date().toISOString().split('T')[0];
      const mapped: Hearing[] = serviceHearings.map(h => {
        let st: 'upcoming' | 'today' | 'completed' | 'adjourned' = 'upcoming';
        if (h.status === 'completed') st = 'completed';
        else if (h.status === 'adjourned') st = 'adjourned';
        else if (h.hearingDate === todayStr) st = 'today';

        return {
          id: h.hearingId,
          caseId: h.caseId || 'UNKNOWN',
          caseTitle: h.caseNumber || 'Unknown Case',
          client: 'Unknown Client',
          court: h.courtName || 'Unknown Court',
          judge: h.judgeName || 'Unknown Judge',
          date: h.hearingDate,
          time: h.hearingTime || '00:00',
          type: h.purpose || 'Hearing',
          notes: h.remarks || '',
          attachments: [],
          status: st,
        };
      });
      setHearings(mapped);
      if (mapped.length > 0 && !selected) setSelected(mapped[0]);
    });
    return () => unsub();
  }, []);

  """
    content = content[:comp_start] + new_comp_start + content[comp_end:]

    # Replace HEARINGS with hearings
    content = content.replace("HEARINGS.filter", "hearings.filter")
    content = content.replace("HEARINGS.map", "hearings.map")

    # Fix todayHearings
    content = content.replace(
        "h => h.date === TODAY",
        "h => h.date === new Date().toISOString().split('T')[0]"
    )

    # Wire Dummy createHearing to "Schedule Hearing" button
    btn_schedule = """<button
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: '#F97316' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#EA580C')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#F97316')}
            >
              <Plus className="h-4 w-4" /> Schedule Hearing
            </button>"""
    new_btn_schedule = """<button
              onClick={() => {
                const user = auth.currentUser;
                createHearing({
                  caseId: "C00" + Math.floor(Math.random() * 10), caseNumber: "DUMMY/123", courtName: "High Court",
                  judgeName: "Hon'ble Judge", courtRoom: "Room 1", hearingDate: new Date().toISOString().split('T')[0],
                  hearingTime: "10:00", nextHearingDate: "", nextHearingTime: "", purpose: "New Hearing",
                  status: "scheduled", remarks: "Dummy", createdBy: user?.displayName || "System", userId: user?.uid || "anonymous"
                }).catch(console.error);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: '#F97316' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#EA580C')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#F97316')}
            >
              <Plus className="h-4 w-4" /> Schedule Hearing
            </button>"""
    content = content.replace(btn_schedule, new_btn_schedule)

    # Add Edit and Delete dummy actions in the Right Detail Panel
    actions_section = """<div className="px-4 py-3 flex flex-col gap-2">
                      <button
                        className="w-full py-2.5 rounded-xl text-xs font-semibold text-white transition-all"
                        style={{ background: '#F97316' }}
                        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#EA580C')}
                        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#F97316')}
                      >
                        Set Reminder
                      </button>
                      <button
                        className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all"
                        style={{ background: '#F3F4F6', color: '#374151' }}
                        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#E5E7EB')}
                        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#F3F4F6')}
                      >
                        Export Details
                      </button>
                    </div>"""
    new_actions_section = """<div className="px-4 py-3 flex flex-col gap-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (selected) updateHearing(selected.id, { purpose: selected.type + " (Updated)" }).catch(console.error);
                          }}
                          className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
                          style={{ background: '#F3F4F6', color: '#374151' }}
                          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#E5E7EB')}
                          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#F3F4F6')}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (selected) {
                              deleteHearing(selected.id).catch(console.error);
                              setSelected(null);
                            }
                          }}
                          className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white transition-all"
                          style={{ background: '#EF4444' }}
                          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#DC2626')}
                          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#EF4444')}
                        >
                          Delete
                        </button>
                      </div>
                      <button
                        className="w-full py-2.5 rounded-xl text-xs font-semibold text-white transition-all"
                        style={{ background: '#F97316' }}
                        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#EA580C')}
                        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#F97316')}
                      >
                        Set Reminder
                      </button>
                      <button
                        className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all"
                        style={{ background: '#F3F4F6', color: '#374151' }}
                        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#E5E7EB')}
                        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#F3F4F6')}
                      >
                        Export Details
                      </button>
                    </div>"""
    content = content.replace(actions_section, new_actions_section)

    with open('src/pages/workspace/Hearings.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

refactor()
