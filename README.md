## Demo
See the demo video: [Watch Demo](https://github.com/user-attachments/assets/46941836-1e6b-4778-b579-dc0c74d61b38)


# InvestAnalyzer: Automated Investment Thesis Generator

## Overview

InvestAnalyzer is a web application that automatically analyzes startup pitch decks and generates structured investment theses. It leverages AI to evaluate pitch decks against key criteria, assign scores, and provide actionable insights, delivering a comprehensive PDF report.

## Key Features

- **Automated Analysis:** Upload pitch decks (.ppt/.pptx) for AI-powered evaluation across 9 key investment categories
- **Scoring System:** Receive quantitative scores (0-100) with category breakdowns
- **Qualitative Insights:** Get detailed feedback on strengths, weaknesses, and strategic recommendations
- **Report Generation:** Download comprehensive PDF reports of analysis results
- **User Dashboard:** Track analysis history and access previous reports
- **Notifications:** Receive email alerts when analysis is complete

## Technology

- **Frontend:** React with TypeScript
- **Backend:** Node.js/Express and Python services
- **AI:** Google Gemini API for analysis
- **Storage:** AWS S3 for files, PostgreSQL for data
- **Authentication:** Email/password and Google OAuth 2.0

## Getting Started

### Prerequisites
- Node.js and npm
- Python 3.11+
- PostgreSQL database
- AWS account (S3, RDS, SES)
- Google Cloud project with API credentials
- Tesseract OCR engine

### Configuration
Create a `.env` file in the backend directory with your credentials for:
- AWS services
- PostgreSQL database
- Google Gemini API
- JWT settings
- Google OAuth

### Running Locally
```bash
# Backend
cd backend
npm install
node server.js

# Frontend
cd frontend
npm install
npm run dev
```

Visit http://localhost:5173 to access the application.
