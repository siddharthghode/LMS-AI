import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Bell, CheckCircle2, Clock, Check } from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export const NotificationsView: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadNotifications = () => {
    setIsLoading(true);
    api.get('/notifications/me')
      .then(res => setNotifications(res.data.notifications || []))
      .catch(err => console.error('Failed to load notifications:', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Mark all read error:', err);
    }
  };

  const handleMarkSingleRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, is_read: true } : n)));
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-400" />
            Notifications
          </h1>
          <p className="text-xs text-slate-400">
            Course announcements, assessment evaluations, and learning streaks
          </p>
        </div>

        <button
          onClick={handleMarkAllRead}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
        >
          <Check className="w-3.5 h-3.5" /> Mark All as Read
        </button>
      </div>

      {notifications.length === 0 && !isLoading ? (
        <div className="p-16 text-center rounded-3xl bg-slate-800/20 border border-slate-800">
          <Bell className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white mb-1">No notifications yet</h3>
          <p className="text-xs text-slate-400">You're all caught up with your courses and assignments!</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {notifications.map(n => (
            <div
              key={n.id}
              onClick={() => !n.is_read && handleMarkSingleRead(n.id)}
              className={`p-4 rounded-2xl border text-xs transition-all flex items-start justify-between gap-3 ${
                n.is_read
                  ? 'bg-slate-800/30 border-slate-800/60 text-slate-400'
                  : 'bg-slate-800/80 border-indigo-500/30 text-slate-200 shadow-md cursor-pointer hover:border-indigo-500/60'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-white text-xs">{n.title}</h4>
                  {!n.is_read && (
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  )}
                </div>
                <p className="text-slate-300 leading-relaxed">{n.body}</p>
                <div className="text-[10px] text-slate-500 flex items-center gap-1 pt-1">
                  <Clock className="w-2.5 h-2.5" />
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </div>

              {!n.is_read && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkSingleRead(n.id);
                  }}
                  className="text-indigo-400 hover:text-indigo-300 p-1 text-[11px] font-semibold"
                >
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
