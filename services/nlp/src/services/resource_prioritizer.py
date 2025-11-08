"""
Resource Prioritization Service
Manages resource allocation and prioritization across the application
"""

from typing import Dict, Any, List, Optional, Callable
import asyncio
import logging
import time
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
from queue import PriorityQueue
import uuid

logger = logging.getLogger(__name__)


class Priority(Enum):
    CRITICAL = 0
    HIGH = 1
    NORMAL = 2
    LOW = 3
    BACKGROUND = 4


class ResourceType(Enum):
    CPU = "cpu"
    MEMORY = "memory"
    IO = "io"
    NETWORK = "network"
    DATABASE = "database"
    CACHE = "cache"


@dataclass
class ResourceRequest:
    request_id: str
    resource_type: ResourceType
    priority: Priority
    required_amount: float
    estimated_duration: float
    created_at: datetime
    callback: Optional[Callable] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: str = "pending"


class ResourcePrioritizer:
    """
    Manages resource allocation and prioritization
    """

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.max_cpu_percent = config.get("max_cpu_percent", 80)
        self.max_memory_mb = config.get("max_memory_mb", 4096)
        self.max_io_ops = config.get("max_io_ops", 1000)
        self.max_network_connections = config.get("max_network_connections", 100)
        self.max_database_connections = config.get("max_database_connections", 50)

        # Resource pools
        self.resource_pools = {
            ResourceType.CPU: self.max_cpu_percent,
            ResourceType.MEMORY: self.max_memory_mb,
            ResourceType.IO: self.max_io_ops,
            ResourceType.NETWORK: self.max_network_connections,
            ResourceType.DATABASE: self.max_database_connections,
            ResourceType.CACHE: 100,  # 100% cache availability
        }

        # Request tracking
        self.pending_requests: List[ResourceRequest] = []
        self.active_requests: Dict[str, ResourceRequest] = {}
        self.completed_requests: List[ResourceRequest] = []

        # Priority queues (one for each priority level)
        self.priority_queues = {
            Priority.CRITICAL: PriorityQueue(),
            Priority.HIGH: PriorityQueue(),
            Priority.NORMAL: PriorityQueue(),
            Priority.LOW: PriorityQueue(),
            Priority.BACKGROUND: PriorityQueue(),
        }

        # Statistics
        self.stats = {
            "total_requests": 0,
            "approved_requests": 0,
            "rejected_requests": 0,
            "avg_wait_time": 0.0,
            "avg_processing_time": 0.0,
            "resource_utilization": {
                "cpu": 0.0,
                "memory": 0.0,
                "io": 0.0,
                "network": 0.0,
                "database": 0.0,
                "cache": 0.0,
            },
        }

        # Preemption settings
        self.allow_preemption = config.get("allow_preemption", True)
        self.preemption_threshold = config.get("preemption_threshold", 0.9)  # 90%

    async def request_resource(
        self,
        resource_type: ResourceType,
        priority: Priority,
        required_amount: float,
        estimated_duration: float,
        callback: Optional[Callable] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Request resource allocation

        Args:
            resource_type: Type of resource needed
            priority: Request priority
            required_amount: Amount of resource needed
            estimated_duration: Estimated duration in seconds
            callback: Optional callback when granted
            metadata: Additional metadata

        Returns:
            Request ID
        """
        request = ResourceRequest(
            request_id=str(uuid.uuid4()),
            resource_type=resource_type,
            priority=priority,
            required_amount=required_amount,
            estimated_duration=estimated_duration,
            created_at=datetime.now(),
            callback=callback,
            metadata=metadata or {},
        )

        self.pending_requests.append(request)
        self.priority_queues[priority].put((request.created_at.timestamp(), request))
        self.stats["total_requests"] += 1

        logger.info(
            f"Resource request created: {request.request_id} "
            f"({resource_type.value}, {priority.name}, {required_amount})"
        )

        # Try to allocate immediately
        await self._process_queue()

        return request.request_id

    async def _process_queue(self):
        """Process pending resource requests"""
        # Check each priority level (highest first)
        for priority in [
            Priority.CRITICAL,
            Priority.HIGH,
            Priority.NORMAL,
            Priority.LOW,
            Priority.BACKGROUND,
        ]:
            queue = self.priority_queues[priority]
            processed = []

            while not queue.empty():
                _, request = queue.get()
                processed.append(request)

                # Check if request can be granted
                if await self._can_grant_request(request):
                    await self._grant_request(request)
                else:
                    # Re-queue or reject
                    if priority in [Priority.CRITICAL, Priority.HIGH]:
                        # High priority requests wait
                        queue.put((request.created_at.timestamp(), request))
                    else:
                        # Lower priority requests are rejected
                        await self._reject_request(
                            request, "Resource temporarily unavailable"
                        )

                # Only process one request per priority level per cycle
                if request.status != "pending":
                    break

            # Re-queue unprocessed requests
            for request in processed:
                if request.status == "pending":
                    queue.put((request.created_at.timestamp(), request))

    async def _can_grant_request(self, request: ResourceRequest) -> bool:
        """
        Check if resource request can be granted

        Args:
            request: Resource request

        Returns:
            True if can be granted
        """
        resource_type = request.resource_type
        required = request.required_amount
        available = self.resource_pools[resource_type]

        # Check if enough resource is available
        if required > available:
            return False

        # Check if we need to preempt lower priority requests
        if self.allow_preemption and available < required * 1.1:  # 10% buffer
            return await self._check_preemption(request)

        return True

    async def _check_preemption(self, request: ResourceRequest) -> bool:
        """
        Check if we can preempt lower priority requests

        Args:
            request: High priority request

        Returns:
            True if preemption is possible
        """
        if not self.active_requests:
            return False

        # Find lowest priority active request
        preemptable_requests = [
            req
            for req in self.active_requests.values()
            if req.priority.value > request.priority.value
        ]

        if not preemptable_requests:
            return False

        # Sort by priority (lowest first) and creation time
        preemptable_requests.sort(key=lambda r: (r.priority.value, r.created_at))

        # Check if we can free up enough resources
        freed_amount = 0
        for req in preemptable_requests:
            freed_amount += req.required_amount
            if freed_amount >= request.required_amount * 1.1:  # 10% buffer
                # Preempt requests
                for req_to_preempt in preemptable_requests[
                    : preemptable_requests.index(req) + 1
                ]:
                    await self._preempt_request(
                        req_to_preempt,
                        f"Preempted for higher priority request {request.request_id}",
                    )
                return True

        return False

    async def _grant_request(self, request: ResourceRequest):
        """
        Grant resource request

        Args:
            request: Resource request to grant
        """
        try:
            # Update resource pool
            self.resource_pools[request.resource_type] -= request.required_amount

            # Move to active
            request.started_at = datetime.now()
            request.status = "active"
            self.active_requests[request.request_id] = request

            # Remove from pending
            self.pending_requests = [
                r for r in self.pending_requests if r.request_id != request.request_id
            ]

            self.stats["approved_requests"] += 1

            # Schedule completion
            asyncio.create_task(self._wait_for_completion(request))

            logger.info(
                f"Resource granted: {request.request_id} "
                f"({request.resource_type.value}, {request.required_amount})"
            )

            # Call callback if provided
            if request.callback:
                try:
                    request.callback(request.request_id, "granted")
                except Exception as e:
                    logger.error(f"Error in request callback: {str(e)}")

        except Exception as e:
            logger.error(f"Error granting request {request.request_id}: {str(e)}")
            await self._reject_request(request, str(e))

    async def _reject_request(self, request: ResourceRequest, reason: str):
        """
        Reject resource request

        Args:
            request: Resource request to reject
            reason: Rejection reason
        """
        request.status = "rejected"
        request.metadata["rejection_reason"] = reason

        # Remove from pending
        self.pending_requests = [
            r for r in self.pending_requests if r.request_id != request.request_id
        ]

        # Move to completed
        self.completed_requests.append(request)
        self.stats["rejected_requests"] += 1

        logger.warning(f"Resource request rejected: {request.request_id} - {reason}")

        # Call callback if provided
        if request.callback:
            try:
                request.callback(request.request_id, "rejected", reason)
            except Exception as e:
                logger.error(f"Error in request callback: {str(e)}")

    async def _preempt_request(self, request: ResourceRequest, reason: str):
        """
        Preempt active resource request

        Args:
            request: Request to preempt
            reason: Preemption reason
        """
        request.status = "preempted"
        request.metadata["preemption_reason"] = reason

        # Return resources to pool
        self.resource_pools[request.resource_type] += request.required_amount

        # Remove from active
        if request.request_id in self.active_requests:
            del self.active_requests[request.request_id]

        # Move to completed
        self.completed_requests.append(request)

        logger.warning(f"Resource request preempted: {request.request_id} - {reason}")

        # Call callback if provided
        if request.callback:
            try:
                request.callback(request.request_id, "preempted", reason)
            except Exception as e:
                logger.error(f"Error in request callback: {str(e)}")

    async def _wait_for_completion(self, request: ResourceRequest):
        """
        Wait for resource request to complete

        Args:
            request: Active resource request
        """
        try:
            # Wait for estimated duration
            await asyncio.sleep(request.estimated_duration)

            # Auto-complete (in a real system, the actual task would call complete_request)
            await self.release_resource(request.request_id)

        except asyncio.CancelledError:
            logger.info(f"Resource request {request.request_id} was cancelled")
            await self.release_resource(request.request_id)

    async def release_resource(self, request_id: str) -> bool:
        """
        Release resource after use

        Args:
            request_id: ID of the request to release

        Returns:
            True if successful
        """
        try:
            if request_id not in self.active_requests:
                logger.warning(f"Request {request_id} not found in active requests")
                return False

            request = self.active_requests[request_id]

            # Return resources to pool
            self.resource_pools[request.resource_type] += request.required_amount

            # Update request
            request.completed_at = datetime.now()
            request.status = "completed"

            # Move to active
            del self.active_requests[request_id]
            self.completed_requests.append(request)

            # Update statistics
            processing_time = (
                request.completed_at - request.started_at
            ).total_seconds()
            self._update_stats(processing_time, request.priority)

            logger.info(
                f"Resource released: {request_id} "
                f"(processing time: {processing_time:.2f}s)"
            )

            # Process queue for pending requests
            await self._process_queue()

            return True

        except Exception as e:
            logger.error(f"Error releasing resource {request_id}: {str(e)}")
            return False

    def _update_stats(self, processing_time: float, priority: Priority):
        """Update performance statistics"""
        # Update average processing time
        alpha = 0.1
        if self.stats["avg_processing_time"] == 0:
            self.stats["avg_processing_time"] = processing_time
        else:
            self.stats["avg_processing_time"] = (
                alpha * processing_time
                + (1 - alpha) * self.stats["avg_processing_time"]
            )

        # Update resource utilization
        for resource_type, total in self.resource_pools.items():
            if resource_type == ResourceType.CPU:
                used = self.max_cpu_percent - total
                self.stats["resource_utilization"]["cpu"] = (
                    used / self.max_cpu_percent
                ) * 100
            elif resource_type == ResourceType.MEMORY:
                used = self.max_memory_mb - total
                self.stats["resource_utilization"]["memory"] = (
                    used / self.max_memory_mb
                ) * 100

    async def get_request_status(self, request_id: str) -> Optional[Dict[str, Any]]:
        """
        Get status of a resource request

        Args:
            request_id: Request ID

        Returns:
            Request status
        """
        # Check active requests
        if request_id in self.active_requests:
            req = self.active_requests[request_id]
            return {
                "request_id": request_id,
                "status": "active",
                "resource_type": req.resource_type.value,
                "priority": req.priority.name,
                "required_amount": req.required_amount,
                "started_at": req.started_at.isoformat() if req.started_at else None,
                "estimated_duration": req.estimated_duration,
            }

        # Check completed requests
        for req in self.completed_requests:
            if req.request_id == request_id:
                return {
                    "request_id": request_id,
                    "status": req.status,
                    "resource_type": req.resource_type.value,
                    "priority": req.priority.name,
                    "required_amount": req.required_amount,
                    "created_at": req.created_at.isoformat(),
                    "started_at": req.started_at.isoformat()
                    if req.started_at
                    else None,
                    "completed_at": req.completed_at.isoformat()
                    if req.completed_at
                    else None,
                    "metadata": req.metadata,
                }

        # Check pending requests
        for req in self.pending_requests:
            if req.request_id == request_id:
                return {
                    "request_id": request_id,
                    "status": "pending",
                    "resource_type": req.resource_type.value,
                    "priority": req.priority.name,
                    "required_amount": req.required_amount,
                    "created_at": req.created_at.isoformat(),
                    "estimated_duration": req.estimated_duration,
                }

        return None

    async def get_stats(self) -> Dict[str, Any]:
        """
        Get resource prioritization statistics

        Returns:
            Statistics
        """
        return {
            "total_requests": self.stats["total_requests"],
            "approved_requests": self.stats["approved_requests"],
            "rejected_requests": self.stats["rejected_requests"],
            "active_requests": len(self.active_requests),
            "pending_requests": len(self.pending_requests),
            "avg_processing_time": round(self.stats["avg_processing_time"], 2),
            "resource_pools": {
                resource_type.value: {
                    "allocated": round(
                        self.max_cpu_percent - amount
                        if resource_type == ResourceType.CPU
                        else self.max_memory_mb - amount
                        if resource_type == ResourceType.MEMORY
                        else 100 - amount
                        if resource_type == ResourceType.CACHE
                        else 0,
                        2,
                    ),
                    "available": round(amount, 2),
                    "max": self.max_cpu_percent
                    if resource_type == ResourceType.CPU
                    else self.max_memory_mb
                    if resource_type == ResourceType.MEMORY
                    else 100
                    if resource_type == ResourceType.CACHE
                    else self.max_io_ops
                    if resource_type == ResourceType.IO
                    else self.max_network_connections
                    if resource_type == ResourceType.NETWORK
                    else self.max_database_connections,
                }
                for resource_type, amount in self.resource_pools.items()
            },
            "resource_utilization": self.stats["resource_utilization"],
        }


# Global resource prioritizer instance
resource_prioritizer: Optional[ResourcePrioritizer] = None


def get_resource_prioritizer() -> ResourcePrioritizer:
    """Get global resource prioritizer instance"""
    global resource_prioritizer
    if resource_prioritizer is None:
        raise RuntimeError("Resource prioritizer not initialized")
    return resource_prioritizer


def init_resource_prioritizer(config: Dict[str, Any]):
    """Initialize global resource prioritizer"""
    global resource_prioritizer
    resource_prioritizer = ResourcePrioritizer(config)
    logger.info("Resource prioritizer initialized")
