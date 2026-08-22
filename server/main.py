from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.v1.api import api_router
from core.config import settings

app = FastAPI(title="Life Plan API", version="1.0.0")

# CORS origins - update these URLs for your production frontend
CORS_ORIGINS = [
    "http://localhost:3000",
    # Dev only: the laptop's LAN IP, so the app is reachable from other
    # devices on the network (e.g. testing from a phone) via that IP.
    "http://192.168.150.176:3000",
    "https://lifeplan.azwgroup.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    return {"message": "Life Plan API"}
