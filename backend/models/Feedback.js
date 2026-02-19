const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  submission_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Submission',
    required: true
  },
  plagiarism_risk: {
    type: String,
    required: true
  },
  feedback_summary: {
    type: String,
    required: true
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  evaluated_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Feedback', feedbackSchema);
