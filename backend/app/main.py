import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .schemas import (
    ActiveBinsResponse,
    BinCloseRequest,
    BinCreateRequest,
    BinRecord,
    BinStatus,
    BinType,
    GarmentItem,
    GarmentSortRequest,
    Greeting,
    HealthCheck,
    SortGarmentResponse,
    SortingStatsResponse,
)
from .sorting_service import sorting_service

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    logger.info("Swagger docs available at http://127.0.0.1:8000/docs")
    yield


app = FastAPI(
    title="Textile Track API",
    description="API for Textile Track garment intake, sorting, and bin management.",
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


# -------------------------------------------------------------------------
# Feature 2: Garment Sorting & Bin Records Endpoints
# -------------------------------------------------------------------------


@app.get("/api/bins", response_model=list[BinRecord], tags=["bins"])
async def get_bins(
    bin_type: BinType | None = Query(default=None, description="Filter by bin type"),
    status: BinStatus | None = Query(default=None, description="Filter by status"),
) -> list[BinRecord]:
    return sorting_service.get_all_bins(bin_type=bin_type, status=status)


@app.get("/api/bins/active", response_model=ActiveBinsResponse, tags=["bins"])
async def get_active_bins() -> ActiveBinsResponse:
    return sorting_service.get_active_bins()


@app.post("/api/bins", response_model=BinRecord, status_code=201, tags=["bins"])
async def create_bin(request: BinCreateRequest) -> BinRecord:
    return sorting_service.create_bin(request)


@app.post("/api/bins/{bin_id}/close", response_model=BinRecord, tags=["bins"])
async def close_bin(bin_id: str, request: BinCloseRequest | None = None) -> BinRecord:
    close_req = request or BinCloseRequest()
    updated = sorting_service.close_bin(bin_id, close_req)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Bin with ID '{bin_id}' not found.")
    return updated


@app.post("/api/garments/sort", response_model=SortGarmentResponse, tags=["garments"])
async def sort_garment(request: GarmentSortRequest) -> SortGarmentResponse:
    return sorting_service.sort_garment(request)


@app.get("/api/garments/recent", response_model=list[GarmentItem], tags=["garments"])
async def get_recent_garments(
    limit: int = Query(default=15, ge=1, le=100, description="Max items to return"),
) -> list[GarmentItem]:
    return sorting_service.get_recent_garments(limit=limit)


@app.get("/api/sorting/stats", response_model=SortingStatsResponse, tags=["garments"])
async def get_sorting_stats() -> SortingStatsResponse:
    return sorting_service.get_stats()
