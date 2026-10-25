const mongoose = require('mongoose');

const savedJobSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['saved', 'applied', 'interview', 'rejected'],
      default: 'saved',
      index: true,
    },
    notes: { type: String, default: '' },
    deadlineDate: { type: Date, default: null },
    interviewDate: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

savedJobSchema.index({ userId: 1, jobId: 1 }, { unique: true });

savedJobSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('SavedJob', savedJobSchema, 'savedJobs');
