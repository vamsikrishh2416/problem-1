# Assignment Evaluation Platform

A full-stack web application for managing assignments, collecting student submissions (text or PDF), and automatically evaluating them with plagiarism detection and AI-generated feedback.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Prerequisites](#prerequisites)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [Running the Project](#running-the-project)
- [API Reference](#api-reference)

---

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | React 19, Vite, Axios               |
| Backend   | Node.js, Express 4                  |
| Database  | MongoDB (via Mongoose)              |
| Utilities | pdf-parse (PDF extraction), natural (NLP/plagiarism), multer (file uploads) |

---

## Project Structure

```
vamsi/
├── package.json          # Root — runs both servers concurrently
├── backend/
│   ├── server.js         # Express app & all API routes
│   ├── models/
│   │   ├── Assignment.js
│   │   ├── Submission.js
│   │   └── Feedback.js
│   ├── utils/
│   │   └── aiUtils.js    # Plagiarism detection & feedback generation
│   └── uploads/          # Temporary PDF storage (auto-created)
└── frontend/
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api/
        │   └── axios.js
        ├── pages/
        │   ├── LandingPage.jsx
        │   ├── InstructorDashboard.jsx
        │   └── StudentDashboard.jsx
        └── components/
            └── Toast.jsx
```

---

## Database Schema

```
┌─────────────────────────────────┐
│           Assignment            │
├─────────────────────────────────┤
│ _id         ObjectId  (PK)      │
│ title       String   required   │
│ description String   required   │
│ created_at  Date     default now│
└────────────────┬────────────────┘
                 │ 1
                 │
                 │ has many
                 │
                 ▼ N
┌─────────────────────────────────┐
│           Submission            │
├─────────────────────────────────┤
│ _id          ObjectId  (PK)     │
│ assignment_id ObjectId (FK) ────┘
│ student_name  String  required  │
│ content       String  required  │
│ file_path     String  optional  │
│ submitted_at  Date    default now│
│ status        String            │
│   pending | evaluated | failed  │
└────────────────┬────────────────┘
                 │ 1
                 │
                 │ has one
                 │
                 ▼ 1
┌─────────────────────────────────┐
│            Feedback             │
├─────────────────────────────────┤
│ _id              ObjectId  (PK) │
│ submission_id    ObjectId  (FK) │
│ plagiarism_risk  String         │
│ feedback_summary String         │
│ score            Number (0-100) │
│ evaluated_at     Date  default now│
└─────────────────────────────────┘
```

**Relationships:**
- One **Assignment** → many **Submissions**
- One **Submission** → one **Feedback** (created after evaluation)
- Submission `status` transitions: `pending` → `evaluated` (or `failed`)

---

## Prerequisites

- **Node.js** v18 or higher — [nodejs.org](https://nodejs.org)
- **npm** v9 or higher (bundled with Node.js)
- **MongoDB** running locally on port `27017`, or a MongoDB Atlas connection string

Verify your versions:
```bash
node -v
npm -v
mongod --version
```

---

## Setup & Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd raji
```

### 2. Install all dependencies

Install root, backend, and frontend dependencies in one go:

```bash
# Root dependencies (concurrently)
npm install

# Backend dependencies
npm install --prefix backend

# Frontend dependencies
npm install --prefix frontend
```

### 3. Configure environment variables

```bash
cp backend/.env.example backend/.env
```

Then edit `backend/.env` (see [Environment Variables](#environment-variables) below).

---

## Environment Variables

Create a file at `backend/.env`:

```env
# MongoDB connection string
# Local:
MONGODB_URI=mongodb://localhost:27017/assignment-evaluation
# Atlas (replace with your own):
# MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/assignment-evaluation

# Server port (optional, defaults to 5000)
PORT=5000

# Node environment (optional)
NODE_ENV=development
```

---

## Running the Project

### Development (both servers with hot reload)

From the **root** directory:

```bash
npm run dev
```

This starts:
| Service  | URL                      |
|----------|--------------------------|
| Backend  | http://localhost:5000    |
| Frontend | http://localhost:5173    |

### Production

```bash
npm start
```

### Run servers individually

```bash
# Backend only
npm run dev --prefix backend

# Frontend only
npm run dev --prefix frontend
```

---

## API Reference

Base URL: `http://localhost:5000`

### Health

| Method | Endpoint      | Description        |
|--------|---------------|--------------------|
| GET    | `/api/health` | Server health check|

### Assignments

| Method | Endpoint           | Description              | Body                          |
|--------|--------------------|--------------------------|-------------------------------|
| POST   | `/api/assignments` | Create a new assignment  | `{ title, description }`      |
| GET    | `/api/assignments` | List all assignments     | —                             |

### Submissions

| Method | Endpoint                                    | Description                        | Body / Form                                   |
|--------|---------------------------------------------|------------------------------------|-----------------------------------------------|
| POST   | `/api/submissions`                          | Submit text content                | `{ assignment_id, student_name, content }`    |
| POST   | `/api/submissions/upload`                   | Submit a PDF file (max 10 MB)      | `multipart/form-data`: `assignment_id`, `student_name`, `file` |
| GET    | `/api/submissions/:id`                      | Get a submission + feedback        | —                                             |
| GET    | `/api/submissions/assignment/:assignmentId` | List all submissions for assignment| —                                             |

### Feedback

| Method | Endpoint                        | Description                    |
|--------|---------------------------------|--------------------------------|
| GET    | `/api/feedback/:submissionId`   | Get feedback for a submission  |

Submissions are evaluated **asynchronously** after creation. Poll `GET /api/submissions/:id` until `status` becomes `evaluated`.
