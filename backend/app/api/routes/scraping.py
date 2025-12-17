import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.services.apify_service import apify_service
from app.schemas.scraping import (
    ScrapingRunCreate,
    ScrapingRunResponse,
    ScrapingRunListResponse,
    ScrapingResultListResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


async def run_actor_and_fetch_results(run_id: int, params: ScrapingRunCreate):
    """Background task to run actor and fetch results"""
    from app.core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        try:
            # Start actor and wait for completion
            await apify_service.start_actor_run(db, run_id, params)
            # Fetch and save results
            await apify_service.fetch_and_save_results(db, run_id)
        except Exception as e:
            logger.error(f"Background task failed for run {run_id}: {e}")


@router.post("/runs", response_model=ScrapingRunResponse)
async def create_scraping_run(
    params: ScrapingRunCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new scraping run and start the Apify actor.
    The actor runs in the background.
    """
    # Create run record
    run = await apify_service.create_run(db, params)

    # Start actor in background
    background_tasks.add_task(run_actor_and_fetch_results, run.id, params)

    return run


@router.post("/runs/sync", response_model=ScrapingRunResponse)
async def create_scraping_run_sync(
    params: ScrapingRunCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new scraping run and wait for completion (synchronous).
    Warning: This can take a long time depending on the scraping parameters.
    """
    # Create run record
    run = await apify_service.create_run(db, params)

    try:
        # Start actor and wait for completion
        await apify_service.start_actor_run(db, run.id, params)
        # Fetch and save results
        await apify_service.fetch_and_save_results(db, run.id)
        # Return updated run
        return await apify_service.get_run(db, run.id)
    except Exception as e:
        logger.error(f"Sync run failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/runs", response_model=ScrapingRunListResponse)
async def list_scraping_runs(
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """Get paginated list of scraping runs"""
    runs, total = await apify_service.get_runs(db, page, page_size)
    return ScrapingRunListResponse(
        runs=runs,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/runs/{run_id}", response_model=ScrapingRunResponse)
async def get_scraping_run(
    run_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a specific scraping run by ID"""
    run = await apify_service.get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.get("/runs/{run_id}/status", response_model=ScrapingRunResponse)
async def check_run_status(
    run_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Check and update status of a running actor"""
    try:
        run = await apify_service.check_run_status(db, run_id)
        return run
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/runs/{run_id}/fetch-results", response_model=ScrapingRunResponse)
async def fetch_run_results(
    run_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Fetch results from a completed Apify run"""
    try:
        await apify_service.fetch_and_save_results(db, run_id)
        run = await apify_service.get_run(db, run_id)
        return run
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/runs/{run_id}/abort", response_model=ScrapingRunResponse)
async def abort_scraping_run(
    run_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Abort a running scraping actor"""
    try:
        run = await apify_service.abort_run(db, run_id)
        return run
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/runs/{run_id}/results", response_model=ScrapingResultListResponse)
async def get_run_results(
    run_id: int,
    page: int = 1,
    page_size: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Get paginated results for a scraping run"""
    # Check if run exists
    run = await apify_service.get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    results, total = await apify_service.get_results(db, run_id, page, page_size)
    return ScrapingResultListResponse(
        results=results,
        total=total,
        page=page,
        page_size=page_size,
    )
