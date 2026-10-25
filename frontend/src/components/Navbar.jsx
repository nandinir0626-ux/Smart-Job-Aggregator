import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  Briefcase,
  Bell,
  User,
  LogOut,
  Bookmark,
  Search,
  Sparkles,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useSocket();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo & Main Nav */}
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm shadow-emerald-200">
                <Sparkles className="h-5 w-5" />
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-900">
                Smart<span className="text-emerald-600">Jobs</span>
              </span>
            </Link>

            {isAuthenticated && (
              <div className="hidden md:flex items-center space-x-1">
                <Link
                  to="/"
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    isActive('/')
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Recommendations
                </Link>
                <Link
                  to="/jobs"
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    isActive('/jobs')
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Search Jobs
                </Link>
                <Link
                  to="/saved"
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    isActive('/saved')
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Saved Tracker
                </Link>
              </div>
            )}
          </div>

          {/* Right actions: Notifications & User profile */}
          <div className="flex items-center space-x-3" ref={dropdownRef}>
            {isAuthenticated ? (
              <>
                {/* Notification Bell Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setDropdownOpen(!dropdownOpen);
                      setProfileOpen(false);
                    }}
                    className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition relative focus:outline-none"
                    aria-label="Notifications"
                  >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-slate-900 text-sm">Notifications</span>
                          {unreadCount > 0 && (
                            <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-full font-medium">
                              {unreadCount} new
                            </span>
                          )}
                        </div>
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllAsRead}
                            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>

                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                        {notifications.length === 0 ? (
                          <div className="py-8 text-center text-slate-400 text-xs">
                            No notifications yet. New matching jobs will appear here live!
                          </div>
                        ) : (
                          notifications.slice(0, 10).map((n) => {
                            const notifId = n._id || n.notificationId;
                            const job = n.jobId || {};
                            const title = n.jobTitle || job.title || 'Matching Job';
                            const company = n.company || job.company || '';
                            const score = Math.round((n.score || 0.8) * 100);
                            return (
                              <div
                                key={notifId || Math.random()}
                                onClick={() => {
                                  if (!n.read) markAsRead(notifId);
                                  if (job._id || n.jobId) {
                                    navigate(`/jobs/${job._id || n.jobId}`);
                                    setDropdownOpen(false);
                                  }
                                }}
                                className={`p-3.5 hover:bg-slate-50 transition cursor-pointer flex items-start space-x-3 ${
                                  !n.read ? 'bg-emerald-50/40' : ''
                                }`}
                              >
                                <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                                  {score}%
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-slate-900 truncate">{title}</p>
                                  <p className="text-xs text-slate-500 truncate">{company}</p>
                                  {n.explanation && (
                                    <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                                      {n.explanation}
                                    </p>
                                  )}
                                </div>
                                {!n.read && (
                                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* User avatar menu */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setProfileOpen(!profileOpen);
                      setDropdownOpen(false);
                    }}
                    className="flex items-center space-x-2 p-1.5 rounded-xl hover:bg-slate-100 transition"
                  >
                    <div className="h-8 w-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                      {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <span className="hidden sm:inline-block text-xs font-medium text-slate-700 max-w-[120px] truncate">
                      {user.name}
                    </span>
                  </button>

                  {profileOpen && (
                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-4 py-2 border-b border-slate-100">
                        <p className="text-xs font-bold text-slate-900 truncate">{user.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                      </div>
                      <Link
                        to="/profile"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center space-x-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        <User className="h-4 w-4 text-slate-400" />
                        <span>Resume & Profile</span>
                      </Link>
                      <Link
                        to="/saved"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center space-x-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        <Bookmark className="h-4 w-4 text-slate-400" />
                        <span>Saved Applications</span>
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left flex items-center space-x-2 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 border-t border-slate-100 mt-1"
                      >
                        <LogOut className="h-4 w-4 text-rose-500" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}
