import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import api from '../services/api';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [liveToast, setLiveToast] = useState(null);
  const [resumeUpdate, setResumeUpdate] = useState(null);

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (err) {
      console.warn('Could not fetch notifications:', err.message);
    }
  };

  useEffect(() => {
    if (!token || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    fetchNotifications();

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('[Socket.IO] Connected to live notification gateway');
      if (user.id || user._id) {
        newSocket.emit('join_user_room', user.id || user._id);
      }
    });

    newSocket.on('notification', (notif) => {
      console.log('[Socket.IO] Real-time notification received:', notif);
      setNotifications((prev) => {
        const id = notif.notificationId || notif._id;
        const filtered = prev.filter((n) => (n._id || n.notificationId) !== id);
        return [{ ...notif, _id: id, read: false }, ...filtered];
      });
      setUnreadCount((count) => count + 1);

      // Trigger floating live toast
      setLiveToast({
        id: notif.notificationId || Date.now(),
        title: notif.jobTitle || 'New Job Match!',
        company: notif.company || '',
        score: notif.score ? Math.round(notif.score * 100) : 85,
        matchedSkills: notif.matchedSkills || [],
      });

      // Auto dismiss toast after 6 seconds
      setTimeout(() => {
        setLiveToast((current) => (current?.id === notif.notificationId ? null : current));
      }, 6000);
    });

    newSocket.on('resume_status', (update) => {
      console.log('[Socket.IO] Resume processing status update:', update);
      setResumeUpdate(update);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token, user]);

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id || n.notificationId === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        notifications,
        unreadCount,
        liveToast,
        setLiveToast,
        resumeUpdate,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
