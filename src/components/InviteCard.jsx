import { useMemo, useState } from 'react';
import { Copy, QrCode, Search, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';

const buildInviteLink = (publicId) => {
  if (!publicId) return '';
  if (typeof window === 'undefined') return publicId;
  return `${window.location.origin}/?invite=${encodeURIComponent(publicId)}`;
};

export default function InviteCard({ currentUser, isRefreshingUser = false, onLookupInvite }) {
  const [lookupCode, setLookupCode] = useState('');
  const publicId = currentUser?.public_id || '';
  const hasInviteIdentity = Boolean(publicId);

  const inviteLink = useMemo(() => buildInviteLink(publicId), [publicId]);
  const qrImageUrl = useMemo(() => {
    if (!inviteLink) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(inviteLink)}`;
  }, [inviteLink]);

  const copyValue = async (value, label) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch (error) {
      toast.error(`Could not copy ${label.toLowerCase()}`);
    }
  };

  const handleLookup = async (e) => {
    e.preventDefault();
    const normalized = lookupCode.trim().toUpperCase();
    if (!normalized) return;
    await onLookupInvite?.(normalized);
  };

  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.92),rgba(10,14,26,0.96))] p-4 shadow-[0_20px_60px_rgba(15,23,42,0.45)]">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-cyan-500/15 p-3 text-cyan-300">
          <QrCode className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Invite Identity</p>
          <p className="text-xs text-slate-400">Share your QR or public code to connect fast.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr,120px]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/75">Public ID</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-lg font-semibold text-white">
                {publicId || (isRefreshingUser ? 'Loading profile...' : 'Profile not synced yet')}
              </span>
              <button
                type="button"
                onClick={() => copyValue(publicId, 'Public ID')}
                disabled={!hasInviteIdentity}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Copy public id"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Invite Link</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="truncate text-sm text-slate-200">
                {inviteLink || (isRefreshingUser ? 'Waiting for profile sync...' : 'Invite link unavailable')}
              </span>
              <button
                type="button"
                onClick={() => copyValue(inviteLink, 'Invite link')}
                disabled={!inviteLink}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Copy invite link"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>

          <form onSubmit={handleLookup} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <label className="mb-2 block text-[11px] uppercase tracking-[0.24em] text-slate-400">
              Find Registered User
            </label>
            <div className="flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-slate-950/40 px-3">
                <Search className="h-4 w-4 text-slate-500" />
                <input
                  value={lookupCode}
                  onChange={(e) => setLookupCode(e.target.value)}
                  placeholder="Enter public ID"
                  className="w-full bg-transparent py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-3 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                <UserPlus className="h-4 w-4" />
                Add
              </button>
            </div>
          </form>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white p-2">
          {qrImageUrl ? (
            <img src={qrImageUrl} alt="Invite QR code" className="h-full w-full rounded-xl object-cover" />
          ) : (
            <div className="flex h-full min-h-[120px] items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-500">
              {isRefreshingUser ? 'QR will appear after profile sync' : 'QR unavailable until profile is refreshed'}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
