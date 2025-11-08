"""
Performance Monitoring Service
Monitors response times and ensures 5-second SLA for 95% of operations
"""

from typing import Dict, Any, List, Optional, Callable
import asyncio
import time
import logging
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import statistics
import json
from collections import deque

from .memory_monitor import get_memory_monitor
from .redis_cache import RedisCacheService

logger = logging.getLogger(__name__)


class AlertSeverity(Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class PerformanceMetric:
    operation: str
    duration: float
    timestamp: datetime
    status: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PerformanceAlert:
    severity: AlertSeverity
    message: str
    operation: str
    current_value: float
    threshold: float
    timestamp: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)


class PerformanceMonitor:
    """
    Monitors application performance and ensures SLA compliance
    """

    def __init__(
        self, config: Dict[str, Any], redis_service: Optional[RedisCacheService] = None
    ):
        self.config = config
        self.redis = redis_service

        # SLA Configuration
        self.response_time_sla = config.get("response_time_sla", 5.0)  # 5 seconds
        self.sla_compliance_threshold = config.get(
            "sla_compliance_threshold", 0.95
        )  # 95%
        self.max_response_time = config.get("max_response_time", 10.0)  # 10 seconds
        self.slow_query_threshold = config.get("slow_query_threshold", 1.0)  # 1 second

        # Monitoring configuration
        self.metrics_retention_hours = config.get("metrics_retention_hours", 24)
        self.max_metrics_per_operation = config.get("max_metrics_per_operation", 1000)
        self.alert_cooldown_minutes = config.get("alert_cooldown_minutes", 5)

        # Metrics storage
        self.metrics: Dict[str, deque] = {}
        self.alerts_history: List[PerformanceAlert] = []

        # Performance tracking
        self.slow_operations: deque = deque(maxlen=100)
        self.operation_stats: Dict[str, Dict[str, Any]] = {}

        # Alert callbacks
        self.alert_callbacks: List[Callable[[PerformanceAlert], None]] = []
        self.last_alert_times: Dict[str, datetime] = {}

        # Background monitoring
        self.is_monitoring = False
        self.monitoring_task: Optional[asyncio.Task] = None

    def register_alert_callback(self, callback: Callable[[PerformanceAlert], None]):
        """
        Register callback for performance alerts

        Args:
            callback: Function to call when alert is raised
        """
        self.alert_callbacks.append(callback)
        logger.debug("Registered performance alert callback")

    async def record_metric(
        self,
        operation: str,
        duration: float,
        status: str = "success",
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """
        Record performance metric

        Args:
            operation: Operation name
            duration: Execution duration in seconds
            status: Operation status
            metadata: Additional metadata
        """
        metric = PerformanceMetric(
            operation=operation,
            duration=duration,
            timestamp=datetime.now(),
            status=status,
            metadata=metadata or {},
        )

        # Store metric
        if operation not in self.metrics:
            self.metrics[operation] = deque(maxlen=self.max_metrics_per_operation)

        self.metrics[operation].append(metric)

        # Update statistics
        self._update_operation_stats(operation, metric)

        # Check for alerts
        await self._check_alerts(operation, duration)

        # Track slow operations
        if duration > self.slow_query_threshold:
            self.slow_operations.append(metric)
            logger.warning(
                f"Slow operation detected: {operation} took {duration:.2f}s "
                f"(threshold: {self.slow_query_threshold}s)"
            )

        # Store in Redis for persistence
        if self.redis:
            try:
                await self.redis.set(
                    "performance",
                    f"{operation}:{metric.timestamp.isoformat()}",
                    {
                        "operation": operation,
                        "duration": duration,
                        "status": status,
                        "metadata": metadata,
                    },
                    ttl=self.metrics_retention_hours * 3600,
                )
            except Exception as e:
                logger.error(f"Error storing metric in Redis: {str(e)}")

    def _update_operation_stats(self, operation: str, metric: PerformanceMetric):
        """Update operation statistics"""
        if operation not in self.operation_stats:
            self.operation_stats[operation] = {
                "count": 0,
                "total_duration": 0.0,
                "min_duration": float("inf"),
                "max_duration": 0.0,
                "avg_duration": 0.0,
                "success_count": 0,
                "error_count": 0,
                "p50": 0.0,
                "p90": 0.0,
                "p95": 0.0,
                "p99": 0.0,
            }

        stats = self.operation_stats[operation]
        stats["count"] += 1
        stats["total_duration"] += metric.duration

        if metric.status == "success":
            stats["success_count"] += 1
        else:
            stats["error_count"] += 1

        # Update min/max
        if metric.duration < stats["min_duration"]:
            stats["min_duration"] = metric.duration
        if metric.duration > stats["max_duration"]:
            stats["max_duration"] = metric.duration

        # Update average
        stats["avg_duration"] = stats["total_duration"] / stats["count"]

        # Update percentiles (if we have enough data)
        if operation in self.metrics and len(self.metrics[operation]) >= 10:
            durations = [m.duration for m in self.metrics[operation]]
            durations.sort()
            n = len(durations)

            stats["p50"] = durations[int(n * 0.5)]
            stats["p90"] = durations[int(n * 0.9)]
            stats["p95"] = durations[int(n * 0.95)]
            stats["p99"] = durations[int(n * 0.99)]

    async def _check_alerts(self, operation: str, duration: float):
        """Check if alert should be raised"""
        alerts_to_raise = []

        # Check response time SLA
        if duration > self.response_time_sla:
            alerts_to_raise.append(
                PerformanceAlert(
                    severity=AlertSeverity.CRITICAL,
                    message=f"Response time SLA breach: {operation} took {duration:.2f}s (SLA: {self.response_time_sla}s)",
                    operation=operation,
                    current_value=duration,
                    threshold=self.response_time_sla,
                    timestamp=datetime.now(),
                )
            )

        # Check for gradual degradation
        if operation in self.operation_stats:
            stats = self.operation_stats[operation]
            if stats["avg_duration"] > self.response_time_sla * 0.8:  # 80% of SLA
                alerts_to_raise.append(
                    PerformanceAlert(
                        severity=AlertSeverity.WARNING,
                        message=f"Performance degradation: {operation} avg duration {stats['avg_duration']:.2f}s",
                        operation=operation,
                        current_value=stats["avg_duration"],
                        threshold=self.response_time_sla * 0.8,
                        timestamp=datetime.now(),
                    )
                )

        # Check error rate
        if operation in self.operation_stats:
            stats = self.operation_stats[operation]
            if stats["count"] > 10:
                error_rate = stats["error_count"] / stats["count"]
                if error_rate > 0.05:  # 5% error rate
                    alerts_to_raise.append(
                        PerformanceAlert(
                            severity=AlertSeverity.CRITICAL,
                            message=f"High error rate: {operation} has {error_rate * 100:.1f}% errors",
                            operation=operation,
                            current_value=error_rate,
                            threshold=0.05,
                            timestamp=datetime.now(),
                        )
                    )

        # Raise alerts (with cooldown)
        for alert in alerts_to_raise:
            await self._raise_alert(alert)

    async def _raise_alert(self, alert: PerformanceAlert):
        """Raise performance alert"""
        # Check cooldown
        alert_key = f"{alert.operation}:{alert.severity.value}"
        now = datetime.now()

        if alert_key in self.last_alert_times:
            last_alert = self.last_alert_times[alert_key]
            cooldown_period = timedelta(minutes=self.alert_cooldown_minutes)

            if now - last_alert < cooldown_period:
                return  # Still in cooldown

        # Store alert
        self.alerts_history.append(alert)
        self.last_alert_times[alert_key] = now

        # Log alert
        log_level = {
            AlertSeverity.INFO: logging.INFO,
            AlertSeverity.WARNING: logging.WARNING,
            AlertSeverity.CRITICAL: logging.CRITICAL,
        }[alert.severity]

        logger.log(
            log_level,
            f"Performance Alert [{alert.severity.value.upper()}]: {alert.message}",
        )

        # Call callbacks
        for callback in self.alert_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    asyncio.create_task(callback(alert))
                else:
                    callback(alert)
            except Exception as e:
                logger.error(f"Error in alert callback: {str(e)}")

    async def get_sla_compliance(
        self, operation: Optional[str] = None, hours: int = 1
    ) -> Dict[str, Any]:
        """
        Get SLA compliance for operations

        Args:
            operation: Specific operation (None for all)
            hours: Time window in hours

        Returns:
            SLA compliance data
        """
        cutoff = datetime.now() - timedelta(hours=hours)
        operations = [operation] if operation else list(self.metrics.keys())

        compliance_data = {}
        total_operations = 0
        compliant_operations = 0

        for op in operations:
            if op not in self.metrics:
                continue

            # Filter metrics by time
            recent_metrics = [m for m in self.metrics[op] if m.timestamp >= cutoff]

            if not recent_metrics:
                continue

            # Count compliant operations
            compliant = sum(
                1 for m in recent_metrics if m.duration <= self.response_time_sla
            )
            total = len(recent_metrics)
            compliance_rate = (compliant / total) if total > 0 else 0

            compliance_data[op] = {
                "total_operations": total,
                "compliant_operations": compliant,
                "compliance_rate": round(compliance_rate * 100, 2),
                "meets_sla": compliance_rate >= self.sla_compliance_threshold,
                "avg_duration": round(
                    statistics.mean([m.duration for m in recent_metrics]), 3
                ),
                "p95_duration": round(
                    self._calculate_percentile(recent_metrics, 95), 3
                ),
            }

            total_operations += total
            if compliance_rate >= self.sla_compliance_threshold:
                compliant_operations += 1

        # Overall compliance
        overall_compliance = (
            (compliant_operations / len(operations)) if operations else 0
        )

        return {
            "sla_threshold": f"{self.sla_compliance_threshold * 100}%",
            "response_time_sla": f"{self.response_time_sla}s",
            "overall_compliance": round(overall_compliance * 100, 2),
            "meets_overall_sla": overall_compliance >= self.sla_compliance_threshold,
            "operations_analyzed": len(operations),
            "time_window_hours": hours,
            "operation_details": compliance_data,
        }

    async def get_performance_summary(self, hours: int = 1) -> Dict[str, Any]:
        """
        Get performance summary

        Args:
            hours: Time window in hours

        Returns:
            Performance summary
        """
        cutoff = datetime.now() - timedelta(hours=hours)

        # Calculate overall statistics
        all_durations = []
        total_operations = 0
        successful_operations = 0
        error_count = 0

        operation_summaries = {}

        for operation, metrics_queue in self.metrics.items():
            # Filter by time
            recent_metrics = [m for m in metrics_queue if m.timestamp >= cutoff]

            if not recent_metrics:
                continue

            # Calculate operation stats
            durations = [m.duration for m in recent_metrics]
            all_durations.extend(durations)

            success_count = sum(1 for m in recent_metrics if m.status == "success")
            error_count_op = len(recent_metrics) - success_count

            operation_summaries[operation] = {
                "total_requests": len(recent_metrics),
                "success_count": success_count,
                "error_count": error_count_op,
                "success_rate": round((success_count / len(recent_metrics)) * 100, 2),
                "avg_duration": round(statistics.mean(durations), 3),
                "min_duration": round(min(durations), 3),
                "max_duration": round(max(durations), 3),
                "p50": round(self._calculate_percentile(recent_metrics, 50), 3),
                "p95": round(self._calculate_percentile(recent_metrics, 95), 3),
                "p99": round(self._calculate_percentile(recent_metrics, 99), 3),
            }

            total_operations += len(recent_metrics)
            successful_operations += success_count
            error_count += error_count_op

        # Overall stats
        if all_durations:
            overall_stats = {
                "total_operations": total_operations,
                "successful_operations": successful_operations,
                "error_count": error_count,
                "success_rate": round(
                    (successful_operations / total_operations) * 100, 2
                ),
                "avg_duration": round(statistics.mean(all_durations), 3),
                "median_duration": round(statistics.median(all_durations), 3),
                "p95_duration": round(self._calculate_percentile(all_durations, 95), 3),
                "p99_duration": round(self._calculate_percentile(all_durations, 99), 3),
                "operations_under_sla": sum(
                    1 for d in all_durations if d <= self.response_time_sla
                ),
                "sla_compliance_rate": round(
                    (
                        sum(1 for d in all_durations if d <= self.response_time_sla)
                        / len(all_durations)
                    )
                    * 100,
                    2,
                ),
            }
        else:
            overall_stats = {
                "total_operations": 0,
                "successful_operations": 0,
                "error_count": 0,
                "success_rate": 0,
                "avg_duration": 0,
                "median_duration": 0,
                "p95_duration": 0,
                "p99_duration": 0,
                "operations_under_sla": 0,
                "sla_compliance_rate": 0,
            }

        return {
            "time_window_hours": hours,
            "overall": overall_stats,
            "operations": operation_summaries,
            "slow_operations_count": len(self.slow_operations),
            "recent_alerts": len(
                [a for a in self.alerts_history if a.timestamp >= cutoff]
            ),
        }

    async def get_slow_operations(self, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Get slowest operations

        Args:
            limit: Maximum number to return

        Returns:
            List of slow operations
        """
        return [
            {
                "operation": metric.operation,
                "duration": metric.duration,
                "timestamp": metric.timestamp.isoformat(),
                "status": metric.status,
                "metadata": metric.metadata,
            }
            for metric in list(self.slow_operations)[-limit:]
        ]

    async def get_alerts_history(
        self, severity: Optional[AlertSeverity] = None, hours: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Get alerts history

        Args:
            severity: Filter by severity
            hours: Filter by hours (e.g., last 24 hours)

        Returns:
            List of alerts
        """
        alerts = self.alerts_history.copy()

        # Filter by severity
        if severity:
            alerts = [a for a in alerts if a.severity == severity]

        # Filter by time
        if hours:
            cutoff = datetime.now() - timedelta(hours=hours)
            alerts = [a for a in alerts if a.timestamp >= cutoff]

        return [
            {
                "severity": alert.severity.value,
                "message": alert.message,
                "operation": alert.operation,
                "current_value": alert.current_value,
                "threshold": alert.threshold,
                "timestamp": alert.timestamp.isoformat(),
                "metadata": alert.metadata,
            }
            for alert in alerts
        ]

    def _calculate_percentile(self, data: List, percentile: int) -> float:
        """Calculate percentile from data"""
        if not data:
            return 0.0

        sorted_data = sorted(data)
        index = (percentile / 100) * len(sorted_data)

        if index.is_integer():
            return sorted_data[int(index) - 1]
        else:
            lower = sorted_data[int(index)]
            upper = sorted_data[min(int(index) + 1, len(sorted_data) - 1)]
            return lower + (upper - lower) * (index - int(index))

    def _calculate_percentile_metrics(
        self, metrics: List[PerformanceMetric], percentile: int
    ) -> float:
        """Calculate percentile from PerformanceMetric list"""
        durations = [m.duration for m in metrics]
        return self._calculate_percentile(durations, percentile)

    async def start_monitoring(self):
        """Start background performance monitoring"""
        if self.is_monitoring:
            logger.warning("Performance monitoring is already running")
            return

        self.is_monitoring = True
        logger.info("Starting performance monitoring")

        self.monitoring_task = asyncio.create_task(self._monitoring_loop())

    async def stop_monitoring(self):
        """Stop background performance monitoring"""
        if not self.is_monitoring:
            return

        self.is_monitoring = False
        logger.info("Stopping performance monitoring")

        if self.monitoring_task:
            self.monitoring_task.cancel()
            try:
                await self.monitoring_task
            except asyncio.CancelledError:
                pass

    async def _monitoring_loop(self):
        """Background monitoring loop"""
        while self.is_monitoring:
            try:
                # Check memory usage
                try:
                    memory_monitor = get_memory_monitor()
                    memory_info = await memory_monitor.get_memory_info()
                    usage_percent = memory_info.get("usage_percent", 0)

                    if usage_percent > 90:
                        await self._raise_alert(
                            PerformanceAlert(
                                severity=AlertSeverity.CRITICAL,
                                message=f"High memory usage: {usage_percent}%",
                                operation="system",
                                current_value=usage_percent,
                                threshold=90,
                                timestamp=datetime.now(),
                            )
                        )
                except Exception as e:
                    logger.error(f"Error checking memory: {str(e)}")

                # Check SLA compliance
                compliance = await self.get_sla_compliance()
                if not compliance["meets_overall_sla"]:
                    await self._raise_alert(
                        PerformanceAlert(
                            severity=AlertSeverity.CRITICAL,
                            message=f"SLA compliance breach: {compliance['overall_compliance']}%",
                            operation="system",
                            current_value=compliance["overall_compliance"],
                            threshold=self.sla_compliance_threshold * 100,
                            timestamp=datetime.now(),
                        )
                    )

                # Clean up old metrics
                await self._cleanup_old_metrics()

                await asyncio.sleep(60)  # Check every minute

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in monitoring loop: {str(e)}")
                await asyncio.sleep(60)

    async def _cleanup_old_metrics(self):
        """Clean up old metrics"""
        cutoff = datetime.now() - timedelta(hours=self.metrics_retention_hours)

        for operation, metrics_queue in self.metrics.items():
            # Remove old metrics
            while metrics_queue and metrics_queue[0].timestamp < cutoff:
                metrics_queue.popleft()


# Global performance monitor instance
performance_monitor: Optional[PerformanceMonitor] = None


def get_performance_monitor() -> PerformanceMonitor:
    """Get global performance monitor instance"""
    global performance_monitor
    if performance_monitor is None:
        raise RuntimeError("Performance monitor not initialized")
    return performance_monitor


def init_performance_monitor(
    config: Dict[str, Any], redis_service: Optional[RedisCacheService] = None
):
    """Initialize global performance monitor"""
    global performance_monitor
    performance_monitor = PerformanceMonitor(config, redis_service)
    logger.info("Performance monitor initialized")
