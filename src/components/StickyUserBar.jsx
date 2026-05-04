import React from 'react';
import { Phone, Video, Image, MoreHorizontal, Moon, Sun } from 'lucide-react';

export default function StickyUserBar({
  userPreview,
  isOnline,
  onStartCall,
  onStartVideo,
  onSendMedia,
  onOpenHistory,
  theme = 'dark',
  onToggleTheme,
}) {
  if (!userPreview) return null;

  return (
    <div
      className={`sticky top-0 z-40 px-4 py-4 backdrop-blur-xl ${
        theme === 'dark'
          ? 'border-b border-[#ffffff08] bg-[#12121a]/90'
          : 'bg-gradient-to-r from-[#91a6ff] to-[#7f96f4] text-white'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-3">
          <img
            src={userPreview.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userPreview.username}`}
            alt={userPreview.username}
            className={`w-10 h-10 rounded-full ${theme === 'dark' ? 'border-2 border-indigo-500/30' : 'border-2 border-white/60 bg-white/20'}`}
          />
          <div className="min-w-0">
            <div className={`truncate text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-white'}`}>{userPreview.username}</div>
            <div className={`text-xs ${theme === 'dark' ? 'text-[#6b6b7b]' : 'text-white/80'}`}>{isOnline ? 'Online' : 'Offline'}</div>
          </div>
        </div>

        <div
          className={`relative z-10 flex shrink-0 items-center gap-2 rounded-2xl px-2 py-1 ${
            theme === 'dark'
              ? 'border border-white/10 bg-white/[0.03]'
              : 'border border-white/25 bg-[#30344f]/25'
          }`}
        >
          <button
            onClick={() => onToggleTheme && onToggleTheme()}
            className={`rounded-xl p-2 transition ${theme === 'dark' ? 'hover:bg-[#ffffff08]' : 'hover:bg-white/10'}`}
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-[#cfcfe0]" /> : <Moon className="w-4 h-4 text-white" />}
          </button>
          <button
            onClick={() => onStartCall && onStartCall('audio')}
            className={`rounded-xl p-2 transition ${theme === 'dark' ? 'hover:bg-[#ffffff08]' : 'hover:bg-white/10'}`}
            aria-label="Start audio call"
          >
            <Phone className={`w-4 h-4 ${theme === 'dark' ? 'text-[#cfcfe0]' : 'text-white'}`} />
          </button>
          <button
            onClick={() => onStartVideo && onStartVideo('video')}
            className={`rounded-xl p-2 transition ${theme === 'dark' ? 'hover:bg-[#ffffff08]' : 'hover:bg-white/10'}`}
            aria-label="Start video call"
          >
            <Video className={`w-4 h-4 ${theme === 'dark' ? 'text-[#cfcfe0]' : 'text-white'}`} />
          </button>
          <button
            onClick={() => onSendMedia && onSendMedia()}
            className={`rounded-xl p-2 transition ${theme === 'dark' ? 'hover:bg-[#ffffff08]' : 'hover:bg-white/10'}`}
            aria-label="Send media"
          >
            <Image className={`w-4 h-4 ${theme === 'dark' ? 'text-[#cfcfe0]' : 'text-white'}`} />
          </button>
          <button
            onClick={onOpenHistory}
            className={`rounded-xl p-2 transition ${theme === 'dark' ? 'hover:bg-[#ffffff08]' : 'hover:bg-white/10'}`}
            aria-label="History"
          >
            <MoreHorizontal className={`w-4 h-4 ${theme === 'dark' ? 'text-[#cfcfe0]' : 'text-white'}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
