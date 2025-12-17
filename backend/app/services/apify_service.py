import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from apify_client import ApifyClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.config import settings
from app.models.scraping import ScrapingRun, ScrapingResult, RunStatus
from app.schemas.scraping import ScrapingRunCreate

logger = logging.getLogger(__name__)


class ApifyService:
    """Service for managing Apify actor runs and results"""

    def __init__(self):
        self.client = ApifyClient(settings.APIFY_API_TOKEN)
        self.actor_id = settings.APIFY_ACTOR_ID

    def _build_actor_input(self, params: ScrapingRunCreate) -> Dict[str, Any]:
        """Build input configuration for Apify actor"""
        actor_input = {
            "postedLimit": params.posted_limit,
            "maxPosts": params.max_posts,
            "maxComments": params.max_comments,
            "maxReactions": params.max_reactions,
            "scrapeComments": params.scrape_comments,
            "scrapeReactions": params.scrape_reactions,
            "scrapePages": params.scrape_pages,
            "sortBy": params.sort_by,
            "startPage": 1,
            "commentsPostedLimit": params.posted_limit,
        }

        if params.search_queries:
            actor_input["searchQueries"] = params.search_queries
        if params.author_urls:
            actor_input["authorUrls"] = params.author_urls
        if params.authors_companies:
            actor_input["authorsCompanies"] = params.authors_companies

        return actor_input

    async def create_run(self, db: AsyncSession, params: ScrapingRunCreate) -> ScrapingRun:
        """Create a new scraping run record in database"""
        run = ScrapingRun(
            status=RunStatus.PENDING,
            search_queries=params.search_queries,
            author_urls=params.author_urls,
            authors_companies=params.authors_companies,
            posted_limit=params.posted_limit,
            max_posts=params.max_posts,
            max_comments=params.max_comments,
            max_reactions=params.max_reactions,
            scrape_comments=1 if params.scrape_comments else 0,
            scrape_reactions=1 if params.scrape_reactions else 0,
            scrape_pages=params.scrape_pages,
            sort_by=params.sort_by,
        )
        db.add(run)
        await db.commit()
        await db.refresh(run)
        return run

    async def start_actor_run(self, db: AsyncSession, run_id: int, params: ScrapingRunCreate) -> ScrapingRun:
        """Start Apify actor and update run record"""
        # Get run from db
        result = await db.execute(select(ScrapingRun).where(ScrapingRun.id == run_id))
        run = result.scalar_one_or_none()
        if not run:
            raise ValueError(f"Run {run_id} not found")

        try:
            # Build actor input
            actor_input = self._build_actor_input(params)
            logger.info(f"Starting actor with input: {actor_input}")

            # Start actor run (synchronous call)
            actor_run = self.client.actor(self.actor_id).call(run_input=actor_input)

            # Update run record
            run.apify_run_id = actor_run.get("id")
            run.status = RunStatus.RUNNING
            run.started_at = datetime.utcnow()
            await db.commit()
            await db.refresh(run)

            logger.info(f"Actor run started: {run.apify_run_id}")
            return run

        except Exception as e:
            logger.error(f"Failed to start actor: {e}")
            run.status = RunStatus.FAILED
            run.error_message = str(e)
            await db.commit()
            await db.refresh(run)
            raise

    async def start_actor_async(self, db: AsyncSession, run_id: int, params: ScrapingRunCreate) -> ScrapingRun:
        """Start Apify actor asynchronously (non-blocking)"""
        result = await db.execute(select(ScrapingRun).where(ScrapingRun.id == run_id))
        run = result.scalar_one_or_none()
        if not run:
            raise ValueError(f"Run {run_id} not found")

        try:
            actor_input = self._build_actor_input(params)
            logger.info(f"Starting actor async with input: {actor_input}")

            # Start actor run without waiting for completion
            actor_run = self.client.actor(self.actor_id).start(run_input=actor_input)

            run.apify_run_id = actor_run.get("id")
            run.status = RunStatus.RUNNING
            run.started_at = datetime.utcnow()
            await db.commit()
            await db.refresh(run)

            logger.info(f"Actor run started async: {run.apify_run_id}")
            return run

        except Exception as e:
            logger.error(f"Failed to start actor async: {e}")
            run.status = RunStatus.FAILED
            run.error_message = str(e)
            await db.commit()
            await db.refresh(run)
            raise

    async def check_run_status(self, db: AsyncSession, run_id: int) -> ScrapingRun:
        """Check status of an Apify run and update database"""
        result = await db.execute(select(ScrapingRun).where(ScrapingRun.id == run_id))
        run = result.scalar_one_or_none()
        if not run:
            raise ValueError(f"Run {run_id} not found")

        if not run.apify_run_id:
            return run

        try:
            # Get run info from Apify
            run_info = self.client.run(run.apify_run_id).get()
            apify_status = run_info.get("status", "").upper()

            # Map Apify status to our status
            status_map = {
                "READY": RunStatus.PENDING,
                "RUNNING": RunStatus.RUNNING,
                "SUCCEEDED": RunStatus.SUCCEEDED,
                "FAILED": RunStatus.FAILED,
                "ABORTED": RunStatus.ABORTED,
                "ABORTING": RunStatus.RUNNING,
                "TIMING-OUT": RunStatus.RUNNING,
                "TIMED-OUT": RunStatus.FAILED,
            }

            new_status = status_map.get(apify_status, RunStatus.RUNNING)
            run.status = new_status

            if new_status in [RunStatus.SUCCEEDED, RunStatus.FAILED, RunStatus.ABORTED]:
                run.finished_at = datetime.utcnow()

            await db.commit()
            await db.refresh(run)
            return run

        except Exception as e:
            logger.error(f"Failed to check run status: {e}")
            raise

    async def fetch_and_save_results(self, db: AsyncSession, run_id: int) -> int:
        """Fetch results from Apify and save to database"""
        result = await db.execute(select(ScrapingRun).where(ScrapingRun.id == run_id))
        run = result.scalar_one_or_none()
        if not run:
            raise ValueError(f"Run {run_id} not found")

        if not run.apify_run_id:
            raise ValueError(f"Run {run_id} has no Apify run ID")

        try:
            # Get dataset items
            dataset_items = self.client.run(run.apify_run_id).dataset().list_items().items
            logger.info(f"Fetched {len(dataset_items)} items from Apify")

            # Clear existing results
            await db.execute(
                ScrapingResult.__table__.delete().where(ScrapingResult.run_id == run_id)
            )

            # Save new results
            saved_count = 0
            for item in dataset_items:
                scraping_result = ScrapingResult(
                    run_id=run_id,
                    post_url=item.get("postUrl") or item.get("url"),
                    post_id=item.get("postId") or item.get("id"),
                    post_text=item.get("text") or item.get("postText") or item.get("content"),
                    post_date=self._parse_date(item.get("postedDate") or item.get("date")),
                    author_name=item.get("authorName") or item.get("author", {}).get("name"),
                    author_url=item.get("authorUrl") or item.get("author", {}).get("url"),
                    author_headline=item.get("authorHeadline") or item.get("author", {}).get("headline"),
                    author_company=item.get("authorCompany") or item.get("company"),
                    likes_count=item.get("likesCount") or item.get("likes") or 0,
                    comments_count=item.get("commentsCount") or item.get("comments") or 0,
                    shares_count=item.get("sharesCount") or item.get("shares") or 0,
                    raw_data=item,
                )
                db.add(scraping_result)
                saved_count += 1

            # Update run with results count
            run.results_count = saved_count
            run.status = RunStatus.SUCCEEDED
            run.finished_at = datetime.utcnow()

            await db.commit()
            logger.info(f"Saved {saved_count} results for run {run_id}")
            return saved_count

        except Exception as e:
            logger.error(f"Failed to fetch results: {e}")
            run.status = RunStatus.FAILED
            run.error_message = str(e)
            await db.commit()
            raise

    def _parse_date(self, date_str: Optional[str]) -> Optional[datetime]:
        """Parse date string to datetime"""
        if not date_str:
            return None
        try:
            # Try ISO format
            return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            return None

    async def get_run(self, db: AsyncSession, run_id: int) -> Optional[ScrapingRun]:
        """Get a scraping run by ID"""
        result = await db.execute(select(ScrapingRun).where(ScrapingRun.id == run_id))
        return result.scalar_one_or_none()

    async def get_runs(
        self, db: AsyncSession, page: int = 1, page_size: int = 20
    ) -> tuple[List[ScrapingRun], int]:
        """Get paginated list of scraping runs"""
        # Get total count
        count_result = await db.execute(select(func.count(ScrapingRun.id)))
        total = count_result.scalar()

        # Get paginated runs
        offset = (page - 1) * page_size
        result = await db.execute(
            select(ScrapingRun)
            .order_by(ScrapingRun.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        runs = result.scalars().all()

        return list(runs), total

    async def get_results(
        self, db: AsyncSession, run_id: int, page: int = 1, page_size: int = 50
    ) -> tuple[List[ScrapingResult], int]:
        """Get paginated results for a run"""
        # Get total count
        count_result = await db.execute(
            select(func.count(ScrapingResult.id)).where(ScrapingResult.run_id == run_id)
        )
        total = count_result.scalar()

        # Get paginated results
        offset = (page - 1) * page_size
        result = await db.execute(
            select(ScrapingResult)
            .where(ScrapingResult.run_id == run_id)
            .order_by(ScrapingResult.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        results = result.scalars().all()

        return list(results), total

    async def abort_run(self, db: AsyncSession, run_id: int) -> ScrapingRun:
        """Abort a running Apify actor"""
        result = await db.execute(select(ScrapingRun).where(ScrapingRun.id == run_id))
        run = result.scalar_one_or_none()
        if not run:
            raise ValueError(f"Run {run_id} not found")

        if run.apify_run_id and run.status == RunStatus.RUNNING:
            try:
                self.client.run(run.apify_run_id).abort()
                run.status = RunStatus.ABORTED
                run.finished_at = datetime.utcnow()
                await db.commit()
                await db.refresh(run)
            except Exception as e:
                logger.error(f"Failed to abort run: {e}")
                raise

        return run


# Global service instance
apify_service = ApifyService()
