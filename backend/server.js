require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const fs = require('fs').promises;
const path = require('path');

const Assignment = require('./models/Assignment');
const Submission = require('./models/Submission');
const Feedback = require('./models/Feedback');
const { calculatePlagiarismRisk, generateFeedback } = require('./utils/aiUtils');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Database connection
// Database connection
// TODO: Revert to process.env.MONGODB_URI for production security
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://likithsatya192_db_user:SAcd15V3X3FunonN@raji.dmtwfvn.mongodb.net/assignment-evaluation?retryWrites=true&w=majority';

// Log masked URI for debugging
console.log('Attempting to connect to MongoDB...');

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB successfully'))
  .catch(err => {
    console.error('CRITICAL MongoDB connection error:', err);
    // Exit process on DB failure so Render restarts it rather than hanging in a broken state
    process.exit(1);
  });

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Root endpoint for easy verification
app.get('/', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'Connected to MongoDB' : 'Not Connected';
  res.send(`Backend is Running! <br/> DB Status: <strong>${dbStatus}</strong>`);
});

// Assignment Endpoints

/**
 * POST /api/assignments - Create a new assignment
 */
app.post('/api/assignments', async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        error: 'Title and description are required',
        code: 'MISSING_FIELDS'
      });
    }

    const assignment = new Assignment({
      title: title.trim(),
      description: description.trim()
    });

    await assignment.save();

    res.status(201).json({
      assignment_id: assignment._id,
      title: assignment.title,
      description: assignment.description,
      created_at: assignment.created_at
    });
  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({
      error: 'Failed to create assignment',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * GET /api/assignments - Get all assignments
 */
app.get('/api/assignments', async (req, res) => {
  try {
    const assignments = await Assignment.find().sort({ created_at: -1 });

    res.json({
      assignments: assignments.map(a => ({
        assignment_id: a._id,
        title: a.title,
        description: a.description,
        created_at: a.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({
      error: 'Failed to fetch assignments',
      code: 'SERVER_ERROR'
    });
  }
});

// Submission Endpoints

/**
 * POST /api/submissions - Submit text content
 */
app.post('/api/submissions', async (req, res) => {
  try {
    const { assignment_id, student_name, content } = req.body;

    // Validation
    if (!assignment_id || !student_name || !content) {
      return res.status(400).json({
        error: 'Assignment ID, student name, and content are required',
        code: 'MISSING_FIELDS'
      });
    }

    if (content.trim().length === 0) {
      return res.status(400).json({
        error: 'Content cannot be empty',
        code: 'INVALID_CONTENT'
      });
    }

    // Check if assignment exists
    const assignment = await Assignment.findById(assignment_id);
    if (!assignment) {
      return res.status(404).json({
        error: 'Assignment not found',
        code: 'ASSIGNMENT_NOT_FOUND'
      });
    }

    // Create submission
    const submission = new Submission({
      assignment_id,
      student_name: student_name.trim(),
      content: content.trim(),
      status: 'pending'
    });

    await submission.save();

    // Process submission asynchronously
    processSubmission(submission._id, assignment);

    res.status(201).json({
      submission_id: submission._id,
      status: 'pending',
      message: 'Submission received and is being processed'
    });
  } catch (error) {
    console.error('Error creating submission:', error);
    res.status(500).json({
      error: 'Failed to create submission',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * POST /api/submissions/upload - Submit PDF file
 */
app.post('/api/submissions/upload', upload.single('file'), async (req, res) => {
  try {
    const { assignment_id, student_name } = req.body;
    const file = req.file;

    // Validation
    if (!assignment_id || !student_name || !file) {
      if (file) await fs.unlink(file.path).catch(() => { });
      return res.status(400).json({
        error: 'Assignment ID, student name, and file are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Check if assignment exists
    const assignment = await Assignment.findById(assignment_id);
    if (!assignment) {
      await fs.unlink(file.path).catch(() => { });
      return res.status(404).json({
        error: 'Assignment not found',
        code: 'ASSIGNMENT_NOT_FOUND'
      });
    }

    // Extract text from PDF
    let content;
    try {
      const dataBuffer = await fs.readFile(file.path);
      const pdfData = await pdfParse(dataBuffer);
      content = pdfData.text;

      if (!content || content.trim().length === 0) {
        await fs.unlink(file.path).catch(() => { });
        return res.status(400).json({
          error: 'Could not extract text from PDF or PDF is empty',
          code: 'PDF_EXTRACTION_FAILED'
        });
      }
    } catch (pdfError) {
      console.error('PDF extraction error:', pdfError);
      await fs.unlink(file.path).catch(() => { });
      return res.status(400).json({
        error: 'Failed to extract text from PDF',
        code: 'PDF_EXTRACTION_FAILED'
      });
    }

    // Create submission
    const submission = new Submission({
      assignment_id,
      student_name: student_name.trim(),
      content: content.trim(),
      file_path: file.path,
      status: 'pending'
    });

    await submission.save();

    // Process submission asynchronously
    processSubmission(submission._id, assignment);

    res.status(201).json({
      submission_id: submission._id,
      status: 'pending',
      message: 'PDF submission received and is being processed'
    });
  } catch (error) {
    console.error('Error uploading submission:', error);
    if (req.file) await fs.unlink(req.file.path).catch(() => { });
    res.status(500).json({
      error: 'Failed to upload submission',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * GET /api/submissions/assignment/:assignmentId - Get all submissions for an assignment
 * NOTE: must be defined BEFORE /api/submissions/:id to avoid "assignment" matching as :id
 */
app.get('/api/submissions/assignment/:assignmentId', async (req, res) => {
  try {
    const submissions = await Submission.find({
      assignment_id: req.params.assignmentId
    }).sort({ submitted_at: -1 });

    const submissionsWithFeedback = await Promise.all(
      submissions.map(async (submission) => {
        const result = {
          submission_id: submission._id,
          student_name: submission.student_name,
          submitted_at: submission.submitted_at,
          status: submission.status
        };

        if (submission.status === 'evaluated') {
          const feedback = await Feedback.findOne({ submission_id: submission._id });
          if (feedback) {
            result.feedback = {
              plagiarism_risk: feedback.plagiarism_risk,
              feedback_summary: feedback.feedback_summary,
              score: feedback.score
            };
          }
        }

        return result;
      })
    );

    res.json({ submissions: submissionsWithFeedback });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({
      error: 'Failed to fetch submissions',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * GET /api/submissions/:id - Get submission with feedback
 */
app.get('/api/submissions/:id', async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('assignment_id', 'title description');

    if (!submission) {
      return res.status(404).json({
        error: 'Submission not found',
        code: 'SUBMISSION_NOT_FOUND'
      });
    }

    const response = {
      submission_id: submission._id,
      assignment_id: submission.assignment_id._id,
      assignment_title: submission.assignment_id.title,
      student_name: submission.student_name,
      content: submission.content,
      submitted_at: submission.submitted_at,
      status: submission.status
    };

    // Include feedback if available
    if (submission.status === 'evaluated') {
      const feedback = await Feedback.findOne({ submission_id: submission._id });
      if (feedback) {
        response.feedback = {
          plagiarism_risk: feedback.plagiarism_risk,
          feedback_summary: feedback.feedback_summary,
          score: feedback.score,
          evaluated_at: feedback.evaluated_at
        };
      }
    }

    res.json(response);
  } catch (error) {
    console.error('Error fetching submission:', error);
    res.status(500).json({
      error: 'Failed to fetch submission',
      code: 'SERVER_ERROR'
    });
  }
});

// Feedback Endpoint

/**
 * GET /api/feedback/:submissionId - Get feedback for a submission
 */
app.get('/api/feedback/:submissionId', async (req, res) => {
  try {
    const feedback = await Feedback.findOne({ submission_id: req.params.submissionId });

    if (!feedback) {
      return res.status(404).json({
        error: 'Feedback not found',
        code: 'FEEDBACK_NOT_FOUND'
      });
    }

    res.json({
      submission_id: feedback.submission_id,
      plagiarism_risk: feedback.plagiarism_risk,
      feedback_summary: feedback.feedback_summary,
      score: feedback.score,
      evaluated_at: feedback.evaluated_at
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({
      error: 'Failed to fetch feedback',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * Process submission: calculate plagiarism and generate feedback
 */
async function processSubmission(submissionId, assignment) {
  try {
    const submission = await Submission.findById(submissionId);
    if (!submission) return;

    // Get all existing submissions for the same assignment (excluding current one)
    const existingSubmissions = await Submission.find({
      assignment_id: submission.assignment_id,
      _id: { $ne: submissionId },
      status: 'evaluated'
    });

    const existingContents = existingSubmissions.map(s => s.content);

    // Calculate plagiarism risk
    const plagiarismRisk = calculatePlagiarismRisk(submission.content, existingContents);

    // Generate feedback using Gemini AI
    const feedbackResult = await generateFeedback(submission.content, assignment.description);

    // Create feedback record
    const feedback = new Feedback({
      submission_id: submissionId,
      plagiarism_risk: `${plagiarismRisk}%`,
      feedback_summary: feedbackResult.feedback_summary,
      score: feedbackResult.score
    });

    await feedback.save();

    // Update submission status
    submission.status = 'evaluated';
    await submission.save();

    console.log(`Submission ${submissionId} processed successfully`);
  } catch (error) {
    console.error(`Error processing submission ${submissionId}:`, error);

    // Update submission status to failed
    try {
      await Submission.findByIdAndUpdate(submissionId, { status: 'failed' });
    } catch (updateError) {
      console.error('Failed to update submission status:', updateError);
    }
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File size exceeds 10MB limit',
        code: 'FILE_TOO_LARGE'
      });
    }
    return res.status(400).json({
      error: err.message,
      code: 'FILE_UPLOAD_ERROR'
    });
  }

  res.status(500).json({
    error: err.message || 'Internal server error',
    code: 'SERVER_ERROR'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
