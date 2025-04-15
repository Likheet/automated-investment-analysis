# InvestAnalyzer: Automated Investment Thesis Generator

## Project Objective

InvestAnalyzer is a web-based platform designed to automatically analyze startup pitch decks (in PPT/PPTX format) and generate a structured investment thesis. It leverages Large Language Models (Google Gemini) and AI to evaluate pitch decks against defined criteria, assign scores, and provide qualitative insights, ultimately producing a downloadable PDF report for the user.

## Core Features

- **Web Application:** Accessible via modern web browsers.
- **User Authentication:**
  - Email/Password Registration & Login.
  - Secure password hashing using `bcrypt`.
  - JWT (JSON Web Token) based authentication for API endpoints.
  - Google OAuth 2.0 login flow (backend support implemented, frontend integration started).
  - Session management for OAuth flow using `express-session`.
- **File Upload:**
  - Supports `.ppt` and `.pptx` file formats (primary focus on `.pptx`).
  - Client-side and server-side validation for file type and size (Max 50MB).
  - File storage in AWS S3.
- **Automated Analysis Pipeline:**
  - **Text Extraction:** Python script extracts text content and presenter notes using `python-pptx`.
  - **(Partial) OCR:** Python script attempts OCR on images within slides using `pytesseract` (requires Tesseract engine installed).
  - **AI Evaluation:** Extracted text analyzed by Google Gemini API based on a detailed prompt covering 9 categories (Problem, Solution, Market, etc.).
  - **Scoring:** Gemini assigns 0-10 scores per category; backend calculates a weighted overall score (0-100).
  - **Qualitative Insights:** Gemini generates feedback, strengths, weaknesses, recommendations, and a confidence score.
- **Database Storage:**
  - User credentials (hashed) and profile info stored in PostgreSQL (AWS RDS).
  - Analysis results (including full AI output, scores, S3 keys) stored and linked to users in PostgreSQL.
- **PDF Report Generation:**
  - Backend generates a detailed PDF report using `pdfkit`.
  - Includes summary, category scores/feedback, strengths/weaknesses, recommendations, AI confidence.
  - Report stored persistently in AWS S3.
- **User Dashboard:**
  - Frontend displays a history of the logged-in user's analyses.
  - Shows original filename, status, score, recommendation.
  - Provides a secure download button for generated PDF reports (uses backend-generated pre-signed S3 URLs via redirect).
- **Notifications:**
  - Sends an email notification (using AWS SES) to the user upon successful analysis completion, including a link to download the report.
- **API Security:**
  - Protected API endpoints using JWT middleware.
  - Rate limiting implemented on the sensitive upload endpoint.
- **Input Validation:** Includes checks for slide count (5-20) and basic content validation (presence of 3+ key categories).

## Tech Stack

- **Frontend:**
  - React (with TypeScript)
  - Vite (Build Tool)
  - Axios (HTTP Client)
  - `react-router-dom` (Routing)
  - `date-fns` (Date Formatting)
  - CSS (Styling - Assumed basic implementation)
- **Backend:**
  - Node.js
  - Express.js (Web Framework)
  - Python 3.11+ (for text/OCR extraction)
    - `python-pptx`
    - `pytesseract`
    - `Pillow`
    - `boto3`
    - `python-dotenv`
  - Libraries:
    - `pg` (PostgreSQL Client)
    - `bcrypt` (Password Hashing)
    - `jsonwebtoken` (JWT Handling)
    - `passport`, `passport-google-oauth20` (OAuth Authentication)
    - `express-session` (Session Management for OAuth)
    - `multer` (File Upload Handling)
    - `pdfkit` (PDF Generation)
    - `@google/generative-ai` (Gemini API Client)
    - `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` (AWS S3 Client)
    - `@aws-sdk/client-ses` (AWS SES Client)
    - `dotenv` (Environment Variables)
    - `express-rate-limit` (Rate Limiting)
    - `express-validator` (Input Validation)
- **Database:** PostgreSQL (Designed for AWS RDS)
- **Cloud Services:**
  - AWS S3 (Simple Storage Service): For PPTX uploads and generated PDF reports.
  - AWS RDS (Relational Database Service): For PostgreSQL database hosting.
  - AWS SES (Simple Email Service): For email notifications.
- **AI:** Google Gemini API (via Google AI Studio key)
- **OCR Engine:** Tesseract OCR (Requires separate installation)

## Project Structure

```plaintext
automated-investment-thesis/
├── backend/
│   ├── config/
│   │   └── passport-setup.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── routes/
│   │   ├── analysis.js
│   │   ├── auth.js
│   │   └── users.js
│   ├── temp-reports/
│   ├── temp-uploads/
│   ├── db.js
│   ├── extract_text.py
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── App.css
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── main.tsx
│   │   ├── vite-env.d.ts
│   │   ├── assets/
│   │   │   └── react.svg
│   │   ├── components/
│   │   │   ├── AuthCallbackPage.tsx
│   │   │   ├── FileUpload.tsx
│   │   │   ├── Header.css
│   │   │   ├── Header.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── ThemeToggle.tsx
│   │   │   └── UserDashboard.tsx
│   │   ├── context/
│   │   │   ├── AuthContext.tsx
│   │   │   └── ThemeContext.tsx
│   │   └── styles/
│   ├── eslint.config.js
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.app.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   └── vite.config.ts
├── .gitignore
└── README.md
```

