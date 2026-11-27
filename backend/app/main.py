import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth import router as auth_router
from .contractor_reports import router as contractor_reports_router
from .contractors import router as contractors_router
from .dashboard import router as dashboard_router
from .epr import router as epr_router
from .handoffs import router as handoffs_router
from .resale import router as resale_router
from .schemas import Greeting, HealthCheck
from .sites import router as sites_router
from .sorting import router as sorting_router
from .users import router as users_router

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

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(sites_router)
app.include_router(contractors_router)
app.include_router(dashboard_router)
app.include_router(epr_router)
app.include_router(contractor_reports_router)
app.include_router(resale_router)
app.include_router(handoffs_router)
app.include_router(sorting_router)

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
