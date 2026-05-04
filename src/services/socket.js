import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';

let socket = null;

const toNumber = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
};

const shouldAppendToOpenConversation = (message) => {
  const { currentConversation } = useChatStore.getState();
  const { user } = useAuthStore.getState();

  if (!currentConversation || !user) return false;

  const currentConversationId = toNumber(currentConversation.id);
  const senderId = toNumber(message.sender_id);
  const receiverId = toNumber(message.receiver_id);
  const currentUserId = toNumber(user.id);

  if (!currentConversationId || !senderId || !receiverId || !currentUserId) return false;

  return (
    (senderId === currentConversationId && receiverId === currentUserId) ||
    (senderId === currentUserId && receiverId === currentConversationId)
  );
};

const syncConversationsFromMessage = (message) => {
  const { user } = useAuthStore.getState();
  if (!user || !message) return;

  useChatStore.getState().upsertConversationFromMessage(message, user.id);
};

const handleIncomingMessage = (message) => {
  const store = useChatStore.getState();

  if (shouldAppendToOpenConversation(message)) {
    store.addOrUpdateMessage(message);
  }

  if (message?.client_message_id) {
    store.completePendingMessage(message.client_message_id);
  }

  syncConversationsFromMessage(message);
};

export const initializeSocket = () => {
  const { user } = useAuthStore.getState();

  if (!socket) {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    socket = io(socketUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        socket.emit('authenticate', currentUser.id);
      }
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error?.message || error);
    });

    socket.on('disconnect', (reason) => {
      console.warn('Socket disconnected:', reason);
    });

    socket.on('userOnline', ({ userId }) => {
      useChatStore.getState().addOnlineUser(userId);
    });

    socket.on('onlineUsers', ({ userIds }) => {
      useChatStore.getState().setOnlineUsers(userIds || []);
    });

    socket.on('userOffline', ({ userId, lastSeenAt }) => {
      useChatStore.getState().removeOnlineUser(userId, lastSeenAt);
    });

    socket.on('newMessage', handleIncomingMessage);
    socket.on('messageSent', handleIncomingMessage);

    socket.on('messagesDelivered', ({ messageIds, deliveredAt }) => {
      useChatStore
        .getState()
        .updateMessagesDeliveryStatus(messageIds, 'delivered', { delivered_at: deliveredAt });
    });

    socket.on('messagesSeen', ({ messageIds, seenAt }) => {
      useChatStore.getState().updateMessagesDeliveryStatus(messageIds, 'seen', {
        seen_at: seenAt,
        is_read: true,
      });
    });

    socket.on('messageError', (error) => {
      console.error('Message delivery error:', error?.message || error);
    });

    socket.on('userTyping', ({ senderId }) => {
      useChatStore.getState().addTypingUser(senderId);
    });

    socket.on('userStopTyping', ({ senderId }) => {
      useChatStore.getState().removeTypingUser(senderId);
    });

    socket.connect();
  } else if (socket && user) {
    socket.emit('authenticate', user.id);
  }

  return socket;
};

export const getSocket = () => socket;

export const isSocketConnected = () => Boolean(socket?.connected);

export const onSocketEvent = (eventName, handler) => {
  if (socket) {
    socket.on(eventName, handler);
  }
};

export const offSocketEvent = (eventName, handler) => {
  if (socket) {
    socket.off(eventName, handler);
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const sendTyping = (receiverId) => {
  const { user } = useAuthStore.getState();
  if (socket && user) {
    socket.emit('typing', { receiverId, senderId: user.id });
  }
};

export const stopTyping = (receiverId) => {
  const { user } = useAuthStore.getState();
  if (socket && user) {
    socket.emit('stopTyping', { receiverId, senderId: user.id });
  }
};

export const markAsRead = (senderId) => {
  const { user } = useAuthStore.getState();
  if (socket && user) {
    socket.emit('markRead', { senderId, receiverId: user.id });
  }
};

export const emitCallOffer = ({ toUserId, callType, offer, fromUsername, fromAvatar }) => {
  const { user } = useAuthStore.getState();
  if (socket && user) {
    socket.emit('call:offer', {
      fromUserId: user.id,
      toUserId,
      callType,
      offer,
      fromUsername,
      fromAvatar,
    });
  }
};

export const emitCallAnswer = ({ toUserId, callType, answer }) => {
  const { user } = useAuthStore.getState();
  if (socket && user) {
    socket.emit('call:answer', {
      fromUserId: user.id,
      toUserId,
      callType,
      answer,
    });
  }
};

export const emitCallIceCandidate = ({ toUserId, candidate }) => {
  const { user } = useAuthStore.getState();
  if (socket && user) {
    socket.emit('call:ice-candidate', {
      fromUserId: user.id,
      toUserId,
      candidate,
    });
  }
};

export const emitCallReject = ({ toUserId, reason = 'declined' }) => {
  const { user } = useAuthStore.getState();
  if (socket && user) {
    socket.emit('call:reject', {
      fromUserId: user.id,
      toUserId,
      reason,
    });
  }
};

export const emitCallEnd = ({ toUserId }) => {
  const { user } = useAuthStore.getState();
  if (socket && user) {
    socket.emit('call:end', {
      fromUserId: user.id,
      toUserId,
    });
  }
};
