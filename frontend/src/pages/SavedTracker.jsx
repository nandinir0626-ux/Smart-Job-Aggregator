import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import {
  Bookmark,
  ExternalLink,
  Trash2,
  Edit3,
  Check,
  Building,
  MapPin,
  Loader2,
  Briefcase,
  Calendar,
  Clock,
  AlertCircle
} from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'saved', label: 'Saved', color: 'bg-slate-100 text-slate-700' },
  { value: 'applied', label: 'Applied', color: 'bg-sky-50 text-sky-700 border border-sky-200' },
  { value: 'interview', label: 'Interview', color: 'bg-amber-50 text-amber-700 border border-amber-200' },
  { value: 'rejected', label: 'Rejected', color: 'bg-rose-50 text-rose-700 border border-rose-200' },
];

export default function SavedTracker() {
  const [savedJobs, setSavedJobs] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [editingNotesId, setEditingNotesId] = useState(null);
  const [notesText, setNotesText] = useState('');

  const fetchSavedJobs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/saved');
      setSavedJobs(res.data.savedJobs || []);
    } catch (err) {
      console.error('Error fetching saved jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSavedJobs();
  }, []);

  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.patch(`/saved/${id}`, { status: newStatus });
      setSavedJobs((prev) =>
        prev.map((item) => (item._id === id ? { ...item, status: newStatus } : item))
      );
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleDateChange = async (id, field, value) => {
    try {
      await api.patch(`/saved/${id}`, { [field]: value || null });
      setSavedJobs((prev) =>
        prev.map((item) => (item._id === id ? { ...item, [field]: value || null } : item))
      );
    } catch (err) {
      console.error(`Failed to update ${field}:`, err);
    }
  };

  const handleSaveNotes = async (id) => {
    try {
      await api.patch(`/saved/${id}`, { notes: notesText });
      setSavedJobs((prev) =>
        prev.map((item) => (item._id === id ? { ...item, notes: notesText } : item))
      );
      setEditingNotesId(null);
    } catch (err) {
      console.error('Failed to update notes:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/saved/${id}`);
      setSavedJobs((prev) => prev.filter((item) => item._id !== id));
    } catch (err) {
      console.error('Failed to delete saved job:', err);
    }
  };

  const filteredJobs = filterStatus === 'all'
    ? savedJobs
    : savedJobs.filter((item) => item.status === filterStatus);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Application Pipeline & CRM</h1>
        <p className="text-xs text-slate-500 mt-1">
          Track roles you've bookmarked, schedule interview dates, monitor deadlines, and log recruiter notes.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 text-xs">
        {['all', 'saved', 'applied', 'interview', 'rejected'].map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`px-3.5 py-1.5 rounded-xl font-semibold capitalize transition ${
              filterStatus === st
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {st} ({st === 'all' ? savedJobs.length : savedJobs.filter((i) => i.status === st).length})
          </button>
        ))}
      </div>

      {/* Pipeline List */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-600 mb-2" />
          <p className="text-xs font-medium text-slate-600">Loading saved pipeline...</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 space-y-3">
          <Bookmark className="h-10 w-10 mx-auto text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">No Applications in this Stage</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Browse jobs and click the bookmark icon to organize roles in your pipeline.
          </p>
          <Link
            to="/jobs"
            className="inline-block mt-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs shadow-sm"
          >
            Explore Jobs
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((item) => {
            const job = item.jobId || {};
            const isEditingNotes = editingNotesId === item._id;

            return (
              <div
                key={item._id}
                className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm hover:border-slate-300 transition flex flex-col sm:flex-row sm:items-start justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link
                        to={`/jobs/${job._id || ''}`}
                        className="text-base font-bold text-slate-900 hover:text-emerald-600 transition"
                      >
                        {job.title || 'Role Title Unavailable'}
                      </Link>
                      <p className="text-xs font-semibold text-emerald-600 mt-0.5">
                        {job.company || 'Company'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                    <span className="inline-flex items-center space-x-1">
                      <MapPin className="h-3 w-3 text-slate-400" />
                      <span>{job.location || 'Location unspecified'}</span>
                    </span>
                    {job.remote && (
                      <span className="text-sky-700 bg-sky-50 px-2 py-0.5 rounded text-[11px] font-medium">
                        Remote
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400">
                      Saved {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Deadline & Interview Date Pickers */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100 text-xs">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span className="text-slate-500 font-medium">Deadline:</span>
                      <input
                        type="date"
                        value={item.deadlineDate ? item.deadlineDate.substring(0, 10) : ''}
                        onChange={(e) => handleDateChange(item._id, 'deadlineDate', e.target.value)}
                        className="px-2 py-1 rounded-md border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Calendar className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="text-slate-500 font-medium">Interview:</span>
                      <input
                        type="date"
                        value={item.interviewDate ? item.interviewDate.substring(0, 10) : ''}
                        onChange={(e) => handleDateChange(item._id, 'interviewDate', e.target.value)}
                        className="px-2 py-1 rounded-md border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Notes Section */}
                  <div className="mt-3">
                    {isEditingNotes ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={notesText}
                          onChange={(e) => setNotesText(e.target.value)}
                          placeholder="Interview rounds, recruiter contacts, salary details..."
                          className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          onClick={() => handleSaveNotes(item._id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingNotesId(null)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 text-xs text-slate-600">
                        <span className="italic">
                          {item.notes ? `Note: "${item.notes}"` : 'No notes added'}
                        </span>
                        <button
                          onClick={() => {
                            setEditingNotesId(item._id);
                            setNotesText(item.notes || '');
                          }}
                          className="text-slate-400 hover:text-slate-600 p-1"
                          title="Edit note"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Actions: Status Dropdown & Delete */}
                <div className="flex items-center space-x-3 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <select
                    value={item.status}
                    onChange={(e) => handleStatusChange(item._id, e.target.value)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  {job.url && (
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-emerald-600 hover:bg-slate-50 transition"
                      title="Open job posting"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}

                  <button
                    onClick={() => handleDelete(item._id)}
                    className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                    title="Remove from saved"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
