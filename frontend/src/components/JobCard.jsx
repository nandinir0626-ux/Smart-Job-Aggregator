import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Globe,
  DollarSign,
  Bookmark,
  BookmarkCheck,
  Check,
  X,
  ExternalLink,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import api from '../services/api';

export default function JobCard({ job, matchData, isSavedInitial = false, onSaveToggle }) {
  const [saved, setSaved] = useState(isSavedInitial);
  const [saving, setSaving] = useState(false);

  const score = matchData?.score ?? matchData?.matchPercentage ? (matchData.score || matchData.matchPercentage / 100) : null;
  const matchPercentage = matchData?.matchPercentage ?? (score !== null ? Math.round(score * 100) : null);
  const matchedSkills = matchData?.matchedSkills || [];
  const missingSkills = matchData?.missingSkills || [];
  const explanation = matchData?.explanation || '';

  const handleSaveToggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (saving) return;
    setSaving(true);
    try {
      if (saved) {
        // If we have an existing saved record id, or call delete
        await api.post('/saved', { jobId: job._id, status: 'saved' });
        setSaved(false);
      } else {
        await api.post('/saved', { jobId: job._id, status: 'saved' });
        setSaved(true);
      }
      if (onSaveToggle) onSaveToggle(job._id, !saved);
    } catch (err) {
      console.error('Error toggling save status:', err);
    } finally {
      setSaving(false);
    }
  };

  const getScoreColor = (pct) => {
    if (pct >= 80) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (pct >= 60) return 'bg-teal-50 text-teal-700 border-teal-200';
    if (pct >= 40) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const formatSalary = (min, max) => {
    if (!min && !max) return null;
    const formatNum = (n) => (n >= 100000 ? `${(n / 1000).toFixed(0)}k` : `$${n.toLocaleString()}`);
    if (min && max) return `${formatNum(min)} - ${formatNum(max)}`;
    if (min) return `From ${formatNum(min)}`;
    return `Up to ${formatNum(max)}`;
  };

  const salaryDisplay = formatSalary(job.salaryMin, job.salaryMax);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition duration-200 flex flex-col justify-between group">
      <div>
        {/* Header: Title, Company, Match badge, Bookmark */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <Link
              to={`/jobs/${job._id}`}
              className="text-base font-bold text-slate-900 group-hover:text-emerald-600 transition truncate block"
            >
              {job.title}
            </Link>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">{job.company}</p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {matchPercentage !== null && (
              <span
                className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold border ${getScoreColor(
                  matchPercentage
                )}`}
              >
                <Sparkles className="h-3 w-3" />
                <span>{matchPercentage}% Match</span>
              </span>
            )}

            <button
              onClick={handleSaveToggle}
              disabled={saving}
              className={`p-1.5 rounded-lg border transition ${
                saved
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                  : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300'
              }`}
              title={saved ? 'Remove from saved' : 'Save job'}
            >
              {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Location, Remote, Salary */}
        <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-slate-500">
          <span className="inline-flex items-center space-x-1">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            <span>{job.location || 'Location Unspecified'}</span>
          </span>

          {job.remote && (
            <span className="inline-flex items-center space-x-1 bg-sky-50 text-sky-700 px-2 py-0.5 rounded-md font-medium">
              <Globe className="h-3 w-3" />
              <span>Remote</span>
            </span>
          )}

          {job.salaryNormalized?.display ? (
            <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 rounded-md font-bold">
              <DollarSign className="h-3 w-3 text-emerald-600" />
              <span>{job.salaryNormalized.display}</span>
            </span>
          ) : salaryDisplay ? (
            <span className="inline-flex items-center space-x-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
              <DollarSign className="h-3 w-3 text-slate-400" />
              <span>{salaryDisplay}</span>
            </span>
          ) : null}

          {job.isStale && (
            <span className="inline-flex items-center space-x-1 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
              <AlertTriangle className="h-2.5 w-2.5 text-amber-600" />
              <span>Stale (&gt;60d)</span>
            </span>
          )}

          <span className="text-[11px] text-slate-400 capitalize">• Source: {job.source}</span>
        </div>

        {/* Explanation Banner */}
        {explanation && (
          <p className="mt-3 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
            {explanation}
          </p>
        )}

        {/* Matched Skills Chips */}
        {matchedSkills.length > 0 && (
          <div className="mt-3">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block mb-1">
              Matched Skills:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {matchedSkills.slice(0, 6).map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-800 text-[11px] font-medium px-2 py-0.5 rounded-md border border-emerald-100"
                >
                  <Check className="h-2.5 w-2.5 text-emerald-600" />
                  <span>{skill}</span>
                </span>
              ))}
              {matchedSkills.length > 6 && (
                <span className="text-[11px] text-emerald-600 font-medium self-center">
                  +{matchedSkills.length - 6} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Missing Skills Chips */}
        {missingSkills.length > 0 && (
          <div className="mt-2.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Missing Skills:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {missingSkills.slice(0, 5).map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center space-x-1 bg-slate-100 text-slate-600 text-[11px] font-medium px-2 py-0.5 rounded-md"
                >
                  <X className="h-2.5 w-2.5 text-slate-400" />
                  <span>{skill}</span>
                </span>
              ))}
              {missingSkills.length > 5 && (
                <span className="text-[11px] text-slate-400 font-medium self-center">
                  +{missingSkills.length - 5} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Fallback to general skills if no match breakdown */}
        {!matchedSkills.length && !missingSkills.length && job.skills && job.skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {job.skills.slice(0, 6).map((skill) => (
              <span
                key={skill}
                className="bg-slate-100 text-slate-700 text-[11px] font-medium px-2 py-0.5 rounded-md"
              >
                {skill}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer: View Details & Apply link */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between">
        <Link
          to={`/jobs/${job._id}`}
          className="text-xs font-semibold text-slate-700 hover:text-emerald-600 transition"
        >
          View Details →
        </Link>

        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1 text-xs font-medium text-slate-400 hover:text-slate-600 transition"
          >
            <span>Original Post</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}
