const mongoose = require('mongoose');

const alsoOnSchema = new mongoose.Schema(
  {
    source: { type: String, required: true },
    sourceId: { type: String, required: true },
    url: { type: String, default: '' },
    postedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const jobSchema = new mongoose.Schema(
  {
    source: { type: String, required: true, index: true },
    sourceId: { type: String, required: true },
    title: { type: String, required: true, trim: true, index: true },
    company: { type: String, required: true, trim: true, index: true },
    location: { type: String, required: true, trim: true, index: true },
    remote: { type: Boolean, default: false, index: true },
    description: { type: String, required: true },
    skills: { type: [String], default: [], index: true },
    salaryMin: { type: Number, default: null },
    salaryMax: { type: Number, default: null },
    salaryNormalized: {
      currency: { type: String, default: 'USD' },
      annualMinUSD: { type: Number, default: null },
      annualMaxUSD: { type: Number, default: null },
      display: { type: String, default: null },
    },
    url: { type: String, required: true },
    postedAt: { type: Date, default: Date.now, index: true },
    fingerprint: { type: String, required: true, unique: true, index: true },
    embedding: { type: [Number], default: [] },
    alsoOn: { type: [alsoOnSchema], default: [] },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

// Virtual for ghost / stale job detection (>60 days old)
jobSchema.virtual('isStale').get(function () {
  if (!this.postedAt) return false;
  const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(this.postedAt).getTime() > sixtyDaysMs;
});

// Compound text index on title, company, description
jobSchema.index(
  { title: 'text', company: 'text', description: 'text' },
  { weights: { title: 5, company: 3, description: 1 }, name: 'JobTextIndex' }
);

jobSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Job', jobSchema, 'jobs');
