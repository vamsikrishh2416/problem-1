const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  assignment_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    required: true
  },
  student_name: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  file_path: {
    type: String
  },
  submitted_at: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'evaluated', 'failed'],
    default: 'pending'
  }
});

module.exports = mongoose.model('Submission', submissionSchema);
