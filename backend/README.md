# Assignment Evaluation Platform - Backend

Backend REST API for the Assignment Evaluation & Feedback Platform.

## Features

- Assignment creation and management
- Text and PDF submission handling
- Automated plagiarism detection using TF-IDF and cosine similarity
- Rule-based feedback generation
- MongoDB database integration

## Tech Stack

- Node.js + Express.js
- MongoDB with Mongoose ODM
- Natural (NLP library for plagiarism detection)
- pdf-parse (PDF text extraction)
- Multer (file upload handling)

## Setup

### Prerequisites

- Node.js 16+ installed
- MongoDB instance (local or MongoDB Atlas)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/assignment-evaluation
NODE_ENV=development
```

### Running the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## API Endpoints

### Assignments

**Create Assignment**
```
POST /api/assignments
Content-Type: application/json

{
  "title": "Assignment Title",
  "description": "Assignment description and instructions"
}

Response: 201 Created
{
  "assignment_id": "...",
  "title": "...",
  "description": "...",
  "created_at": "..."
}
```

**Get All Assignments**
```
GET /api/assignments

Response: 200 OK
{
  "assignments": [...]
}
```

### Submissions

**Submit Text Content**
```
POST /api/submissions
Content-Type: application/json

{
  "assignment_id": "...",
  "student_name": "John Doe",
  "content": "Submission text content..."
}

Response: 201 Created
{
  "submission_id": "...",
  "status": "pending",
  "message": "Submission received and is being processed"
}
```

**Submit PDF File**
```
POST /api/submissions/upload
Content-Type: multipart/form-data

Form fields:
- assignment_id: string
- student_name: string
- file: PDF file

Response: 201 Created
{
  "submission_id": "...",
  "status": "pending",
  "message": "PDF submission received and is being processed"
}
```

**Get Submission with Feedback**
```
GET /api/submissions/:id

Response: 200 OK
{
  "submission_id": "...",
  "assignment_id": "...",
  "assignment_title": "...",
  "student_name": "...",
  "content": "...",
  "submitted_at": "...",
  "status": "evaluated",
  "feedback": {
    "plagiarism_risk": "15%",
    "feedback_summary": "...",
    "score": 85,
    "evaluated_at": "..."
  }
}
```

**Get Submissions by Assignment**
```
GET /api/submissions/assignment/:assignmentId

Response: 200 OK
{
  "submissions": [...]
}
```

### Feedback

**Get Feedback for Submission**
```
GET /api/feedback/:submissionId

Response: 200 OK
{
  "submission_id": "...",
  "plagiarism_risk": "15%",
  "feedback_summary": "...",
  "score": 85,
  "evaluated_at": "..."
}
```

## Error Handling

All errors return JSON with this format:
```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

Common error codes:
- `MISSING_FIELDS` - Required fields are missing
- `INVALID_CONTENT` - Content validation failed
- `ASSIGNMENT_NOT_FOUND` - Assignment ID not found
- `SUBMISSION_NOT_FOUND` - Submission ID not found
- `FEEDBACK_NOT_FOUND` - Feedback not available
- `PDF_EXTRACTION_FAILED` - Could not extract text from PDF
- `FILE_TOO_LARGE` - File exceeds 10MB limit
- `SERVER_ERROR` - Internal server error

## Deployment

### Render.com

1. Create new Web Service on Render
2. Connect GitHub repository
3. Configure:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Add environment variables:
   - `MONGODB_URI`: Your MongoDB connection string
   - `NODE_ENV`: production

### Other Platforms

The app can be deployed to any Node.js hosting platform (Heroku, Railway, etc.) by:
1. Setting environment variables
2. Running `npm install && npm start`

## Database Schema

### Assignment
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  created_at: Date
}
```

### Submission
```javascript
{
  _id: ObjectId,
  assignment_id: ObjectId (ref: Assignment),
  student_name: String,
  content: String,
  file_path: String (optional),
  submitted_at: Date,
  status: String (pending|evaluated|failed)
}
```

### Feedback
```javascript
{
  _id: ObjectId,
  submission_id: ObjectId (ref: Submission),
  plagiarism_risk: String (e.g., "15%"),
  feedback_summary: String,
  score: Number (0-100),
  evaluated_at: Date
}
```

## AI/ML Components

### Plagiarism Detection
- Uses TF-IDF (Term Frequency-Inverse Document Frequency)
- Calculates cosine similarity between submissions
- Returns percentage indicating similarity to existing submissions

### Feedback Generation
- Rule-based scoring system
- Evaluates:
  - Word count (40 points)
  - Sentence structure (30 points)
  - Content quality/formatting (30 points)
- Returns feedback summary and score (0-100)
