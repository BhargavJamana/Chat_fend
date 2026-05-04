import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import EmojiPicker from 'emoji-picker-react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import {
  initializeSocket,
  disconnectSocket,
  isSocketConnected,
  sendTyping,
  stopTyping,
  onSocketEvent,
  offSocketEvent,
  emitCallOffer,
  emitCallAnswer,
  emitCallIceCandidate,
  emitCallReject,
  emitCallEnd,
} from '../services/socket';
import StickyUserBar from '../components/StickyUserBar';
import CallHistory from '../components/CallHistory';
import CallPanel from '../components/CallPanel';
import VoiceRecorderButton from '../components/VoiceRecorderButton';
import api from '../services/api';
import {
  MessageCircle,
  Send,
  Search,
  LogOut,
  Phone,
  Video,
  Image,
  Smile,
  Check,
  CheckCheck,
  Clock3,
  AlertTriangle,
  RotateCcw,
  PhoneOff,
  X,
  Play,
  Pause,
} from 'lucide-react';
import toast from 'react-hot-toast';

const toNumber = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
};

const getDeliveryStatus = (message) => {
  if (message?.delivery_status) return message.delivery_status;
  if (message?.seen_at || message?.is_read) return 'seen';
  if (message?.delivered_at) return 'delivered';
  return 'sent';
};

const normalizeTimestamp = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const hasTimeZone = /([zZ]|[+-]\d{2}:\d{2})$/.test(trimmed);
    if (!hasTimeZone && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(trimmed)) {
      return `${trimmed.replace(' ', 'T')}Z`;
    }
    return trimmed;
  }
  return value;
};

