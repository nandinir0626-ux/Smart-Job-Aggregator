import React from 'react';
import { useSocket } from '../context/SocketContext';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LiveToast() {
  const { liveToast, setLiveToast } = useSocket();
  const navigate = useNavigate();

  if (!liveToast) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-slate-700/60 animate-in fade-in slide-in-from-bottom-5 duration-200">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
            Real-Time Job Match!
          </span>
        </div>
        <button
          onClick={() => setLiveToast(null)}
          className="text-slate-400 hover:text-white transition p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2">
        <p className="text-sm font-bold text-white line-clamp-1">{liveToast.title}</p>
        <p className="text-xs text-slate-300">{liveToast.company}</p>
        <div className="flex items-center space-x-2 mt-2">
          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs px-2 py-0.5 rounded-full font-bold">
            {liveToast.score}% Match
          </span>
          {liveToast.matchedSkills.length > 0 && (
            <span className="text-[11px] text-slate-300 truncate">
              {liveToast.matchedSkills.slice(0, 2).join(', ')}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-800 flex justify-end">
        <button
          onClick={() => {
            setLiveToast(null);
            navigate('/');
          }}
          className="inline-flex items-center space-x-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
        >
          <span>View in Recommendations</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
