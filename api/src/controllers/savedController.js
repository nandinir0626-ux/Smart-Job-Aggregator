const SavedJob = require('../models/SavedJob');
const Job = require('../models/Job');

const saveJob = async (req, res, next) => {
  try {
    const { jobId, status = 'saved', notes = '', deadlineDate, interviewDate } = req.body;

    if (!jobId) {
      return res.status(400).json({ success: false, error: 'jobId is required' });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    const saved = await SavedJob.findOneAndUpdate(
      { userId: req.user._id, jobId },
      { 
        status, 
        notes, 
        deadlineDate: deadlineDate || null, 
        interviewDate: interviewDate || null, 
        createdAt: Date.now() 
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).populate('jobId', '-embedding');

    return res.status(201).json({
      success: true,
      message: `Job marked as ${status}`,
      savedJob: saved,
    });
  } catch (err) {
    next(err);
  }
};

const getSavedJobs = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = { userId: req.user._id };
    if (status) {
      filter.status = status;
    }

    const savedJobs = await SavedJob.find(filter)
      .populate('jobId', '-embedding')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      savedJobs,
    });
  } catch (err) {
    next(err);
  }
};

const updateSavedJob = async (req, res, next) => {
  try {
    const { status, notes, deadlineDate, interviewDate } = req.body;
    const update = {};
    if (status) update.status = status;
    if (notes !== undefined) update.notes = notes;
    if (deadlineDate !== undefined) update.deadlineDate = deadlineDate;
    if (interviewDate !== undefined) update.interviewDate = interviewDate;

    const saved = await SavedJob.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      update,
      { new: true }
    ).populate('jobId', '-embedding');

    if (!saved) {
      return res.status(404).json({ success: false, error: 'Saved job entry not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Status updated successfully',
      savedJob: saved,
    });
  } catch (err) {
    next(err);
  }
};

const deleteSavedJob = async (req, res, next) => {
  try {
    const deleted = await SavedJob.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Saved job entry not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Job removed from saved list',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  saveJob,
  getSavedJobs,
  updateSavedJob,
  deleteSavedJob,
};