const formatClockTime = (rawValue) => {
  const normalized = normalizeTimestamp(rawValue);
  const date = new Date(normalized || 0);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatCallDuration = (seconds) => {
  const safeSeconds = Math.max(0, Number.parseInt(seconds, 10) || 0);
  const mins = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, '0');
  const secs = (safeSeconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

export default function Chat() {
  const { user, logout, refreshCurrentUser, isRefreshingUser } = useAuthStore();
  const {
    conversations,
    setConversations,
    currentConversation,
    setCurrentConversation,
    messages,
    setMessages,
    addOrUpdateMessage,
    enqueuePendingMessage,
    beginPendingAttempt,
    failPendingMessage,
    completePendingMessage,
    getPendingMessage,
    pendingMessages,
    upsertConversationFromMessage,
    onlineUsers,
    lastSeenByUser,
    typingUsers,
    serverTimeOffsetMs,
    setServerTimeOffsetMs,
  } = useChatStore();

  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [themeMode, setThemeMode] = useState(() => {
    try {
      return localStorage.getItem('chatapp-theme-mode') || 'dark';
    } catch {
      return 'dark';
    }
  });
  const [users, setUsers] = useState([]);
  const [callSession, setCallSession] = useState({
    status: 'idle',
    callType: 'audio',
    peerUserId: null,
    peerUsername: '',
    peerAvatar: null,
    startedAt: null,
  });
  const pcRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const [muted, setMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [callLogs, setCallLogs] = useState(() => {
    try {
      const raw = localStorage.getItem('chatapp-call-logs');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [showCallHistory, setShowCallHistory] = useState(false);
  const callStartAtRef = useRef(null);
  

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const callSessionRef = useRef(callSession);
  const fileInputRef = useRef(null);
  const inviteAutoOpenedRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      localStorage.setItem('chatapp-theme-mode', themeMode);
    } catch {}
  }, [themeMode]);

  const onlineUserSet = useMemo(() => new Set((onlineUsers || []).map((id) => toNumber(id))), [onlineUsers]);

  const isUserOnline = (userId) => {
    const normalizedId = toNumber(userId);
    if (!normalizedId) return false;
    return onlineUserSet.has(normalizedId);
  };

  const getPresenceLabel = (userId) => {
    const normalizedId = toNumber(userId);
    if (!normalizedId) return 'Offline';
    if (isUserOnline(normalizedId)) return 'Online';
    const lastSeenAt = lastSeenByUser?.[normalizedId];
    if (!lastSeenAt) return 'Offline';
    return `Last seen ${formatClockTime(lastSeenAt)}`;
  };

  const getUserPreview = (userId, fallbackUsername = 'User', fallbackAvatar = null) => {
    const normalizedId = toNumber(userId);
    if (!normalizedId) {
      return { id: null, username: fallbackUsername, avatar: fallbackAvatar };
    }

    if (currentConversation && toNumber(currentConversation.id) === normalizedId) {
      return {
        id: normalizedId,
        username: currentConversation.username || fallbackUsername,
        avatar: currentConversation.avatar || fallbackAvatar,
      };
    }

    const userFromList = users.find((entry) => toNumber(entry.id) === normalizedId);
    if (userFromList) {
      return {
        id: normalizedId,
        username: userFromList.username || fallbackUsername,
        avatar: userFromList.avatar || fallbackAvatar,
      };
    }

    const userFromConversations = conversations.find(
      (entry) => toNumber(entry.other_user_id) === normalizedId
    );

    if (userFromConversations) {
      return {
        id: normalizedId,
        username: userFromConversations.other_username || fallbackUsername,
        avatar: userFromConversations.other_avatar || fallbackAvatar,
      };
    }

    return { id: normalizedId, username: fallbackUsername, avatar: fallbackAvatar };
  };

  const resetCallSession = () => {
    setCallSession({
      status: 'idle',
      callType: 'audio',
      peerUserId: null,
      peerUsername: '',
      peerAvatar: null,
      startedAt: null,
    });
    setCallDurationSeconds(0);
    setMuted(false);
    setVideoEnabled(true);
  };

  const cleanupCallResources = () => {
    try {
      pendingIceCandidatesRef.current = [];
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach((track) => track.stop());
        remoteStreamRef.current = null;
      }
    } catch (error) {
      console.error('Error cleaning up call resources:', error);
    }
  };

  const flushPendingIceCandidates = async () => {
    if (!pcRef.current?.remoteDescription) return;

    const queuedCandidates = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];

    for (const candidate of queuedCandidates) {
      try {
        await pcRef.current.addIceCandidate(candidate);
      } catch (error) {
        console.error('Failed to flush queued ICE candidate:', error);
      }
    }
  };

  const syncServerClock = async () => {
    try {
      const response = await api.get('/health');
      const serverTimestamp = Date.parse(response.data?.timestamp);
      if (!Number.isNaN(serverTimestamp)) {
        setServerTimeOffsetMs(serverTimestamp - Date.now());
      }
    } catch (error) {
      console.error('Failed to sync server clock:', error);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    let mounted = true;
    let clockSyncInterval;

    const bootstrap = async () => {
      await refreshCurrentUser();
      if (!mounted) return;

      initializeSocket();
      syncServerClock();
      clockSyncInterval = setInterval(syncServerClock, 60000);
      fetchUsers();
      fetchConversations();
    };

    bootstrap();

    return () => {
      mounted = false;
      clearInterval(clockSyncInterval);
      disconnectSocket();
    };
  }, [user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(() => {
      processRetryQueue();
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    callSessionRef.current = callSession;
  }, [callSession]);

  useEffect(() => {
    if (callSession.status !== 'active' || !callSession.startedAt) {
      setCallDurationSeconds(0);
      return;
    }

    const startTime = new Date(callSession.startedAt).getTime();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setCallDurationSeconds(Math.max(0, elapsed));
    }, 1000);

    return () => clearInterval(interval);
  }, [callSession.status, callSession.startedAt]);

  // persist call logs
  const pushCallLog = (log) => {
    const next = [log].concat(callLogs).slice(0, 200);
    setCallLogs(next);
    try {
      localStorage.setItem('chatapp-call-logs', JSON.stringify(next));
    } catch (e) {
      console.warn('Failed to persist call logs', e);
    }
  };

  useEffect(() => {
    if (!user) return;

    initializeSocket();

    const handleIncomingCall = (payload = {}) => {
      const fromUserId = toNumber(payload.fromUserId);
      if (!fromUserId) return;

      if (callSessionRef.current.status !== 'idle') {
        emitCallReject({ toUserId: fromUserId, reason: 'busy' });
        return;
      }

      const preview = getUserPreview(fromUserId, payload.fromUsername, payload.fromAvatar);
      setCallSession({
        status: 'incoming',
        callType: payload.callType === 'video' ? 'video' : 'audio',
        peerUserId: fromUserId,
        peerUsername: preview.username,
        peerAvatar: preview.avatar,
        startedAt: payload.at || new Date().toISOString(),
        offer: payload.offer || null,
      });
      toast(`Incoming ${payload.callType === 'video' ? 'video' : 'audio'} call from ${preview.username}`);
    };

    const handleAnswered = async (payload = {}) => {
      const fromUserId = toNumber(payload.fromUserId);
      if (!fromUserId) return;

      if (
        callSessionRef.current.status === 'outgoing' &&
        toNumber(callSessionRef.current.peerUserId) === fromUserId
      ) {
        // Set remote description from callee answer
        try {
          if (pcRef.current && payload.answer) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
            await flushPendingIceCandidates();
          }
        } catch (err) {
          console.error('Failed to set remote description on answered:', err);
        }

        // mark call start
        callStartAtRef.current = Date.now();
        setCallSession((prev) => ({
          ...prev,
          status: 'active',
          startedAt: payload.at || new Date().toISOString(),
        }));
        toast.success('Call connected');
      }
    };

    const handleRejected = (payload = {}) => {
      const fromUserId = toNumber(payload.fromUserId);
      if (
        fromUserId &&
        callSessionRef.current.peerUserId &&
        toNumber(callSessionRef.current.peerUserId) !== fromUserId
      ) {
        return;
      }

      const reason = payload.reason === 'busy' ? 'User is busy on another call' : 'Call was declined';
      toast(reason);
      cleanupCallResources();
      resetCallSession();
    };

    const handleEnded = (payload = {}) => {
      const fromUserId = toNumber(payload.fromUserId);
      if (
        fromUserId &&
        callSessionRef.current.peerUserId &&
        toNumber(callSessionRef.current.peerUserId) !== fromUserId
      ) {
        return;
      }
      toast('Call ended');
      // record call log
      try {
        const startedAt = callStartAtRef.current || Date.parse(callSession.startedAt) || Date.now();
        const duration = Math.floor((Date.now() - startedAt) / 1000);
        pushCallLog({
          peerUserId: callSession.peerUserId,
          peerUsername: callSession.peerUsername,
          type: callSession.callType,
          at: new Date(startedAt).toISOString(),
          duration,
        });
      } catch (e) {
        console.warn('Failed to log call', e);
      }

      endCurrentCall({ notifyPeer: false });
    };

    const handleUnavailable = (payload = {}) => {
      const toUserId = toNumber(payload.toUserId);
      if (
        toUserId &&
        callSessionRef.current.peerUserId &&
        toNumber(callSessionRef.current.peerUserId) !== toUserId
      ) {
        return;
      }
      toast.error('User is offline. Call cannot be started now.');
      cleanupCallResources();
      resetCallSession();
    };

    const handleRemoteIce = async (payload = {}) => {
      try {
        const candidate = payload.candidate;
        if (candidate && pcRef.current?.remoteDescription) {
          await pcRef.current.addIceCandidate(candidate);
        } else if (candidate) {
          pendingIceCandidatesRef.current.push(candidate);
        }
      } catch (err) {
        console.error('Failed to add remote ICE candidate', err);
      }
    };

    onSocketEvent('call:incoming', handleIncomingCall);
    onSocketEvent('call:answered', handleAnswered);
    onSocketEvent('call:rejected', handleRejected);
    onSocketEvent('call:ended', handleEnded);
    onSocketEvent('call:unavailable', handleUnavailable);
    onSocketEvent('call:ice-candidate', handleRemoteIce);

    return () => {
      offSocketEvent('call:incoming', handleIncomingCall);
      offSocketEvent('call:answered', handleAnswered);
      offSocketEvent('call:rejected', handleRejected);
      offSocketEvent('call:ended', handleEnded);
      offSocketEvent('call:unavailable', handleUnavailable);
      offSocketEvent('call:ice-candidate', handleRemoteIce);
    };
  }, [user, users, conversations, currentConversation]);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data.users);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchConversations = async () => {
    try {
      const response = await api.get('/messages');
      setConversations(response.data.conversations);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
  };

  const fetchMessages = async (userId) => {
    try {
      const response = await api.get(`/messages/${userId}`);
      setMessages(response.data.messages);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const sendPendingMessage = async (clientMessageId, showToastOnFailure = false) => {
    const pending = getPendingMessage(clientMessageId);
    if (!pending || pending.inFlight) return;

    beginPendingAttempt(clientMessageId);

    try {
      const response = await api.post('/messages', {
        ...pending.payload,
        client_message_id: clientMessageId,
      });

      if (response.data?.message) {
        addOrUpdateMessage(response.data.message);
        upsertConversationFromMessage(response.data.message, user.id);
      }

      completePendingMessage(clientMessageId);
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Message not sent';
      failPendingMessage(clientMessageId, errorMessage);
      if (showToastOnFailure) {
        toast.error(errorMessage);
      }
    }
  };

  const processRetryQueue = () => {
    const entries = Object.entries(useChatStore.getState().pendingMessages || {});
    entries.forEach(([clientMessageId, pending]) => {
      if (!pending || pending.inFlight) return;
      if (!['queued', 'failed'].includes(pending.status)) return;
      if (pending.lastAttemptAt && Date.now() - pending.lastAttemptAt < 5000) return;
      sendPendingMessage(clientMessageId, false);
    });
  };

  const startCall = (callType) => {
    if (!currentConversation) {
      toast('Select a conversation to start a call');
      return;
    }

    if (callSession.status !== 'idle') {
      toast('Finish the current call first');
      return;
    }

    const normalizedType = callType === 'video' ? 'video' : 'audio';
    const preview = getUserPreview(currentConversation.id, currentConversation.username, currentConversation.avatar);
    if (!preview.id) {
      toast.error('Unable to start call for this user');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
      toast.error('Calling is not supported in this browser');
      return;
    }

    (async () => {
      initializeSocket();
      setCallSession((prev) => ({
        ...prev,
        status: 'outgoing',
        callType: normalizedType,
        peerUserId: preview.id,
        peerUsername: preview.username,
        peerAvatar: preview.avatar,
        startedAt: new Date().toISOString(),
      }));

      try {
        pendingIceCandidatesRef.current = [];
        // Create RTCPeerConnection
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });
        pcRef.current = pc;

        // Local stream
        const constraints = normalizedType === 'video' ? { audio: true, video: true } : { audio: true, video: false };
        const localStream = await navigator.mediaDevices.getUserMedia(constraints);
        localStreamRef.current = localStream;
        setVideoEnabled(!!constraints.video);

        localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

        // Remote stream
        const remoteStream = new MediaStream();
        remoteStreamRef.current = remoteStream;
        pc.ontrack = (ev) => {
          ev.streams.forEach((s) => s.getTracks().forEach((t) => remoteStream.addTrack(t)));
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            emitCallIceCandidate({ toUserId: preview.id, candidate: event.candidate });
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        emitCallOffer({
          toUserId: preview.id,
          callType: normalizedType,
          offer: pc.localDescription,
          fromUsername: user.username,
          fromAvatar: user.avatar || null,
        });

        if (!isSocketConnected()) {
          toast('Connecting call signal...');
        }
      } catch (err) {
        console.error('Failed to start call:', err);
        cleanupCallResources();
        toast.error(err?.name === 'NotAllowedError' ? 'Microphone or camera permission was denied' : 'Failed to start call');
        resetCallSession();
      }
    })();
  };


  const acceptIncomingCall = () => {
    (async () => {
      if (callSession.status !== 'incoming' || !callSession.peerUserId) return;

      try {
        initializeSocket();
        pendingIceCandidatesRef.current = [];
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        pcRef.current = pc;

        const offer = callSession.offer;
        if (offer) {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          await flushPendingIceCandidates();
        }

        const constraints = callSession.callType === 'video' ? { audio: true, video: true } : { audio: true, video: false };
        const localStream = await navigator.mediaDevices.getUserMedia(constraints);
        localStreamRef.current = localStream;
        setVideoEnabled(!!constraints.video);

        localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

        const remoteStream = new MediaStream();
        remoteStreamRef.current = remoteStream;
        pc.ontrack = (ev) => {
          ev.streams.forEach((s) => s.getTracks().forEach((t) => remoteStream.addTrack(t)));
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            emitCallIceCandidate({ toUserId: callSession.peerUserId, candidate: event.candidate });
          }
        };

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        emitCallAnswer({
          toUserId: callSession.peerUserId,
          callType: callSession.callType,
          answer: pc.localDescription,
        });

        callStartAtRef.current = Date.now();
        setCallSession((prev) => ({ ...prev, status: 'active', startedAt: new Date().toISOString() }));
        toast.success('Call connected');
      } catch (err) {
        console.error('Accept call failed:', err);
        cleanupCallResources();
        toast.error(err?.name === 'NotAllowedError' ? 'Microphone or camera permission was denied' : 'Failed to accept call');
        resetCallSession();
      }
    })();
  };

  const rejectIncomingCall = () => {
    if (callSession.status !== 'incoming' || !callSession.peerUserId) {
      resetCallSession();
      return;
    }

    emitCallReject({
      toUserId: callSession.peerUserId,
      reason: 'declined',
    });
    cleanupCallResources();
    resetCallSession();
  };

  const endCurrentCall = ({ notifyPeer = true } = {}) => {
    if (notifyPeer && callSession.peerUserId) {
      emitCallEnd({ toUserId: callSession.peerUserId });
    }
    cleanupCallResources();
    resetCallSession();
  };


  const toggleMute = () => {
    const s = localStreamRef.current;
    if (!s) return;
    s.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setMuted((current) => !current);
  };

  const toggleVideo = () => {
    const s = localStreamRef.current;
    if (!s) return;
    s.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setVideoEnabled((current) => !current);
  };

  const handleSelectUser = (selectedUser) => {
    setCurrentConversation(selectedUser);
    fetchMessages(selectedUser.id);
    setShowSidebar(false);
  };

  const handleInviteLookup = async (publicId) => {
    try {
      const response = await api.get(`/users/invite/${encodeURIComponent(publicId)}`);
      const selectedUser = response.data?.user;
      if (!selectedUser) {
        toast.error('No user found for that invite ID');
        return;
      }

      handleSelectUser(selectedUser);
      toast.success(`Connected with ${selectedUser.username}`);
    } catch (error) {
      console.error('Invite lookup error:', error);
      toast.error(error.response?.data?.message || 'User not found for that invite ID');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim() || !currentConversation) return;

    const outgoingText = messageText.trim();
    setMessageText('');
    setShowEmojiPicker(false);
    stopTyping(currentConversation.id);

    const clientMessageId = `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const payload = {
      receiver_id: currentConversation.id,
      content: outgoingText,
      message_type: 'text',
    };

    const optimisticMessage = {
      id: `temp-${clientMessageId}`,
      client_message_id: clientMessageId,
      sender_id: user.id,
      receiver_id: currentConversation.id,
      content: outgoingText,
      message_type: 'text',
      created_at: new Date(Date.now() + serverTimeOffsetMs).toISOString(),
      delivery_status: 'sending',
      sender_username: user.username,
      sender_avatar: user.avatar,
      receiver_username: currentConversation.username,
      receiver_avatar: currentConversation.avatar,
      is_read: false,
    };

    addOrUpdateMessage(optimisticMessage);
    upsertConversationFromMessage(optimisticMessage, user.id);
    enqueuePendingMessage(clientMessageId, payload);
    await sendPendingMessage(clientMessageId, true);
  };

  const handleFileSelected = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    sendFileMessage(f);
    e.target.value = '';
  };

  const sendFileMessage = async (file) => {
    if (!currentConversation) return toast.error('Select a conversation');

    const clientMessageId = `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const normalizedName = String(file.name || '').toLowerCase();
    const inferredAudio =
      file.type.startsWith('audio') || /\.(webm|ogg|wav|mp3|m4a|aac)$/i.test(normalizedName);
    const messageType = file.type.startsWith('image') ? 'image' : inferredAudio ? 'voice' : 'file';

    // optimistic message
    const previewUrl = URL.createObjectURL(file);
    const optimisticMessage = {
      id: `temp-${clientMessageId}`,
      client_message_id: clientMessageId,
      sender_id: user.id,
      receiver_id: currentConversation.id,
      content: previewUrl,
      message_type: messageType,
      created_at: new Date(Date.now() + serverTimeOffsetMs).toISOString(),
      delivery_status: 'sending',
      sender_username: user.username,
      sender_avatar: user.avatar,
      receiver_username: currentConversation.username,
      receiver_avatar: currentConversation.avatar,
      is_read: false,
    };

    addOrUpdateMessage(optimisticMessage);
    upsertConversationFromMessage(optimisticMessage, user.id);

    const form = new FormData();
    form.append('receiver_id', String(currentConversation.id));
    form.append('receiverId', String(currentConversation.id));
    form.append('message_type', messageType);
    form.append('content', messageType === 'voice' ? '[voice-message]' : file.name || '[attachment]');
    form.append('file', file);
    form.append('client_message_id', clientMessageId);

    try {
      // Don't set Content-Type explicitly - let axios/browser auto-detect multipart/form-data
      const response = await api.post('/messages', form);
      if (response.data?.message) {
        addOrUpdateMessage(response.data.message);
        upsertConversationFromMessage(response.data.message, user.id);
      }
      completePendingMessage(clientMessageId);
    } catch (err) {
      console.error('File upload error:', err.response?.status, err.response?.data);
      failPendingMessage(clientMessageId, 'Failed to send file');
      toast.error(`File upload failed: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleTyping = (e) => {
    setMessageText(e.target.value);
    if (currentConversation) {
      sendTyping(currentConversation.id);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping(currentConversation.id);
      }, 2000);
    }
  };

  const handleLogout = () => {
    if (callSession.status !== 'idle') {
      endCurrentCall();
    }
    logout();
    disconnectSocket();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const toggleThemeMode = () => {
    setThemeMode((current) => (current === 'dark' ? 'soft' : 'dark'));
  };

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (!user || !users.length || inviteAutoOpenedRef.current) return;

    const inviteCode = new URLSearchParams(window.location.search).get('invite');
    if (!inviteCode) return;

    inviteAutoOpenedRef.current = true;
    handleInviteLookup(inviteCode);
  }, [user, users]);

  const isTyping = currentConversation && typingUsers[currentConversation.id];
  const pendingCount = Object.keys(pendingMessages || {}).length;
  const currentConversationOnline = currentConversation ? isUserOnline(currentConversation.id) : false;

  return (
    <div
      className={`min-h-screen flex ${
        themeMode === 'dark' ? 'bg-[#050816] text-white' : 'bg-[#edf2ff] text-slate-900'
      }`}
    >
      <div className="fixed inset-0 pointer-events-none">
        {themeMode === 'dark' ? (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_25%),radial-gradient(circle_at_bottom_right,rgba(217,70,239,0.10),transparent_24%),linear-gradient(180deg,#030712,#07111f_42%,#050816)]"></div>
            <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.04)_1px,transparent_1px)] bg-[size:48px_48px] opacity-30"></div>
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-[120px]"></div>
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(96,165,250,0.18),transparent_26%),linear-gradient(180deg,#eef2ff,#e8ecff_40%,#f8fbff)]"></div>
            <div className="absolute top-12 left-16 h-72 w-72 rounded-full bg-white/60 blur-[80px]"></div>
            <div className="absolute bottom-8 right-12 h-80 w-80 rounded-full bg-indigo-200/45 blur-[90px]"></div>
          </>
        )}
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[1360px]">
      <div
        className={`${showSidebar ? 'w-full md:w-80' : 'w-0'} md:w-80 ${
          themeMode === 'dark'
            ? 'bg-[#12121a]/80 border-r border-[#ffffff08]'
            : 'bg-white/75 border-r border-indigo-100/90 shadow-[0_18px_60px_rgba(99,102,241,0.08)]'
        } backdrop-blur-xl transition-all duration-300 overflow-hidden relative z-10`}
      >
        <div className="h-full flex flex-col">
          <div className={`p-4 border-b ${themeMode === 'dark' ? 'border-[#ffffff08]' : 'border-indigo-100/90'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className={`absolute inset-0 rounded-full blur-md opacity-50 ${themeMode === 'dark' ? 'bg-gradient-to-r from-indigo-500 to-violet-500' : 'bg-gradient-to-r from-indigo-300 to-sky-300'}`}></div>
                  <div className={`relative w-10 h-10 rounded-full flex items-center justify-center ${themeMode === 'dark' ? 'bg-gradient-to-br from-indigo-500 to-violet-600' : 'bg-gradient-to-br from-[#8ea2ff] to-[#7bc8ff]'}`}>
                    <span className={`font-semibold ${themeMode === 'dark' ? 'text-white' : 'text-white'}`}>
                      {user?.username?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className={`absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 ${themeMode === 'dark' ? 'border-[#12121a]' : 'border-white'}`}></span>
                </div>
                <div>
                  <h2 className={`font-semibold ${themeMode === 'dark' ? 'text-white' : 'text-slate-900'}`}>{user?.username}</h2>
                  <p className={`text-xs ${themeMode === 'dark' ? 'text-[#6b6b7b]' : 'text-slate-500'}`}>Online</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className={`p-2 rounded-lg transition-colors ${themeMode === 'dark' ? 'hover:bg-[#ffffff08]' : 'hover:bg-indigo-50'}`}
              >
                <LogOut className={`w-5 h-5 ${themeMode === 'dark' ? 'text-[#6b6b7b]' : 'text-slate-500'}`} />
              </button>
            </div>

            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${themeMode === 'dark' ? 'text-[#6b6b7b]' : 'text-slate-400'}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users..."
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm transition-all focus:outline-none ${
                  themeMode === 'dark'
                    ? 'bg-[#1a1a24]/50 border border-[#ffffff08] text-white placeholder-[#6b6b7b] focus:border-indigo-500/50'
                    : 'bg-white/80 border border-indigo-100 text-slate-900 placeholder:text-slate-400 focus:border-indigo-300'
                }`}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {searchQuery ? (
              filteredUsers.length > 0 ? (
                filteredUsers.map((u) => (
                  <UserItem
                    key={u.id}
                    user={u}
                    isOnline={isUserOnline(u.id)}
                    presenceLabel={getPresenceLabel(u.id)}
                    onClick={() => handleSelectUser(u)}
                  />
                ))
              ) : (
                <div className={`p-4 text-center ${themeMode === 'dark' ? 'text-[#6b6b7b]' : 'text-slate-500'}`}>No users found</div>
              )
            ) : conversations.length > 0 ? (
              conversations.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isOnline={isUserOnline(conv.other_user_id)}
                  presenceLabel={getPresenceLabel(conv.other_user_id)}
                  onClick={() =>
                    handleSelectUser({
                      id: conv.other_user_id,
                      username: conv.other_username,
                      avatar: conv.other_avatar,
                    })
                  }
                />
              ))
            ) : (
              <div className={`p-4 text-center ${themeMode === 'dark' ? 'text-[#6b6b7b]' : 'text-slate-500'}`}>
                <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No conversations yet</p>
                <p className={`text-xs mt-1 ${themeMode === 'dark' ? 'text-[#6b6b7b]' : 'text-slate-500'}`}>Start chatting with someone!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative z-10">
        {currentConversation ? (
          <>
            <StickyUserBar
              userPreview={getUserPreview(currentConversation.id, currentConversation.username, currentConversation.avatar)}
              isOnline={currentConversationOnline}
              theme={themeMode}
              onToggleTheme={toggleThemeMode}
              onStartCall={(type) => startCall(type)}
              onStartVideo={(type) => startCall(type)}
              onSendMedia={() => fileInputRef.current?.click()}
              onOpenHistory={() => setShowCallHistory(true)}
            />

            <div className={`flex-1 overflow-y-auto p-5 space-y-4 ${themeMode === 'dark' ? '' : 'bg-white/72 rounded-t-[34px] shadow-[0_-1px_0_rgba(255,255,255,0.5)]'}`}>
              {/* sticky nav rendered above; remove duplicate */}

              {messages.map((msg) => (
                <MessageBubble
                  key={msg.client_message_id || msg.id}
                  message={msg}
                  isOwn={msg.sender_id === user?.id}
                  onRetry={() => {
                    if (msg.client_message_id) {
                      sendPendingMessage(msg.client_message_id, true);
                    }
                  }}
                />
              ))}
              {isTyping && (
                <div className="flex items-center gap-2">
                  <div className={`rounded-full px-4 py-3 flex gap-1 ${themeMode === 'dark' ? 'bg-[#1a1a24]/50' : 'bg-indigo-50'}`}>
                    <span className={`w-2 h-2 rounded-full animate-bounce [animation-duration:1.1s] [animation-delay:-0.32s] ${themeMode === 'dark' ? 'bg-[#6b6b7b]' : 'bg-indigo-300'}`}></span>
                    <span className={`w-2 h-2 rounded-full animate-bounce [animation-duration:1.1s] [animation-delay:-0.16s] ${themeMode === 'dark' ? 'bg-[#6b6b7b]' : 'bg-indigo-300'}`}></span>
                    <span className={`w-2 h-2 rounded-full animate-bounce [animation-duration:1.1s] ${themeMode === 'dark' ? 'bg-[#6b6b7b]' : 'bg-indigo-300'}`}></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={handleSendMessage}
              className={`p-4 border-t backdrop-blur-xl ${themeMode === 'dark' ? 'border-[#ffffff08] bg-[#12121a]/50' : 'border-indigo-100 bg-white/82'}`}
            >
              <div className={`relative flex items-center gap-2 rounded-[28px] px-3 py-2 ${themeMode === 'dark' ? 'bg-[#111827]/70 border border-white/10 shadow-[0_18px_45px_rgba(3,7,18,0.35)]' : 'bg-[#5f78f0] shadow-[0_18px_40px_rgba(95,120,240,0.22)]'}`}>
                  <input ref={fileInputRef} type="file" accept="image/*,audio/*" onChange={(e)=>handleFileSelected(e)} className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-2.5 rounded-2xl transition-colors ${themeMode === 'dark' ? 'hover:bg-[#ffffff08]' : 'bg-white/15 hover:bg-white/20'}`}
                  >
                    <Image className={`w-5 h-5 ${themeMode === 'dark' ? 'text-[#6b6b7b]' : 'text-white'}`} />
                  </button>
                  <VoiceRecorderButton onRecorded={sendFileMessage} theme={themeMode} />
                <input
                  type="text"
                  value={messageText}
                  onChange={handleTyping}
                  placeholder="Type a message..."
                  className={`flex-1 py-3 bg-transparent focus:outline-none ${themeMode === 'dark' ? 'text-white placeholder-[#6b6b7b]' : 'text-white placeholder:text-white/70'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker((prev) => !prev)}
                  className={`p-2.5 rounded-xl transition-colors ${
                    showEmojiPicker
                      ? themeMode === 'dark'
                        ? 'bg-[#ffffff12]'
                        : 'bg-white/20'
                      : themeMode === 'dark'
                        ? 'hover:bg-[#ffffff08]'
                        : 'hover:bg-white/15'
                  }`}
                >
                  <Smile className={`w-5 h-5 ${themeMode === 'dark' ? 'text-[#6b6b7b]' : 'text-white'}`} />
                </button>
                <button
                  type="submit"
                  disabled={!messageText.trim()}
                  className={`p-3 rounded-[22px] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all ${themeMode === 'dark' ? 'bg-gradient-to-r from-indigo-500 to-violet-500 hover:shadow-[0_0_20px_rgba(139,92,246,0.3)]' : 'bg-white text-[#5f78f0] shadow-[0_10px_24px_rgba(255,255,255,0.22)]'}`}
                >
                  <Send className="w-5 h-5" />
                </button>

                {showEmojiPicker && (
                  <div className="absolute bottom-[58px] right-2 z-20 rounded-xl overflow-hidden border border-[#ffffff12] shadow-xl">
                    <EmojiPicker
                      onEmojiClick={(emojiData) => setMessageText((prev) => `${prev}${emojiData.emoji}`)}
                      theme="dark"
                      width={300}
                      height={360}
                      previewConfig={{ showPreview: false }}
                      skinTonesDisabled
                    />
                  </div>
                )}
              </div>
            </form>
            <CallPanel
              callSession={callSession}
              callDuration={formatCallDuration(callDurationSeconds)}
              onAccept={acceptIncomingCall}
              onReject={rejectIncomingCall}
              onEnd={endCurrentCall}
              localStream={localStreamRef.current}
              remoteStream={remoteStreamRef.current}
              muted={muted}
              toggleMute={toggleMute}
              videoEnabled={videoEnabled}
              toggleVideo={toggleVideo}
            />
            <CallHistory visible={showCallHistory} logs={callLogs} onClose={() => setShowCallHistory(false)} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="relative inline-flex mb-6">
                <div className={`absolute inset-0 rounded-full blur-2xl opacity-30 ${themeMode === 'dark' ? 'bg-gradient-to-r from-indigo-500 to-violet-500' : 'bg-gradient-to-r from-indigo-300 to-sky-300'}`}></div>
                <div className={`relative w-24 h-24 rounded-full flex items-center justify-center ${themeMode === 'dark' ? 'bg-[#1a1a24]/50 border border-[#ffffff08]' : 'bg-white/70 border border-indigo-100'}`}>
                  <MessageCircle className={`w-10 h-10 ${themeMode === 'dark' ? 'text-[#6b6b7b]' : 'text-indigo-300'}`} />
                </div>
              </div>
              <h2 className={`text-2xl font-bold mb-2 ${themeMode === 'dark' ? 'text-white' : 'text-slate-900'}`}>Welcome to ChatApp</h2>
              <p className={themeMode === 'dark' ? 'text-[#6b6b7b]' : 'text-slate-500'}>Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function UserItem({ user, isOnline, presenceLabel, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#ffffff08] transition-colors"
    >
      <div className="relative">
        <img
          src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
          alt={user.username}
          className="w-12 h-12 rounded-full border-2 border-[#ffffff08]"
        />
        <span
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#12121a] ${
            isOnline ? 'bg-green-500' : 'bg-[#5f6475]'
          }`}
        ></span>
      </div>
      <div className="flex-1 text-left">
        <h3 className="text-white font-medium">{user.username}</h3>
        <p className="text-[#6b6b7b] text-sm truncate">{presenceLabel}</p>
      </div>
    </button>
  );
}

function ConversationItem({ conversation, isOnline, presenceLabel, onClick }) {
  const isUnread = !conversation.is_read && conversation.sender_id !== conversation.receiver_id;

  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#ffffff08] transition-colors"
    >
      <div className="relative">
        <img
          src={
            conversation.other_avatar ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${conversation.other_username}`
          }
          alt={conversation.other_username}
          className="w-12 h-12 rounded-full border-2 border-[#ffffff08]"
        />
        <span
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#12121a] ${
            isOnline ? 'bg-green-500' : 'bg-[#5f6475]'
          }`}
        ></span>
      </div>
      <div className="flex-1 text-left">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-medium">{conversation.other_username}</h3>
          <span className="text-[#6b6b7b] text-xs">{formatClockTime(conversation.created_at)}</span>
        </div>
        <p className="text-[#6b6b7b] text-sm truncate">{conversation.content || presenceLabel}</p>
      </div>
      {isUnread && <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>}
    </button>
  );
}

function MessageBubble({ message, isOwn, onRetry }) {
  const [reaction, setReaction] = useState(message.reaction || null);
  const [showReactions, setShowReactions] = useState(false);

  const availableReactions = ['❤️', '👍', '😂', '😮', '😢'];

  const toggleReaction = (r) => {
    const next = reaction === r ? null : r;
    setReaction(next);
    // Ideally persist reaction to backend here
  };

  const shareToPlatform = (platform) => {
    // External sharing removed per design, keep reactions only
  };

  // Forwarding removed; reactions remain local-only for now
  const status = getDeliveryStatus(message);
  const statusTimeSource =
    isOwn && status === 'seen'
      ? message.seen_at || message.delivered_at || message.created_at
      : isOwn && status === 'delivered'
        ? message.delivered_at || message.created_at
        : message.created_at;
  const messageTime = formatClockTime(statusTimeSource);

  const StatusIcon = () => {
    if (!isOwn) return null;

    if (status === 'sending') {
      return <Clock3 className="w-3.5 h-3.5 text-white/65 animate-pulse" />;
    }

    if (status === 'sent') {
      return <Check className="w-3.5 h-3.5 text-white/70" />;
    }

    if (status === 'delivered') {
      return <CheckCheck className="w-3.5 h-3.5 text-white/70" />;
    }

    if (status === 'seen') {
      return <CheckCheck className="w-3.5 h-3.5 text-sky-300" />;
    }

    if (status === 'failed') {
      return (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 rounded px-1 py-0.5 bg-red-500/20 text-red-200 hover:bg-red-500/30"
          title="Retry"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      );
    }

    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22 }}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[72%] px-4 py-3 rounded-2xl ${
          isOwn
            ? 'bg-gradient-to-r from-cyan-500 via-sky-500 to-fuchsia-500 text-white shadow-[0_12px_30px_rgba(56,189,248,0.22)]'
            : 'bg-[#111827]/75 text-white border border-white/10'
        }`}
      >
        {message.message_type === 'image' ? (
          <img src={message.content} alt="image" className="max-w-full rounded-lg" />
        ) : message.message_type === 'voice' || message.message_type === 'audio' ? (
          <VoiceMessageBubble src={message.content} isOwn={isOwn} />
        ) : (
          <p className="text-sm">{message.content}</p>
        )}
        <div className={`text-xs ${isOwn ? 'text-white/70' : 'text-[#6b6b7b]'} mt-1 flex items-center gap-1`}>
          <span>{messageTime}</span>
          <StatusIcon />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowReactions((s) => !s)}
            className="text-xs text-[#9aa1b7] hover:text-white px-2 py-1 rounded"
          >
            Reactions
          </button>
        </div>

        {showReactions && (
          <div className="mt-2 flex items-center gap-2">
            {availableReactions.map((r) => (
              <button
                key={r}
                onClick={() => toggleReaction(r)}
                className={`px-2 py-1 rounded ${reaction === r ? 'bg-white/10' : 'hover:bg-white/5'}`}
              >
                <span className="text-lg">{r}</span>
              </button>
            ))}
          </div>
        )}

        {reaction && (
          <div className="mt-1 text-xs text-[#9aa1b7]">You reacted: {reaction}</div>
        )}
      </div>
    </motion.div>
  );
}

function VoiceMessageBubble({ src, isOwn }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const handleLoadedMetadata = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch (error) {
      console.error('Voice playback failed:', error);
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bars = Array.from({ length: 28 }, (_, index) => 10 + ((index * 7) % 20));
  const formatAudioTime = (value) => {
    const safe = Math.max(0, Math.floor(value || 0));
    const mins = String(Math.floor(safe / 60)).padStart(2, '0');
    const secs = String(safe % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <div className={`min-w-[220px] ${isOwn ? 'text-white' : 'text-slate-700'}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlayback}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
            isOwn ? 'bg-white/22 text-white' : 'bg-[#7f96f4] text-white'
          }`}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>
        <div className="flex-1">
          <div className="relative flex h-10 items-center gap-[3px] overflow-hidden rounded-full px-1">
            {bars.map((barHeight, index) => (
              <span
                key={`${src}-${index}`}
                className={`w-1 rounded-full ${isOwn ? 'bg-white/75' : 'bg-[#8ea2ff]'}`}
                style={{
                  height: `${barHeight}px`,
                  opacity: index / bars.length <= progressPercent / 100 ? 1 : 0.35,
                }}
              />
            ))}
            <div
              className={`absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ${
                isOwn ? 'bg-white' : 'bg-[#6d83f4]'
              }`}
              style={{ left: `calc(${progressPercent}% - 5px)` }}
            ></div>
          </div>
          <div className={`mt-1 flex items-center justify-between text-[11px] ${isOwn ? 'text-white/75' : 'text-slate-500'}`}>
            <span>Voice message</span>
            <span>{formatAudioTime(isPlaying ? currentTime : duration || currentTime)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
