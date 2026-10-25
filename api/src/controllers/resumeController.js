const Resume = require('../models/Resume');
const rabbitmq = require('../services/rabbitmq');

const uploadResume = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No resume file uploaded. Please upload a PDF or DOCX file.',
      });
    }

    const resume = await Resume.create({
      userId: req.user._id,
      filePath: req.file.path,
      status: 'processing',
    });

    // Enqueue Celery task parse_resume
    try {
      await rabbitmq.sendCeleryTask('tasks.parse_resume', [
        resume._id.toString(),
        req.user._id.toString(),
        req.file.path,
      ]);
    } catch (mqErr) {
      console.error('[ResumeController] Warning: Failed to send Celery task to RabbitMQ:', mqErr.message);
      // Resume remains in 'processing' status, could be retried by worker
    }

    return res.status(201).json({
      success: true,
      message: 'Resume uploaded successfully and is being processed by AI.',
      resume,
    });
  } catch (err) {
    next(err);
  }
};

const getLatestResume = async (req, res, next) => {
  try {
    const resume = await Resume.findOne({ userId: req.user._id })
      .sort({ createdAt: -1 });

    if (!resume) {
      return res.status(200).json({
        success: true,
        resume: null,
      });
    }

    return res.status(200).json({
      success: true,
      resume,
    });
  } catch (err) {
    next(err);
  }
};

const updateResumeParsed = async (req, res, next) => {
  try {
    const { parsed, normalizedSkills } = req.body;
    const resume = await Resume.findOne({ userId: req.user._id }).sort({ createdAt: -1 });

    if (!resume) {
      return res.status(404).json({ success: false, error: 'Resume not found' });
    }

    if (parsed) {
      resume.parsed = { ...resume.parsed?.toObject(), ...parsed };
    }
    if (Array.isArray(normalizedSkills)) {
      resume.normalizedSkills = normalizedSkills;
    }

    await resume.save();

    const { clearRecommendationCache } = require('./recommendationController');
    clearRecommendationCache(req.user._id);

    // Trigger re-embedding and re-matching task
    try {
      await rabbitmq.sendCeleryTask('tasks.reindex_user_resume', [resume._id.toString()]);
    } catch (e) {
      console.warn('[ResumeController] Could not enqueue reindex task:', e.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Resume parsed data updated successfully',
      resume,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  uploadResume,
  getLatestResume,
  updateResumeParsed,
};
