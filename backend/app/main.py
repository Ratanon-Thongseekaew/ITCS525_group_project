import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .schemas import Greeting, HealthCheck

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    logger.info("Swagger docs available at http://127.0.0.1:8000/docs")
    yield


app = FastAPI(
    title="Textile Track API",
    description="API for the Textile Track application.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", response_model=HealthCheck, tags=["system"])
async def health_check() -> HealthCheck:
    return HealthCheck(status="ok")


@app.get("/api/greeting", response_model=Greeting, tags=["example"])
async def greeting() -> Greeting:
    return Greeting(message="Hello from FastAPI!")
