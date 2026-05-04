import React from 'react';

export default function CallHistory({ visible, onClose, logs }) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[#0b0b10] w-11/12 md:w-2/3 lg:w-1/2 rounded-xl p-4 border border-[#ffffff12]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Call History</h3>
          <button onClick={onClose} className="text-[#9aa1b7]">Close</button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {(!logs || logs.length === 0) && <div className="text-sm text-[#9aa1b7]">No call history</div>}
          {logs && logs.map((l, idx) => (
            <div key={idx} className="p-3 border-b border-[#ffffff06]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">{l.peerUsername || l.peerUserId}</div>
                  <div className="text-xs text-[#9aa1b7]">{new Date(l.at).toLocaleString()}</div>
                </div>
                <div className="text-sm text-[#9aa1b7]">{l.type} · {l.duration || '--'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
