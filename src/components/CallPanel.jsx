import React from 'react';
import { Phone, Video, PhoneOff, X, Mic, VideoOff } from 'lucide-react';

export default function CallPanel({
  callSession,
  callDuration,
  onAccept,
  onReject,
  onEnd,
  localStream,
  remoteStream,
  muted,
  toggleMute,
  videoEnabled,
  toggleVideo,
}) {
  const isVideo = callSession.callType === 'video';
  const remoteVideoRef = React.useRef(null);
  const localVideoRef = React.useRef(null);
  const remoteAudioRef = React.useRef(null);
  const [needsUserGesture, setNeedsUserGesture] = React.useState(false);
  const [loud, setLoud] = React.useState(false);

  React.useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      try {
        remoteVideoRef.current.muted = true;
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(() => {
          setNeedsUserGesture(true);
        });
      } catch (e) {
        console.warn('Failed to play remote video', e);
      }
    }
  }, [remoteStream]);

  React.useEffect(() => {
    if (localVideoRef.current && localStream) {
      try {
        // local video can be muted to autoplay safely
        localVideoRef.current.muted = true;
        localVideoRef.current.srcObject = localStream;
        localVideoRef.current.play().catch(() => {});
      } catch (e) {
        console.warn('Failed to play local video', e);
      }
    }
  }, [localStream]);

  React.useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      try {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.muted = false;
        remoteAudioRef.current.volume = loud ? 1 : 0.7;
        remoteAudioRef.current.play().catch(() => {
          setNeedsUserGesture(true);
        });
      } catch (e) {
        console.warn('Failed to play remote audio', e);
      }
    } else {
      setNeedsUserGesture(false);
    }
  }, [remoteStream, loud]);

  React.useEffect(() => {
    if (!remoteAudioRef.current) return;
    try {
      remoteAudioRef.current.volume = loud ? 1 : 0.7;
    } catch (e) {
      // ignore
    }
  }, [loud, remoteAudioRef]);

  const enableAudioVideo = () => {
    try {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.muted = false;
        remoteAudioRef.current.play().catch(() => {});
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.play().catch(() => {});
      }
    } catch (e) {
      console.warn('Failed to enable media', e);
    }
    setNeedsUserGesture(false);
  };

  if (!callSession || callSession.status === 'idle') return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto w-full max-w-[420px] overflow-hidden rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(9,14,27,0.96),rgba(17,24,39,0.96))] shadow-[0_25px_80px_rgba(2,6,23,0.6)] md:inset-x-auto md:bottom-6 md:right-6">
      {/* Video area when active */}
      {isVideo && callSession.status === 'active' ? (
        <div className="relative h-[260px] bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.22),transparent_40%),#020617]">
          <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover object-center bg-black/80" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-transparent"></div>
          <div className="absolute bottom-3 right-3 h-24 w-32 overflow-hidden rounded-2xl border border-white/20 shadow-lg">
            <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
          </div>
        </div>
      ) : null}

      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-white font-semibold">
              {callSession.status === 'incoming' && `Incoming ${isVideo ? 'video' : 'audio'} call`}
              {callSession.status === 'outgoing' && `Calling ${callSession.peerUsername}...`}
              {callSession.status === 'active' && `In call with ${callSession.peerUsername}`}
            </div>
            <div className="text-xs text-[#9aa1b7]">{callDuration}</div>
          </div>
          <button
            type="button"
            onClick={callSession.status === 'incoming' ? onReject : onEnd}
            className="rounded-lg p-1.5 text-[#9aa1b7] hover:bg-[#ffffff0d] hover:text-white"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          {callSession.status === 'incoming' ? (
            <>
              <button
                type="button"
                onClick={onReject}
                className="inline-flex items-center gap-2 rounded-xl bg-red-500/85 px-3 py-2 text-sm font-medium text-white hover:bg-red-500"
              >
                <PhoneOff className="h-4 w-4" />
                Reject
              </button>
              <button
                type="button"
                onClick={onAccept}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/85 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                <Phone className="h-4 w-4" />
                Accept
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleMute}
                className="inline-flex items-center gap-2 rounded-xl bg-[#22242b]/85 px-3 py-2 text-sm font-medium text-white hover:bg-[#2b2d34]"
              >
                {muted ? <Mic className="h-4 w-4 text-red-400" /> : <Mic className="h-4 w-4" />}
                {muted ? 'Unmute' : 'Mute'}
              </button>
              {isVideo && (
                <button
                  type="button"
                  onClick={toggleVideo}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#22242b]/85 px-3 py-2 text-sm font-medium text-white hover:bg-[#2b2d34]"
                >
                  {videoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                  {videoEnabled ? 'Camera' : 'No Camera'}
                </button>
              )}

              <button
                type="button"
                onClick={onEnd}
                className="inline-flex items-center gap-2 rounded-xl bg-red-500/85 px-3 py-2 text-sm font-medium text-white hover:bg-red-500"
              >
                <PhoneOff className="h-4 w-4" />
                {callSession.status === 'outgoing' ? 'Cancel' : 'End call'}
              </button>
            </>
          )}
        </div>
        {callSession.status === 'active' && (
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setLoud((current) => !current)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#22242b]/85 px-3 py-2 text-sm font-medium text-white hover:bg-[#2b2d34]"
            >
              {loud ? 'Normal Volume' : 'Boost Volume'}
            </button>
            {needsUserGesture && (
              <button
                type="button"
                onClick={enableAudioVideo}
                className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Enable audio
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