## Setup and Installation (Local Development)

### 1. Clone the Repository

```bash
git clone https://github.com/Likheet/automated-investment-analysis
cd automated-investment-thesis
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
# Install Python dependencies (ensure Python 3.11+)
pip install python-pptx boto3 pytesseract Pillow python-dotenv
cd ..
```

### 3. Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

### 4. Install Tesseract OCR Engine

- This is required for the OCR functionality. Follow OS-specific instructions.
- Ensure the `tesseract` command is available in your system's PATH, or set the path in `backend/extract_text.py`.
- Verify installation:

```bash
tesseract --version
```

### 5. Setup AWS Services

- **S3 Bucket:** Create an S3 bucket in your desired AWS region. Note the Bucket Name and Region.
- **S3 CORS Configuration:** Configure CORS on the S3 bucket to allow GET requests from your frontend origin (e.g., http://localhost:5173).
- **RDS PostgreSQL Instance:** Create an RDS PostgreSQL instance. Note the Endpoint Hostname, Port, Database Name, Master Username, and Master Password.
- **RDS Security Group:** Allow inbound connections on port 5432 from your local machine's public IP address.
- **SES Setup:** Verify sender and recipient email addresses in the AWS SES Console.
- **IAM Permissions:** Create an IAM user with programmatic access keys. Attach policies for S3, SES, etc.

### 6. Setup Google Cloud Project

- Create a project in the Google Cloud Console.
- Enable the "Google People API".
- Create an OAuth client ID for a Web application.
- Configure "Authorized JavaScript origins" (e.g., http://localhost:5173).
- Configure "Authorized redirect URIs" (e.g., http://localhost:5001/api/auth/google/callback).
- Note the Client ID and Client Secret.

### 7. Configure Environment Variables

Create a `.env` file in the `backend/` directory and fill in your values:

```dotenv
# AWS Credentials
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_ACCESS_KEY
AWS_REGION=your-aws-region

# S3 Bucket
S3_BUCKET_NAME=your-s3-bucket-name

# RDS PostgreSQL Database
DB_HOST=YOUR_RDS_ENDPOINT_HOSTNAME
DB_PORT=5432
DB_USER=YOUR_RDS_MASTER_USERNAME
DB_PASSWORD=YOUR_RDS_MASTER_PASSWORD
DB_NAME=your_rds_database_name
DB_SSL=true

# Google Gemini API Key
GEMINI_API_KEY=YOUR_GOOGLE_AI_STUDIO_API_KEY

# JWT Configuration
JWT_SECRET=YourVeryStrongAndRandomSecretKeyHere_MUST_CHANGE!
JWT_EXPIRES_IN=24h

# AWS SES Configuration
SES_FROM_EMAIL=your-verified-sender-email@example.com

# Google OAuth 2.0 Configuration
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_FROM_CLOUD_CONSOLE
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET_FROM_CLOUD_CONSOLE
CALLBACK_URL_BASE=http://localhost:5001

# Express Session Configuration
SESSION_SECRET=AnotherVeryStrongAndRandomSecretForSessions_MUST_CHANGE!

# Optional: Explicit Python command if 'python' doesn't point to 3.11+
# PYTHON_COMMAND=python3.11
```

**Never commit `.env` to Git. Ensure `backend/.env` is in your `.gitignore`.**

### 8. Setup Database Schema

- Connect to your RDS PostgreSQL instance using a tool like `psql`, DBeaver, or pgAdmin.
- Execute the SQL commands to create the `users` and `analysis_results` tables, including columns for OAuth providers, analysis status/filenames, and the `updated_at` trigger.

## Running the Application

### Start the Backend Server

```bash
cd backend
node server.js
# Backend runs on http://localhost:5001 (or configured port)
```

### Start the Frontend Development Server

```bash
cd frontend
npm run dev
# Frontend accessible at http://localhost:5173
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## API Endpoints (Backend - http://localhost:5001)

- `POST /api/auth/register`: Register new user (email/password). `{ email, password }`
- `POST /api/auth/login`: Login user (email/password). `{ email, password }` → Returns `{ token, user }`
- `GET /api/auth/google`: Initiates Google OAuth flow (Redirects to Google).
- `GET /api/auth/google/callback`: Callback URL for Google OAuth (Handles redirect, generates JWT, redirects to frontend).
- `POST /upload`: (Protected: Requires Bearer Token) Upload PPT/PPTX file. `{ form-data, field: 'pitchDeck' (File) }` → Returns `{ analysisId, pdfReportKey, ... }`
- `GET /api/analysis/history`: (Protected: Requires Bearer Token) Get analysis history for logged-in user. → Returns `[AnalysisRecord]`
- `GET /api/analysis/report/:analysisId/download`: (Protected: Requires Bearer Token) Gets a pre-signed URL for PDF and redirects browser to it for download.
- `GET /api/users/me`: (Protected: Requires Bearer Token) Get details for the currently logged-in user. → Returns `{ user }`

