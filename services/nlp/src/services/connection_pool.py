"""
Database Connection Pool Service
Manages connection pooling for database queries
"""

from typing import Any, Dict, List, Optional
import logging
import asyncio
from datetime import datetime, timedelta
import asyncpg
import asyncpg.pool
import time

logger = logging.getLogger(__name__)


class ConnectionPoolManager:
    """
    Manages database connection pooling
    """

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.pools: Dict[str, asyncpg.pool.Pool] = {}

        # Pool configurations
        self.pool_configs = {
            "default": {
                "min_size": 5,
                "max_size": 20,
                "max_queries": 50000,
                "max_inactive_connection_lifetime": 300.0,
                "command_timeout": 60,
                "server_settings": {"jit": "off"},
            },
            "read_replica": {
                "min_size": 3,
                "max_size": 15,
                "max_queries": 50000,
                "max_inactive_connection_lifetime": 300.0,
                "command_timeout": 60,
            },
            "analytics": {
                "min_size": 2,
                "max_size": 10,
                "max_queries": 100000,
                "max_inactive_connection_lifetime": 600.0,
                "command_timeout": 300,
            },
        }

        # Statistics
        self.stats = {
            "pools_created": 0,
            "total_connections": 0,
            "queries_executed": 0,
            "errors": 0,
            "avg_query_time": 0.0,
        }

    async def create_pool(
        self, pool_name: str, dsn: str, config_override: Optional[Dict[str, Any]] = None
    ) -> asyncpg.pool.Pool:
        """
        Create a new connection pool

        Args:
            pool_name: Name of the pool
            dsn: Database connection string
            config_override: Override default config

        Returns:
            Connection pool
        """
        try:
            pool_config = self.pool_configs.get(pool_name, self.pool_configs["default"])
            if config_override:
                pool_config.update(config_override)

            pool = await asyncpg.create_pool(dsn, **pool_config)

            self.pools[pool_name] = pool
            self.stats["pools_created"] += 1
            self.stats["total_connections"] += pool_config["max_size"]

            logger.info(
                f"Created connection pool '{pool_name}' with {pool_config['max_size']} max connections"
            )

            return pool

        except Exception as e:
            logger.error(f"Error creating connection pool '{pool_name}': {str(e)}")
            self.stats["errors"] += 1
            raise

    async def get_pool(self, pool_name: str = "default") -> asyncpg.pool.Pool:
        """
        Get connection pool by name

        Args:
            pool_name: Name of the pool

        Returns:
            Connection pool
        """
        if pool_name not in self.pools:
            raise ValueError(f"Pool '{pool_name}' not found")

        return self.pools[pool_name]

    async def execute_query(
        self,
        query: str,
        pool_name: str = "default",
        *args,
        timeout: Optional[float] = None,
    ) -> Any:
        """
        Execute query using connection pool

        Args:
            query: SQL query
            pool_name: Pool to use
            *args: Query parameters
            timeout: Query timeout

        Returns:
            Query result
        """
        start_time = time.time()

        try:
            pool = await self.get_pool(pool_name)

            async with pool.acquire() as conn:
                if timeout:
                    conn = conn.with_timeout(timeout)

                result = await conn.fetch(query, *args)

                elapsed = time.time() - start_time
                self._update_query_stats(elapsed)

                logger.debug(f"Query executed in {elapsed:.3f}s on pool '{pool_name}'")

                return result

        except Exception as e:
            self.stats["errors"] += 1
            logger.error(f"Query execution error on pool '{pool_name}': {str(e)}")
            raise

    async def execute_transaction(
        self, queries: List[Dict[str, Any]], pool_name: str = "default"
    ) -> List[Any]:
        """
        Execute multiple queries in a transaction

        Args:
            queries: List of query dicts with 'query' and 'args'
            pool_name: Pool to use

        Returns:
            List of query results
        """
        start_time = time.time()

        try:
            pool = await self.get_pool(pool_name)

            async with pool.acquire() as conn:
                async with conn.transaction():
                    results = []

                    for query_data in queries:
                        query = query_data["query"]
                        args = query_data.get("args", [])
                        timeout = query_data.get("timeout")

                        if timeout:
                            conn = conn.with_timeout(timeout)

                        result = await conn.fetch(query, *args)
                        results.append(result)

                    elapsed = time.time() - start_time
                    self._update_query_stats(elapsed)

                    logger.debug(
                        f"Transaction with {len(queries)} queries executed in {elapsed:.3f}s "
                        f"on pool '{pool_name}'"
                    )

                    return results

        except Exception as e:
            self.stats["errors"] += 1
            logger.error(f"Transaction execution error on pool '{pool_name}': {str(e)}")
            raise

    async def fetch_row(
        self,
        query: str,
        pool_name: str = "default",
        *args,
        timeout: Optional[float] = None,
    ) -> Optional[asyncpg.Record]:
        """
        Fetch single row from query

        Args:
            query: SQL query
            pool_name: Pool to use
            *args: Query parameters
            timeout: Query timeout

        Returns:
            Single row or None
        """
        try:
            pool = await self.get_pool(pool_name)

            async with pool.acquire() as conn:
                if timeout:
                    conn = conn.with_timeout(timeout)

                result = await conn.fetchrow(query, *args)

                return result

        except Exception as e:
            self.stats["errors"] += 1
            logger.error(f"Fetch row error on pool '{pool_name}': {str(e)}")
            raise

    async def fetch_val(
        self,
        query: str,
        pool_name: str = "default",
        *args,
        timeout: Optional[float] = None,
    ) -> Any:
        """
        Fetch single value from query

        Args:
            query: SQL query
            pool_name: Pool to use
            *args: Query parameters
            timeout: Query timeout

        Returns:
            Single value
        """
        try:
            pool = await self.get_pool(pool_name)

            async with pool.acquire() as conn:
                if timeout:
                    conn = conn.with_timeout(timeout)

                result = await conn.fetchval(query, *args)

                return result

        except Exception as e:
            self.stats["errors"] += 1
            logger.error(f"Fetch val error on pool '{pool_name}': {str(e)}")
            raise

    async def execute(
        self,
        query: str,
        pool_name: str = "default",
        *args,
        timeout: Optional[float] = None,
    ) -> str:
        """
        Execute command (INSERT, UPDATE, DELETE, etc.)

        Args:
            query: SQL command
            pool_name: Pool to use
            *args: Query parameters
            timeout: Query timeout

        Returns:
            Command result
        """
        try:
            pool = await self.get_pool(pool_name)

            async with pool.acquire() as conn:
                if timeout:
                    conn = conn.with_timeout(timeout)

                result = await conn.execute(query, *args)

                return result

        except Exception as e:
            self.stats["errors"] += 1
            logger.error(f"Execute error on pool '{pool_name}': {str(e)}")
            raise

    async def get_pool_status(self, pool_name: str) -> Dict[str, Any]:
        """
        Get status of a connection pool

        Args:
            pool_name: Pool name

        Returns:
            Pool status
        """
        try:
            pool = await self.get_pool(pool_name)

            return {
                "pool_name": pool_name,
                "size": pool.get_size(),
                "min_size": pool.get_min_size(),
                "max_size": pool.get_max_size(),
                "idle_size": pool.get_idle_size(),
                "busy_size": pool.get_busy_size(),
                "current_connections": pool.get_size(),
                "available_connections": pool.get_idle_size(),
            }

        except Exception as e:
            logger.error(f"Error getting pool status for '{pool_name}': {str(e)}")
            return {"pool_name": pool_name, "error": str(e)}

    async def get_all_pools_status(self) -> Dict[str, Any]:
        """
        Get status of all connection pools

        Returns:
            Status of all pools
        """
        status = {
            "total_pools": len(self.pools),
            "pools": {},
            "overall_stats": self.stats,
        }

        for pool_name in self.pools.keys():
            status["pools"][pool_name] = await self.get_pool_status(pool_name)

        return status

    async def close_pool(self, pool_name: str) -> bool:
        """
        Close connection pool

        Args:
            pool_name: Pool name to close

        Returns:
            True if successful
        """
        try:
            if pool_name in self.pools:
                pool = self.pools.pop(pool_name)
                await pool.close()
                logger.info(f"Closed connection pool '{pool_name}'")
                return True
            else:
                logger.warning(f"Pool '{pool_name}' not found")
                return False

        except Exception as e:
            logger.error(f"Error closing pool '{pool_name}': {str(e)}")
            return False

    async def close_all_pools(self):
        """Close all connection pools"""
        for pool_name in list(self.pools.keys()):
            await self.close_pool(pool_name)

    def _update_query_stats(self, elapsed: float):
        """Update query execution statistics"""
        self.stats["queries_executed"] += 1

        # Update average query time using exponential moving average
        alpha = 0.1  # Smoothing factor
        if self.stats["avg_query_time"] == 0:
            self.stats["avg_query_time"] = elapsed
        else:
            self.stats["avg_query_time"] = (
                alpha * elapsed + (1 - alpha) * self.stats["avg_query_time"]
            )

    async def health_check(self) -> Dict[str, Any]:
        """
        Perform health check on all pools

        Returns:
            Health check result
        """
        start_time = time.time()

        try:
            healthy_pools = 0
            total_pools = len(self.pools)

            for pool_name, pool in self.pools.items():
                try:
                    async with pool.acquire() as conn:
                        await conn.fetchval("SELECT 1")
                    healthy_pools += 1
                except Exception as e:
                    logger.error(f"Pool '{pool_name}' health check failed: {str(e)}")

            latency = (time.time() - start_time) * 1000

            return {
                "status": "healthy" if healthy_pools == total_pools else "degraded",
                "total_pools": total_pools,
                "healthy_pools": healthy_pools,
                "unhealthy_pools": total_pools - healthy_pools,
                "health_check_latency_ms": round(latency, 2),
                "overall_stats": self.stats,
            }

        except Exception as e:
            logger.error(f"Health check error: {str(e)}")
            return {
                "status": "error",
                "error": str(e),
                "health_check_latency_ms": (time.time() - start_time) * 1000,
            }
