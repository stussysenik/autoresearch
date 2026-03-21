"""
Token bucket rate limiter for API calls.
"""

import asyncio
import time


class RateLimiter:
    """Simple token bucket rate limiter.

    Args:
        rpm: Maximum requests per minute.
    """

    def __init__(self, rpm: int = 30):
        self.rpm = rpm
        self.interval = 60.0 / rpm
        self._last_call = 0.0

    async def acquire(self) -> None:
        """Wait until a request slot is available."""
        now = time.monotonic()
        elapsed = now - self._last_call
        if elapsed < self.interval:
            await asyncio.sleep(self.interval - elapsed)
        self._last_call = time.monotonic()

    def acquire_sync(self) -> None:
        """Blocking version for synchronous code."""
        now = time.monotonic()
        elapsed = now - self._last_call
        if elapsed < self.interval:
            time.sleep(self.interval - elapsed)
        self._last_call = time.monotonic()
