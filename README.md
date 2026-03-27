# REPD — Every Rep, Recorded

A full-stack gym tracker app built with React + Vite + FastAPI + Supabase.

## Stack
- **Frontend:** React + Vite + Tailwind CSS + Framer Motion
- **Backend:** Python + FastAPI
- **Database/Auth:** Supabase (PostgreSQL + JWT auth)
- **AI Coach:** Groq (Llama 3.3 70B)

## Setup

### Frontend
```bash
cd frontend
npm install
# Fill in .env.local with your Supabase credentials
npm run dev
```

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
# Fill in .env with your credentials
uvicorn app.main:app --reload
```

## Environment Variables

### frontend/.env.local
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_URL=http://localhost:8000
```

### backend/.env
```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_JWT_SECRET=your_jwt_secret
GROQ_API_KEY=your_groq_key
```
