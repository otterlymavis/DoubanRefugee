import random
import time
from collections.abc import Mapping

import httpx

from app.core.config import get_settings


class DoubanFetchClient:
    """Optional authenticated-session fetcher for user-approved fallback imports."""

    def __init__(self, cookies: Mapping[str, str] | None = None):
        self.cookies = dict(cookies or {})
        self.settings = get_settings()

    def get(self, url: str, *, max_attempts: int = 4) -> str:
        last_error: Exception | None = None
        for attempt in range(max_attempts):
            self._polite_delay(attempt)
            try:
                with httpx.Client(cookies=self.cookies, timeout=20, follow_redirects=True) as client:
                    response = client.get(url, headers={"User-Agent": "DoubanRefugee backup tool"})
                    response.raise_for_status()
                    return response.text
            except (httpx.HTTPError, httpx.TimeoutException) as exc:
                last_error = exc
        raise RuntimeError(f"Douban fetch failed after {max_attempts} attempts") from last_error

    def _polite_delay(self, attempt: int) -> None:
        low = self.settings.douban_request_min_delay_seconds
        high = max(low, self.settings.douban_request_max_delay_seconds)
        jitter = random.uniform(low, high)
        time.sleep(jitter + attempt * 1.5)

