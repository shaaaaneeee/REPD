from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import ai

app = FastAPI(title="REPD API", version="1.0.0")

# CORS — allow frontend dev server and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "https://repd-sigma.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(ai.router, prefix="/ai", tags=["AI"])

@app.get("/health")
def health():
    return {"status": "ok", "service": "REPD API"}
