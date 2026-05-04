import { create } from 'zustand';

const toNumber = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
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

const toTime = (value) => new Date(normalizeTimestamp(value) || 0).getTime();

const sortConversationsByFreshness = (conversations = []) =>
  [...conversations].sort((a, b) => toTime(b.created_at) - toTime(a.created_at));

const sortMessagesChronologically = (messages = []) =>
  [...messages].sort((a, b) => {
    const timeDiff = toTime(a.created_at) - toTime(b.created_at);
    if (timeDiff !== 0) return timeDiff;
    return String(a.id).localeCompare(String(b.id));
  });

const normalizeDeliveryStatus = (message = {}) => {
  if (message.delivery_status) return message.delivery_status;
  if (message.seen_at || message.is_read === 1 || message.is_read === true) return 'seen';
  if (message.delivered_at) return 'delivered';
  return 'sent';
};

const isSameMessage = (a, b) => {
  if (!a || !b) return false;
  if (a.id != null && b.id != null && String(a.id) === String(b.id)) return true;
  if (a.client_message_id && b.client_message_id && a.client_message_id === b.client_message_id) return true;
  return false;
};

export const useChatStore = create((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  onlineUsers: [],
  lastSeenByUser: {},
  serverTimeOffsetMs: 0,
  typingUsers: {},
  isLoading: false,
  unreadCount: 0,
  pendingMessages: {},

  setConversations: (conversations) =>
    set({ conversations: sortConversationsByFreshness(conversations || []) }),

  setCurrentConversation: (conversation) => set({ currentConversation: conversation }),

  setMessages: (messages) =>
    set({
      messages: sortMessagesChronologically(
        (messages || []).map((message) => ({
          ...message,
          delivery_status: normalizeDeliveryStatus(message),
        }))
      ),
    }),

  addOrUpdateMessage: (message) =>
    set((state) => {
      if (!message) return state;

      const normalized = {
        ...message,
        delivery_status: normalizeDeliveryStatus(message),
      };

      const existingIndex = state.messages.findIndex((item) => isSameMessage(item, normalized));
      if (existingIndex === -1) {
        return { messages: sortMessagesChronologically([...state.messages, normalized]) };
      }

      const nextMessages = [...state.messages];
      nextMessages[existingIndex] = {
        ...nextMessages[existingIndex],
        ...normalized,
      };
      return { messages: sortMessagesChronologically(nextMessages) };
    }),

  setOnlineUsers: (users) =>
    set((state) => {
      const normalized = (users || [])
        .map((id) => toNumber(id))
        .filter((id) => id !== null);
      const lastSeenByUser = { ...state.lastSeenByUser };
      normalized.forEach((id) => {
        delete lastSeenByUser[id];
      });
      return {
        onlineUsers: Array.from(new Set(normalized)),
        lastSeenByUser,
      };
    }),

  setServerTimeOffsetMs: (offsetMs) =>
    set({
      serverTimeOffsetMs: Number.isFinite(offsetMs) ? offsetMs : 0,
    }),

  addOnlineUser: (userId) =>
    set((state) => {
      const normalizedId = toNumber(userId);
      if (!normalizedId) return state;
      if (state.onlineUsers.includes(normalizedId)) {
        return state;
      }
      const nextLastSeen = { ...state.lastSeenByUser };
      delete nextLastSeen[normalizedId];
      return {
        onlineUsers: [...state.onlineUsers, normalizedId],
        lastSeenByUser: nextLastSeen,
      };
    }),

  removeOnlineUser: (userId, lastSeenAt = null) =>
    set((state) => {
      const normalizedId = toNumber(userId);
      if (!normalizedId) return state;
      return {
        onlineUsers: state.onlineUsers.filter((id) => id !== normalizedId),
        lastSeenByUser: {
          ...state.lastSeenByUser,
          [normalizedId]:
            lastSeenAt || new Date(Date.now() + (state.serverTimeOffsetMs || 0)).toISOString(),
        },
      };
    }),

  addTypingUser: (userId) =>
    set((state) => ({
      typingUsers: { ...state.typingUsers, [userId]: true },
    })),

  removeTypingUser: (userId) =>
    set((state) => {
      const { [userId]: _, ...rest } = state.typingUsers;
      return { typingUsers: rest };
    }),

  setLoading: (isLoading) => set({ isLoading }),

  setUnreadCount: (count) => set({ unreadCount: count }),

  upsertConversationFromMessage: (message, currentUserId) =>
    set((state) => {
      if (!message || !currentUserId) {
        return state;
      }

      const senderId = toNumber(message.sender_id);
      const receiverId = toNumber(message.receiver_id);
      const loggedInUserId = toNumber(currentUserId);
      if (!senderId || !receiverId || !loggedInUserId) {
        return state;
      }

      const otherUserId = senderId === loggedInUserId ? receiverId : senderId;
      const existingIndex = state.conversations.findIndex(
        (conversation) => toNumber(conversation.other_user_id) === otherUserId
      );

      const baseConversation = {
        ...message,
        delivery_status: normalizeDeliveryStatus(message),
        other_user_id: otherUserId,
        other_username:
          senderId === loggedInUserId
            ? message.receiver_username || 'User'
            : message.sender_username || 'User',
        other_avatar:
          senderId === loggedInUserId ? message.receiver_avatar || null : message.sender_avatar || null,
        created_at: message.created_at || new Date().toISOString(),
      };

      if (existingIndex === -1) {
        return {
          conversations: sortConversationsByFreshness([baseConversation, ...state.conversations]),
        };
      }

      const existing = state.conversations[existingIndex];
      const updated = {
        ...existing,
        ...baseConversation,
      };

      const withoutExisting = state.conversations.filter((_, index) => index !== existingIndex);
      return {
        conversations: sortConversationsByFreshness([updated, ...withoutExisting]),
      };
    }),

  updateMessageDeliveryStatus: (messageId, status, extra = {}) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        String(message.id) === String(messageId)
          ? {
              ...message,
              delivery_status: status,
              ...extra,
            }
          : message
      ),
    })),

  updateMessagesDeliveryStatus: (messageIds, status, extra = {}) => {
    const idSet = new Set((messageIds || []).map((id) => String(id)));
    set((state) => ({
      messages: state.messages.map((message) =>
        idSet.has(String(message.id))
          ? {
              ...message,
              delivery_status: status,
              ...extra,
            }
          : message
      ),
    }));
  },

  enqueuePendingMessage: (clientMessageId, payload) =>
    set((state) => ({
      pendingMessages: {
        ...state.pendingMessages,
        [clientMessageId]: {
          payload,
          attempts: 0,
          inFlight: false,
          status: 'queued',
          lastAttemptAt: null,
          lastError: null,
        },
      },
    })),

  beginPendingAttempt: (clientMessageId) =>
    set((state) => {
      const current = state.pendingMessages[clientMessageId];
      if (!current) return state;

      return {
        pendingMessages: {
          ...state.pendingMessages,
          [clientMessageId]: {
            ...current,
            inFlight: true,
            status: 'sending',
            attempts: (current.attempts || 0) + 1,
            lastAttemptAt: Date.now(),
          },
        },
      };
    }),

  failPendingMessage: (clientMessageId, errorMessage) =>
    set((state) => {
      const current = state.pendingMessages[clientMessageId];
      if (!current) return state;

      return {
        pendingMessages: {
          ...state.pendingMessages,
          [clientMessageId]: {
            ...current,
            inFlight: false,
            status: 'failed',
            lastError: errorMessage,
            lastAttemptAt: Date.now(),
          },
        },
        messages: state.messages.map((message) =>
          message.client_message_id === clientMessageId
            ? {
                ...message,
                delivery_status: 'failed',
                send_error: errorMessage,
              }
            : message
        ),
      };
    }),

  completePendingMessage: (clientMessageId) =>
    set((state) => {
      const { [clientMessageId]: _, ...rest } = state.pendingMessages;
      return { pendingMessages: rest };
    }),

  getPendingMessage: (clientMessageId) => get().pendingMessages[clientMessageId],

  clearCurrentConversation: () =>
    set({
      currentConversation: null,
      messages: [],
    }),
}));
