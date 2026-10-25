import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Plus,
  X,
  Sliders,
  Mail,
  Briefcase,
  Sparkles,
  ShieldCheck,
  GraduationCap,
  Code2,
} from 'lucide-react';

export default function Profile() {
  const { user, updatePreferences } = useAuth();
  const { resumeUpdate } = useSocket();

  // Preferences form state
  const [roles, setRoles] = useState('');
  const [locations, setLocations] = useState('');
  const [remote, setRemote] = useState(true);
  const [minMatchScore, setMinMatchScore] = useState(0.60);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefSuccess, setPrefSuccess] = useState('');

  // Resume Upload State
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [resumeData, setResumeData] = useState(null);
  const [loadingResume, setLoadingResume] = useState(true);

  // Editable Parsed Data State
  const [parsedName, setParsedName] = useState('');
  const [parsedEmail, setParsedEmail] = useState('');
  const [parsedPhone, setParsedPhone] = useState('');
  const [parsedSummary, setParsedSummary] = useState('');
  const [skillsList, setSkillsList] = useState([]);
  const [newSkillInput, setNewSkillInput] = useState('');
  const [savingParsed, setSavingParsed] = useState(false);
  const [parsedSuccess, setParsedSuccess] = useState('');

  // Sync user preferences
  useEffect(() => {
    if (user && user.preferences) {
      setRoles((user.preferences.roles || []).join(', '));
      setLocations((user.preferences.locations || []).join(', '));
      setRemote(user.preferences.remote ?? true);
      setMinMatchScore(user.preferences.minMatchScore ?? 0.60);
      setEmailAlerts(user.preferences.emailAlerts ?? true);
    }
  }, [user]);

  // Fetch latest resume
  const fetchResume = async () => {
    setLoadingResume(true);
    try {
      const res = await api.get('/resumes/latest');
      if (res.data.resume) {
        const r = res.data.resume;
        setResumeData(r);
        setParsedName(r.parsed?.name || '');
        setParsedEmail(r.parsed?.email || '');
        setParsedPhone(r.parsed?.phone || '');
        setParsedSummary(r.parsed?.summary || '');
        setSkillsList(r.normalizedSkills || []);
      }
    } catch (err) {
      console.error('Error fetching resume:', err);
    } finally {
      setLoadingResume(false);
    }
  };

  useEffect(() => {
    fetchResume();
  }, []);

  // Listen for real-time resume status from Socket.IO
  useEffect(() => {
    if (resumeUpdate) {
      if (resumeUpdate.status === 'done') {
        fetchResume();
      } else if (resumeUpdate.status === 'failed') {
        setUploadError(resumeUpdate.error || 'Resume parsing encountered an issue.');
      }
    }
  }, [resumeUpdate]);

  const handlePreferencesSubmit = async (e) => {
    e.preventDefault();
    setSavingPrefs(true);
    setPrefSuccess('');
    try {
      const rolesArray = roles.split(',').map((r) => r.trim()).filter(Boolean);
      const locationsArray = locations.split(',').map((l) => l.trim()).filter(Boolean);
      await updatePreferences({
        roles: rolesArray,
        locations: locationsArray,
        remote,
        minMatchScore: parseFloat(minMatchScore),
        emailAlerts,
      });
      setPrefSuccess('Job preferences updated successfully!');
      setTimeout(() => setPrefSuccess(''), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    // Check size < 5 MB
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size exceeds the 5 MB maximum limit.');
      return;
    }

    setUploading(true);
    setUploadError('');
    try {
      const formData = new FormData();
      formData.append('resume', file);
      const res = await api.post('/resumes', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResumeData(res.data.resume);
      setFile(null);
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Failed to upload resume.');
    } finally {
      setUploading(false);
    }
  };

  const handleAddSkill = (e) => {
    e.preventDefault();
    if (!newSkillInput.trim()) return;
    const clean = newSkillInput.trim();
    if (!skillsList.includes(clean)) {
      setSkillsList([...skillsList, clean]);
    }
    setNewSkillInput('');
  };

  const handleRemoveSkill = (skillToRemove) => {
    setSkillsList(skillsList.filter((s) => s !== skillToRemove));
  };

  const handleSaveParsedData = async (e) => {
    e.preventDefault();
    setSavingParsed(true);
    setParsedSuccess('');
    try {
      await api.put('/resumes/latest', {
        parsed: {
          name: parsedName,
          email: parsedEmail,
          phone: parsedPhone,
          summary: parsedSummary,
        },
        normalizedSkills: skillsList,
      });
      setParsedSuccess('Resume profile updated and re-indexed!');
      setTimeout(() => setParsedSuccess(''), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingParsed(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Profile & AI Skill Hub</h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage your resume, review extracted technical competencies, and configure real-time alert thresholds.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Preferences & Upload */}
        <div className="space-y-6 lg:col-span-1">
          {/* Resume Upload Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-2.5">
              <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <UploadCloud className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Upload Resume</h2>
            </div>

            <p className="text-xs text-slate-500">
              PDF or DOCX documents up to 5 MB. Evaluated using PyMuPDF and strict schema LLM extraction.
            </p>

            <div className="bg-sky-50 border border-sky-100 rounded-xl p-2.5 flex items-start space-x-2 text-[11px] text-sky-800">
              <ShieldCheck className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
              <span><strong>PII Privacy Shield:</strong> Phone numbers, street addresses, and national IDs are automatically redacted before any AI processing.</span>
            </div>

            <form onSubmit={handleFileUpload} className="space-y-3">
              <label className="border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-2xl p-6 text-center cursor-pointer transition block bg-slate-50/50">
                <FileText className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                <span className="text-xs font-semibold text-slate-700 block">
                  {file ? file.name : 'Choose or drag resume here'}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  PDF or DOCX (max 5 MB)
                </span>
                <input
                  type="file"
                  accept=".pdf,.docx,.doc"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="hidden"
                />
              </label>

              {uploadError && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!file || uploading}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <span>Upload & Analyze</span>
                )}
              </button>
            </form>

            {/* Live Status Card */}
            {resumeData && (
              <div className="mt-4 pt-4 border-t border-slate-100 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Processing Status:</span>
                  <span
                    className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full font-bold capitalize ${
                      resumeData.status === 'done'
                        ? 'bg-emerald-50 text-emerald-700'
                        : resumeData.status === 'processing'
                        ? 'bg-amber-50 text-amber-700 animate-pulse'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {resumeData.status === 'processing' && <Loader2 className="h-3 w-3 animate-spin" />}
                    {resumeData.status === 'done' && <CheckCircle2 className="h-3 w-3" />}
                    <span>{resumeData.status}</span>
                  </span>
                </div>
                {resumeData.status === 'processing' && (
                  <p className="text-[11px] text-slate-500 mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    Background Celery worker is extracting text and executing LLM validation. This card updates live through Socket.IO.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Preferences Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-2.5">
              <div className="h-8 w-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <Sliders className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Job Preferences</h2>
            </div>

            {prefSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-xl flex items-center space-x-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{prefSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePreferencesSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700">Target Roles</label>
                <input
                  type="text"
                  value={roles}
                  onChange={(e) => setRoles(e.target.value)}
                  placeholder="Full Stack, ML Engineer, Backend"
                  className="mt-1.5 w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Preferred Locations</label>
                <input
                  type="text"
                  value={locations}
                  onChange={(e) => setLocations(e.target.value)}
                  placeholder="San Francisco, CA, India, Remote"
                  className="mt-1.5 w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-slate-700">Minimum Match Threshold</label>
                  <span className="font-bold text-emerald-600">{Math.round(minMatchScore * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="0.95"
                  step="0.05"
                  value={minMatchScore}
                  onChange={(e) => setMinMatchScore(e.target.value)}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Real-time alerts trigger when new crawled jobs score above this threshold.
                </span>
              </div>

              <div className="space-y-2 pt-1 border-t border-slate-100">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remote}
                    onChange={(e) => setRemote(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-700 font-medium">Open to Remote Positions</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailAlerts}
                    onChange={(e) => setEmailAlerts(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-700 font-medium">Send Email Alerts on New Matches</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={savingPrefs}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm transition flex items-center justify-center space-x-2"
              >
                {savingPrefs ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Save Preferences</span>}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Editable Parsed Data Hub */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Extracted AI Profile</h2>
                <p className="text-xs text-slate-500">
                  Review and edit the fields parsed by the LLM. Modifications trigger vector re-indexing.
                </p>
              </div>
              <div className="flex items-center space-x-2 self-start sm:self-auto">
                <button
                  onClick={handleSaveParsedData}
                  disabled={savingParsed || !resumeData}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {savingParsed ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      <span>Save & Re-Index</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {parsedSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-xl flex items-center space-x-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{parsedSuccess}</span>
              </div>
            )}

            {!resumeData ? (
              <div className="py-16 text-center text-slate-400">
                <FileText className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">No Resume Parsed Yet</p>
                <p className="text-xs text-slate-500 mt-1">Upload a resume on the left to populate this view.</p>
              </div>
            ) : (
              <form onSubmit={handleSaveParsedData} className="space-y-5 text-xs">
                {/* Contact row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={parsedName}
                      onChange={(e) => setParsedName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={parsedEmail}
                      onChange={(e) => setParsedEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                    <input
                      type="text"
                      value={parsedPhone}
                      onChange={(e) => setParsedPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Professional Summary */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Professional Summary</label>
                  <textarea
                    rows={4}
                    value={parsedSummary}
                    onChange={(e) => setParsedSummary(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-emerald-500 leading-relaxed"
                  />
                </div>

                {/* Normalized Skills Tags */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="font-semibold text-slate-700">
                      Normalized Skills Profile ({skillsList.length} canonical skills)
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-1.5 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl min-h-[80px]">
                    {skillsList.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center space-x-1.5 bg-white border border-slate-200 text-slate-800 text-xs font-medium px-2.5 py-1 rounded-lg shadow-2xs"
                      >
                        <span>{skill}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(skill)}
                          className="text-slate-400 hover:text-rose-500 transition"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>

                  {/* Add skill input */}
                  <div className="mt-2.5 flex space-x-2">
                    <input
                      type="text"
                      value={newSkillInput}
                      onChange={(e) => setNewSkillInput(e.target.value)}
                      placeholder="Add another skill (e.g. Next.js, Redis, PyTorch)..."
                      className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSkill(e);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddSkill}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition flex items-center space-x-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

                {/* Education Preview */}
                {resumeData.parsed?.education && resumeData.parsed.education.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-slate-700 mb-2 flex items-center space-x-1.5">
                      <GraduationCap className="h-4 w-4 text-emerald-600" />
                      <span>Education</span>
                    </h3>
                    <div className="space-y-2">
                      {resumeData.parsed.education.map((edu, idx) => (
                        <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-baseline gap-1">
                          <div>
                            <p className="font-bold text-slate-800 text-xs">{edu.institution}</p>
                            <p className="text-xs text-slate-600">{edu.degree}</p>
                          </div>
                          {edu.years && (
                            <span className="text-[11px] font-semibold text-slate-400 shrink-0">{edu.years}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Technical Projects */}
                {resumeData.parsed?.projects && resumeData.parsed.projects.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-slate-700 mb-2 flex items-center space-x-1.5">
                      <Code2 className="h-4 w-4 text-emerald-600" />
                      <span>Key Technical Projects ({resumeData.parsed.projects.length})</span>
                    </h3>
                    <div className="space-y-3">
                      {resumeData.parsed.projects.map((proj, idx) => (
                        <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                          <div className="flex justify-between items-baseline">
                            <span className="font-bold text-slate-800 text-xs">{proj.name}</span>
                          </div>
                          {proj.tech && proj.tech.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {proj.tech.map((t, tIdx) => (
                                <span key={tIdx} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-600 font-medium">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                          {proj.bullets && proj.bullets.length > 0 ? (
                            <ul className="list-disc list-outside pl-4 space-y-1 text-slate-600 text-[11px]">
                              {proj.bullets.map((b, bIdx) => (
                                <li key={bIdx}>{b}</li>
                              ))}
                            </ul>
                          ) : proj.description ? (
                            <p className="text-[11px] text-slate-600">{proj.description}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Experience History */}
                {resumeData.parsed?.experience && resumeData.parsed.experience.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-slate-700 mb-2 flex items-center space-x-1.5">
                      <Briefcase className="h-4 w-4 text-emerald-600" />
                      <span>Experience History</span>
                    </h3>
                    <div className="space-y-2">
                      {resumeData.parsed.experience.map((exp, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <p className="font-bold text-slate-800">
                            {exp.role} <span className="font-normal text-slate-500">at {exp.company}</span>
                          </p>
                          <p className="text-[11px] text-slate-400">{exp.duration}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
