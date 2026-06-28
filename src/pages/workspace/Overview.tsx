import React from 'react';
import type { Case } from '../Cases';

interface OverviewProps {
  activeCase: Case;
}

export default function Overview({ activeCase }: OverviewProps) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100">
      <h2 className="text-lg font-bold mb-4 text-gray-900">Case Overview</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase">Title</label>
          <p className="text-sm font-medium mt-1">{activeCase.title}</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase">Client</label>
          <p className="text-sm font-medium mt-1">{activeCase.client}</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase">Court</label>
          <p className="text-sm font-medium mt-1">{activeCase.court}</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase">Status</label>
          <p className="text-sm font-medium mt-1 capitalize">{activeCase.status}</p>
        </div>
      </div>
    </div>
  );
}
