const Joi = require('joi');
const User = require('../models/User');

const preferencesSchema = Joi.object({
  roles: Joi.array().items(Joi.string()).optional(),
  locations: Joi.array().items(Joi.string()).optional(),
  remote: Joi.boolean().optional(),
  minMatchScore: Joi.number().min(0).max(1).optional(),
  emailAlerts: Joi.boolean().optional(),
});

const updatePreferences = async (req, res, next) => {
  try {
    const { error, value } = preferencesSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    user.preferences = {
      ...user.preferences?.toObject(),
      ...value,
    };

    await user.save();

    const { clearRecommendationCache } = require('./recommendationController');
    clearRecommendationCache(req.user._id);

    return res.status(200).json({
      success: true,
      message: 'Preferences updated successfully',
      preferences: user.preferences,
      user,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { updatePreferences };
