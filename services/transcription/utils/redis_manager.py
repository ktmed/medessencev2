"""
Redis manager for session management and caching
"""

import json
import logging
import pickle
import time
from typing import Any, Dict, List, Optional, Union, Tuple

import redis.asyncio as redis
from redis.asyncio.connection import ConnectionPool

from config import Config, config
from utils.error_handler import ServiceUnavailableError

logger = logging.getLogger(__name__)


class RedisManager:
    """Redis connection and operation manager"""
    
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.connection_pool: Optional[ConnectionPool] = None
        self._connected = False
    
    async def connect(self):
        """Initialize Redis connection"""
        try:
            logger.info("Connecting to Redis...")
            
            # Create connection pool
            self.connection_pool = ConnectionPool.from_url(
                config.redis_url_computed,
                encoding="utf-8",
                decode_responses=False,  # We'll handle encoding manually
                max_connections=20,
                retry_on_timeout=True,
                health_check_interval=30
            )
            
            # Create Redis client
            self.redis_client = redis.Redis(connection_pool=self.connection_pool)
            
            # Test connection
            await self.redis_client.ping()
            self._connected = True
            
            logger.info("Successfully connected to Redis")
            
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self._connected = False
            raise ServiceUnavailableError(
                "Redis connection failed",
                "redis",
                {"error": str(e), "redis_url": config.redis_url_computed}
            )
    
    async def close(self):
        """Close Redis connection"""
        try:
            if self.redis_client:
                await self.redis_client.close()
            if self.connection_pool:
                await self.connection_pool.disconnect()
            self._connected = False
            logger.info("Redis connection closed")
        except Exception as e:
            logger.error(f"Error closing Redis connection: {e}")
    
    async def is_connected(self) -> bool:
        """Check if Redis is connected"""
        if not self._connected or not self.redis_client:
            return False
        
        try:
            await self.redis_client.ping()
            return True
        except Exception:
            self._connected = False
            return False
    
    async def set(self, key: str, value: Any, expiry: Optional[int] = None) -> bool:
        """
        Set a key-value pair in Redis
        
        Args:
            key: Redis key
            value: Value to store (will be serialized)
            expiry: Expiration time in seconds
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if not await self.is_connected():
                raise ServiceUnavailableError("Redis not connected", "redis")
            
            # Serialize value
            serialized_value = await self._serialize_value(value)
            
            # Set with expiry if provided
            if expiry:
                result = await self.redis_client.setex(key, expiry, serialized_value)
            else:
                result = await self.redis_client.set(key, serialized_value)
            
            return bool(result)
            
        except Exception as e:
            logger.error(f"Error setting Redis key {key}: {e}")
            return False
    
    async def get(self, key: str) -> Optional[Any]:
        """
        Get a value from Redis
        
        Args:
            key: Redis key
            
        Returns:
            Deserialized value or None if not found
        """
        try:
            if not await self.is_connected():
                raise ServiceUnavailableError("Redis not connected", "redis")
            
            value = await self.redis_client.get(key)
            
            if value is None:
                return None
            
            # Deserialize value
            return await self._deserialize_value(value)
            
        except Exception as e:
            logger.error(f"Error getting Redis key {key}: {e}")
            return None
    
    async def delete(self, key: str) -> bool:
        """
        Delete a key from Redis
        
        Args:
            key: Redis key to delete
            
        Returns:
            True if key was deleted, False otherwise
        """
        try:
            if not await self.is_connected():
                raise ServiceUnavailableError("Redis not connected", "redis")
            
            result = await self.redis_client.delete(key)
            return result > 0
            
        except Exception as e:
            logger.error(f"Error deleting Redis key {key}: {e}")
            return False
    
    async def exists(self, key: str) -> bool:
        """
        Check if a key exists in Redis
        
        Args:
            key: Redis key to check
            
        Returns:
            True if key exists, False otherwise
        """
        try:
            if not await self.is_connected():
                return False
            
            result = await self.redis_client.exists(key)
            return result > 0
            
        except Exception as e:
            logger.error(f"Error checking Redis key existence {key}: {e}")
            return False
    
    async def expire(self, key: str, seconds: int) -> bool:
        """
        Set expiration time for a key
        
        Args:
            key: Redis key
            seconds: Expiration time in seconds
            
        Returns:
            True if expiration was set, False otherwise
        """
        try:
            if not await self.is_connected():
                return False
            
            result = await self.redis_client.expire(key, seconds)
            return bool(result)
            
        except Exception as e:
            logger.error(f"Error setting expiration for Redis key {key}: {e}")
            return False
    
    async def ttl(self, key: str) -> int:
        """
        Get time to live for a key
        
        Args:
            key: Redis key
            
        Returns:
            TTL in seconds, -1 if no expiry, -2 if key doesn't exist
        """
        try:
            if not await self.is_connected():
                return -2
            
            return await self.redis_client.ttl(key)
            
        except Exception as e:
            logger.error(f"Error getting TTL for Redis key {key}: {e}")
            return -2
    
    async def increment(self, key: str, amount: int = 1) -> Optional[int]:
        """
        Increment a numeric value in Redis
        
        Args:
            key: Redis key
            amount: Amount to increment by
            
        Returns:
            New value after increment, or None if error
        """
        try:
            if not await self.is_connected():
                return None
            
            if amount == 1:
                return await self.redis_client.incr(key)
            else:
                return await self.redis_client.incrby(key, amount)
                
        except Exception as e:
            logger.error(f"Error incrementing Redis key {key}: {e}")
            return None
    
    async def set_with_expiry(self, key: str, value: Any, expiry: int) -> bool:
        """
        Set a key with expiration time
        
        Args:
            key: Redis key
            value: Value to store
            expiry: Expiration time in seconds
            
        Returns:
            True if successful, False otherwise
        """
        return await self.set(key, value, expiry)
    
    async def get_keys_pattern(self, pattern: str) -> List[str]:
        """
        Get keys matching a pattern
        
        Args:
            pattern: Redis key pattern (e.g., "session:*")
            
        Returns:
            List of matching keys
        """
        try:
            if not await self.is_connected():
                return []
            
            keys = await self.redis_client.keys(pattern)
            return [key.decode('utf-8') if isinstance(key, bytes) else key for key in keys]
            
        except Exception as e:
            logger.error(f"Error getting keys with pattern {pattern}: {e}")
            return []
    
    # Session management methods
    async def create_session(self, session_id: str, session_data: Dict) -> bool:
        """Create a new session"""
        session_key = f"session:{session_id}"
        session_data["created_at"] = time.time()
        session_data["last_activity"] = time.time()
        
        return await self.set_with_expiry(
            session_key, session_data, config.SESSION_TIMEOUT
        )
    
    async def get_session(self, session_id: str) -> Optional[Dict]:
        """Get session data"""
        session_key = f"session:{session_id}"
        return await self.get(session_key)
    
    async def update_session(self, session_id: str, updates: Dict) -> bool:
        """Update session data"""
        session_key = f"session:{session_id}"
        
        # Get existing session
        existing_session = await self.get_session(session_id)
        if not existing_session:
            return False
        
        # Update data
        existing_session.update(updates)
        existing_session["last_activity"] = time.time()
        
        # Save back with original TTL
        return await self.set_with_expiry(
            session_key, existing_session, config.SESSION_TIMEOUT
        )
    
    async def delete_session(self, session_id: str) -> bool:
        """Delete a session"""
        session_key = f"session:{session_id}"
        
        # Also delete related data
        pattern = f"transcription:{session_id}:*"
        related_keys = await self.get_keys_pattern(pattern)
        
        # Delete session and related keys
        keys_to_delete = [session_key] + related_keys
        
        try:
            if keys_to_delete:
                result = await self.redis_client.delete(*keys_to_delete)
                return result > 0
            return True
        except Exception as e:
            logger.error(f"Error deleting session {session_id}: {e}")
            return False
    
    async def extend_session(self, session_id: str) -> bool:
        """Extend session expiration"""
        session_key = f"session:{session_id}"
        
        # Update last activity and extend expiration
        await self.update_session(session_id, {"last_activity": time.time()})
        return await self.expire(session_key, config.SESSION_TIMEOUT)
    
    async def get_active_sessions(self) -> List[str]:
        """Get list of active session IDs"""
        pattern = "session:*"
        session_keys = await self.get_keys_pattern(pattern)
        
        # Extract session IDs
        session_ids = []
        for key in session_keys:
            if key.startswith("session:"):
                session_id = key[8:]  # Remove "session:" prefix
                session_ids.append(session_id)
        
        return session_ids
    
    # Caching methods
    async def cache_transcription_result(self, session_id: str, chunk_id: str, 
                                       result: Dict, expiry: int = 3600) -> bool:
        """Cache transcription result"""
        cache_key = f"transcription:{session_id}:{chunk_id}"
        return await self.set_with_expiry(cache_key, result, expiry)
    
    async def get_cached_transcription_result(self, session_id: str, 
                                            chunk_id: str) -> Optional[Dict]:
        """Get cached transcription result"""
        cache_key = f"transcription:{session_id}:{chunk_id}"
        return await self.get(cache_key)
    
    async def cache_audio_quality_metrics(self, audio_hash: str, metrics: Dict,
                                        expiry: int = 86400) -> bool:
        """Cache audio quality metrics"""
        cache_key = f"audio_quality:{audio_hash}"
        return await self.set_with_expiry(cache_key, metrics, expiry)
    
    async def get_cached_audio_quality_metrics(self, audio_hash: str) -> Optional[Dict]:
        """Get cached audio quality metrics"""
        cache_key = f"audio_quality:{audio_hash}"
        return await self.get(cache_key)
    
    # Rate limiting methods
    async def check_rate_limit(self, client_ip: str, limit: int, window: int) -> Tuple[bool, int]:
        """
        Check rate limit for client
        
        Args:
            client_ip: Client IP address
            limit: Maximum requests allowed
            window: Time window in seconds
            
        Returns:
            Tuple of (is_allowed, current_count)
        """
        try:
            rate_key = f"rate_limit:{client_ip}"
            current_count = await self.get(rate_key) or 0
            
            if current_count >= limit:
                return False, current_count
            
            # Increment counter
            pipe = self.redis_client.pipeline()
            pipe.incr(rate_key)
            pipe.expire(rate_key, window)
            results = await pipe.execute()
            
            new_count = results[0]
            return new_count <= limit, new_count
            
        except Exception as e:
            logger.error(f"Error checking rate limit for {client_ip}: {e}")
            return True, 0  # Allow on error
    
    # Utility methods
    async def _serialize_value(self, value: Any) -> bytes:
        """Serialize value for Redis storage"""
        try:
            # Try JSON serialization first for simple types
            if isinstance(value, (dict, list, str, int, float, bool, type(None))):
                return json.dumps(value, ensure_ascii=False).encode('utf-8')
            else:
                # Use pickle for complex objects
                return pickle.dumps(value)
        except Exception as e:
            logger.error(f"Error serializing value: {e}")
            raise
    
    async def _deserialize_value(self, value: bytes) -> Any:
        """Deserialize value from Redis"""
        try:
            # Try JSON deserialization first
            try:
                return json.loads(value.decode('utf-8'))
            except (json.JSONDecodeError, UnicodeDecodeError):
                # Fallback to pickle
                return pickle.loads(value)
        except Exception as e:
            logger.error(f"Error deserializing value: {e}")
            raise
    
    async def get_stats(self) -> Dict:
        """Get Redis statistics"""
        try:
            if not await self.is_connected():
                return {"connected": False}
            
            info = await self.redis_client.info()
            
            return {
                "connected": True,
                "redis_version": info.get("redis_version"),
                "used_memory": info.get("used_memory_human"),
                "connected_clients": info.get("connected_clients"),
                "total_commands_processed": info.get("total_commands_processed"),
                "keyspace_hits": info.get("keyspace_hits"),
                "keyspace_misses": info.get("keyspace_misses"),
                "uptime_in_seconds": info.get("uptime_in_seconds")
            }
            
        except Exception as e:
            logger.error(f"Error getting Redis stats: {e}")
            return {"connected": False, "error": str(e)}
    
    async def clear_expired_sessions(self) -> int:
        """Clear expired sessions and return count of cleared sessions"""
        try:
            cleared_count = 0
            active_sessions = await self.get_active_sessions()
            
            for session_id in active_sessions:
                session_data = await self.get_session(session_id)
                if not session_data:
                    continue
                
                # Check if session is expired
                last_activity = session_data.get("last_activity", 0)
                if time.time() - last_activity > config.SESSION_TIMEOUT:
                    await self.delete_session(session_id)
                    cleared_count += 1
            
            return cleared_count
            
        except Exception as e:
            logger.error(f"Error clearing expired sessions: {e}")
            return 0