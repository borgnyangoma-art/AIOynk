"""
Background Job Queue Service
Manages background job processing with priority and resource management
"""

from typing import Dict, Any, List, Optional, Callable, Awaitable
import asyncio
import logging
import time
import uuid
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
from queue import PriorityQueue
import json

from .resource_prioritizer import ResourcePrioritizer, Priority, ResourceType

logger = logging.getLogger(__name__)


class JobStatus(Enum):
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"


class JobPriority(Enum):
    CRITICAL = 0
    HIGH = 1
    NORMAL = 2
    LOW = 3
    DEFERRED = 4


@dataclass
class Job:
    job_id: str
    name: str
    func: Callable
    args: tuple = field(default_factory=tuple)
    kwargs: dict = field(default_factory=dict)
    priority: JobPriority = JobPriority.NORMAL
    max_retries: int = 3
    retry_delay: int = 60  # seconds
    timeout: int = 300  # 5 minutes
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: JobStatus = JobStatus.PENDING
    retry_count: int = 0
    error: Optional[str] = None
    result: Any = None
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Convert job to dictionary for serialization"""
        return {
            "job_id": self.job_id,
            "name": self.name,
            "priority": self.priority.name,
            "status": self.status.value,
            "retry_count": self.retry_count,
            "max_retries": self.max_retries,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat()
            if self.completed_at
            else None,
            "error": self.error,
            "metadata": self.metadata,
        }


class BackgroundJobQueue:
    """
    Manages background job processing
    """

    def __init__(
        self,
        config: Dict[str, Any],
        resource_prioritizer: Optional[ResourcePrioritizer] = None,
    ):
        self.config = config
        self.resource_prioritizer = resource_prioritizer

        # Queue configuration
        self.max_workers = config.get("max_workers", 10)
        self.max_queue_size = config.get("max_queue_size", 1000)
        self.worker_timeout = config.get("worker_timeout", 60)

        # Job queues by priority
        self.job_queues = {
            JobPriority.CRITICAL: asyncio.Queue(maxsize=self.max_queue_size),
            JobPriority.HIGH: asyncio.Queue(maxsize=self.max_queue_size),
            JobPriority.NORMAL: asyncio.Queue(maxsize=self.max_queue_size),
            JobPriority.LOW: asyncio.Queue(maxsize=self.max_queue_size),
            JobPriority.DEFERRED: asyncio.Queue(maxsize=self.max_queue_size),
        }

        # Job tracking
        self.jobs: Dict[str, Job] = {}
        self.active_workers: Dict[str, asyncio.Task] = {}
        self.completed_jobs: List[Job] = []

        # Statistics
        self.stats = {
            "jobs_submitted": 0,
            "jobs_completed": 0,
            "jobs_failed": 0,
            "jobs_retried": 0,
            "avg_execution_time": 0.0,
            "total_execution_time": 0.0,
            "queue_sizes": {
                "critical": 0,
                "high": 0,
                "normal": 0,
                "low": 0,
                "deferred": 0,
            },
        }

        # Event callbacks
        self.job_callbacks: Dict[str, List[Callable]] = {
            "on_start": [],
            "on_complete": [],
            "on_fail": [],
            "on_retry": [],
        }

    def register_callback(self, event: str, callback: Callable):
        """
        Register job event callback

        Args:
            event: Event name (on_start, on_complete, on_fail, on_retry)
            callback: Callback function
        """
        if event in self.job_callbacks:
            self.job_callbacks[event].append(callback)
            logger.debug(f"Registered callback for event: {event}")

    async def enqueue(
        self,
        func: Callable,
        name: str,
        *args,
        priority: JobPriority = JobPriority.NORMAL,
        max_retries: int = 3,
        retry_delay: int = 60,
        timeout: int = 300,
        **kwargs,
    ) -> str:
        """
        Enqueue background job

        Args:
            func: Async function to execute
            name: Job name
            *args: Function arguments
            priority: Job priority
            max_retries: Maximum retry attempts
            retry_delay: Delay between retries (seconds)
            timeout: Job timeout (seconds)
            **kwargs: Function keyword arguments

        Returns:
            Job ID
        """
        # Validate function
        if not asyncio.iscoroutinefunction(func):
            raise ValueError("Job function must be an async function")

        # Create job
        job_id = str(uuid.uuid4())
        job = Job(
            job_id=job_id,
            name=name,
            func=func,
            args=args,
            kwargs=kwargs,
            priority=priority,
            max_retries=max_retries,
            retry_delay=retry_delay,
            timeout=timeout,
        )

        # Store job
        self.jobs[job_id] = job
        self.stats["jobs_submitted"] += 1

        # Add to queue
        queue = self.job_queues[priority]
        try:
            await queue.put(job)
            job.status = JobStatus.QUEUED
            logger.info(f"Job enqueued: {job_id} ({name}, {priority.name})")
        except asyncio.QueueFull:
            logger.error(f"Queue full, rejecting job: {job_id}")
            job.status = JobStatus.FAILED
            job.error = "Queue full"
            return job_id

        # Process queue
        asyncio.create_task(self._process_queue())

        return job_id

    async def _process_queue(self):
        """Process job queue"""
        # Check if we need more workers
        if len(self.active_workers) >= self.max_workers:
            return

        # Check each priority queue (highest first)
        for priority in [
            JobPriority.CRITICAL,
            JobPriority.HIGH,
            JobPriority.NORMAL,
            JobPriority.LOW,
            JobPriority.DEFERRED,
        ]:
            queue = self.job_queues[priority]

            # Try to get a job
            try:
                job = queue.get_nowait()
                self.stats["queue_sizes"][priority.name.lower()] = queue.qsize()

                # Start worker for this job
                worker_task = asyncio.create_task(self._run_job(job))
                self.active_workers[job.job_id] = worker_task

                logger.debug(f"Started worker for job: {job.job_id}")

                # Only start one job per cycle
                break

            except asyncio.QueueEmpty:
                continue

    async def _run_job(self, job: Job):
        """
        Run a background job

        Args:
            job: Job to run
        """
        try:
            # Update job status
            job.status = JobStatus.RUNNING
            job.started_at = datetime.now()
            self._notify_callbacks("on_start", job)

            # Request resources if prioritizer is available
            if self.resource_prioritizer:
                resource_id = await self.resource_prioritizer.request_resource(
                    resource_type=ResourceType.CPU,
                    priority=Priority.NORMAL
                    if job.priority == JobPriority.NORMAL
                    else Priority.HIGH,
                    required_amount=10.0,  # 10% CPU
                    estimated_duration=job.timeout,
                )

            # Execute job with timeout
            start_time = time.time()

            try:
                if job.timeout:
                    result = await asyncio.wait_for(
                        job.func(*job.args, **job.kwargs), timeout=job.timeout
                    )
                else:
                    result = await job.func(*job.args, **job.kwargs)

                job.result = result
                job.status = JobStatus.COMPLETED

                execution_time = time.time() - start_time
                self._update_execution_stats(execution_time)

                self.stats["jobs_completed"] += 1

                logger.info(
                    f"Job completed: {job.job_id} ({job.name}) in {execution_time:.2f}s"
                )

            except asyncio.TimeoutError:
                job.error = f"Job timed out after {job.timeout}s"
                job.status = JobStatus.FAILED
                self.stats["jobs_failed"] += 1
                logger.error(f"Job timed out: {job.job_id}")

            except Exception as e:
                job.error = str(e)
                await self._handle_job_error(job)

            # Complete job
            job.completed_at = datetime.now()
            self._notify_callbacks("on_complete", job)

            # Release resources
            if self.resource_prioritizer and "resource_id" in locals():
                await self.resource_prioritizer.release_resource(resource_id)

            # Move to completed
            self.completed_jobs.append(job)
            if job.job_id in self.jobs:
                del self.jobs[job.job_id]

            # Remove from active workers
            if job.job_id in self.active_workers:
                del self.active_workers[job.job_id]

            # Process more jobs
            await self._process_queue()

        except Exception as e:
            logger.error(f"Error running job {job.job_id}: {str(e)}")
            job.error = str(e)
            job.status = JobStatus.FAILED
            self.completed_jobs.append(job)

            if job.job_id in self.active_workers:
                del self.active_workers[job.job_id]

    async def _handle_job_error(self, job: Job):
        """
        Handle job execution error and retry if necessary

        Args:
            job: Failed job
        """
        if job.retry_count < job.max_retries:
            job.retry_count += 1
            job.status = JobStatus.RETRYING
            self.stats["jobs_retried"] += 1

            logger.warning(
                f"Job failed, retrying: {job.job_id} "
                f"(attempt {job.retry_count}/{job.max_retries})"
            )

            self._notify_callbacks("on_retry", job)

            # Re-queue after delay
            await asyncio.sleep(job.retry_delay)

            # Re-add to queue
            queue = self.job_queues[job.priority]
            try:
                await queue.put(job)
                job.status = JobStatus.QUEUED
            except asyncio.QueueFull:
                job.status = JobStatus.FAILED
                job.error = "Queue full on retry"
        else:
            job.status = JobStatus.FAILED
            self.stats["jobs_failed"] += 1
            logger.error(f"Job failed after {job.max_retries} retries: {job.job_id}")
            self._notify_callbacks("on_fail", job)

    def _update_execution_stats(self, execution_time: float):
        """Update execution time statistics"""
        self.stats["total_execution_time"] += execution_time

        # Update average using exponential moving average
        alpha = 0.1
        if self.stats["avg_execution_time"] == 0:
            self.stats["avg_execution_time"] = execution_time
        else:
            self.stats["avg_execution_time"] = (
                alpha * execution_time + (1 - alpha) * self.stats["avg_execution_time"]
            )

    def _notify_callbacks(self, event: str, job: Job):
        """Notify registered callbacks"""
        if event in self.job_callbacks:
            for callback in self.job_callbacks[event]:
                try:
                    if asyncio.iscoroutinefunction(callback):
                        asyncio.create_task(callback(job))
                    else:
                        callback(job)
                except Exception as e:
                    logger.error(f"Error in {event} callback: {str(e)}")

    async def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Get job status

        Args:
            job_id: Job ID

        Returns:
            Job status dictionary
        """
        # Check active jobs
        if job_id in self.jobs:
            return self.jobs[job_id].to_dict()

        # Check completed jobs
        for job in self.completed_jobs:
            if job.job_id == job_id:
                return job.to_dict()

        return None

    async def cancel_job(self, job_id: str) -> bool:
        """
        Cancel pending/running job

        Args:
            job_id: Job ID

        Returns:
            True if cancelled
        """
        # Cancel running job
        if job_id in self.active_workers:
            worker_task = self.active_workers[job_id]
            worker_task.cancel()

            if job_id in self.jobs:
                job = self.jobs[job_id]
                job.status = JobStatus.CANCELLED
                job.completed_at = datetime.now()

                logger.info(f"Job cancelled: {job_id}")
                return True

        # Note: Cannot easily cancel queued jobs from asyncio.Queue
        # In a production system, would use a custom queue implementation

        return False

    async def get_queue_status(self) -> Dict[str, Any]:
        """
        Get queue status

        Returns:
            Queue status
        """
        return {
            "max_workers": self.max_workers,
            "active_workers": len(self.active_workers),
            "total_jobs": len(self.jobs) + len(self.completed_jobs),
            "pending_jobs": sum(queue.qsize() for queue in self.job_queues.values()),
            "running_jobs": len(self.active_workers),
            "completed_jobs": len(self.completed_jobs),
            "queue_sizes": {
                priority.name.lower(): queue.qsize()
                for priority, queue in self.job_queues.items()
            },
        }

    async def get_stats(self) -> Dict[str, Any]:
        """
        Get job queue statistics

        Returns:
            Statistics
        """
        return {
            "jobs_submitted": self.stats["jobs_submitted"],
            "jobs_completed": self.stats["jobs_completed"],
            "jobs_failed": self.stats["jobs_failed"],
            "jobs_retried": self.stats["jobs_retried"],
            "success_rate": (
                (self.stats["jobs_completed"] / self.stats["jobs_submitted"] * 100)
                if self.stats["jobs_submitted"] > 0
                else 0
            ),
            "avg_execution_time": round(self.stats["avg_execution_time"], 2),
            "total_execution_time": round(self.stats["total_execution_time"], 2),
            "active_workers": len(self.active_workers),
            "completed_jobs": len(self.completed_jobs),
        }

    async def cleanup_completed_jobs(self, max_age_hours: int = 24) -> int:
        """
        Clean up old completed jobs

        Args:
            max_age_hours: Maximum age in hours

        Returns:
            Number of jobs cleaned
        """
        cutoff = datetime.now() - timedelta(hours=max_age_hours)

        initial_count = len(self.completed_jobs)
        self.completed_jobs = [
            job
            for job in self.completed_jobs
            if job.completed_at and job.completed_at > cutoff
        ]

        cleaned = initial_count - len(self.completed_jobs)

        if cleaned > 0:
            logger.info(f"Cleaned up {cleaned} old completed jobs")

        return cleaned


# Global job queue instance
job_queue: Optional[BackgroundJobQueue] = None


def get_job_queue() -> BackgroundJobQueue:
    """Get global job queue instance"""
    global job_queue
    if job_queue is None:
        raise RuntimeError("Job queue not initialized")
    return job_queue


def init_job_queue(
    config: Dict[str, Any], resource_prioritizer: Optional[ResourcePrioritizer] = None
):
    """Initialize global job queue"""
    global job_queue
    job_queue = BackgroundJobQueue(config, resource_prioritizer)
    logger.info("Background job queue initialized")
