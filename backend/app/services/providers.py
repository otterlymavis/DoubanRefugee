from typing import Protocol

import httpx

from app.core.config import get_settings
from app.domain.enums import MediaType


class ProviderResult(dict):
    provider: str
    provider_id: str
    title: str
    year: int | None


class MetadataProvider(Protocol):
    provider_name: str

    async def search(self, title: str, year: int | None, media_type: MediaType) -> list[dict]:
        ...


class TMDbProvider:
    provider_name = "tmdb"

    async def search(self, title: str, year: int | None, media_type: MediaType) -> list[dict]:
        settings = get_settings()
        if media_type != MediaType.MOVIE or not settings.tmdb_api_key:
            return []
        params = {"api_key": settings.tmdb_api_key, "query": title, "include_adult": "false"}
        if year:
            params["year"] = str(year)
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get("https://api.themoviedb.org/3/search/movie", params=params)
            response.raise_for_status()
        return [
            {
                "provider": self.provider_name,
                "provider_id": str(item["id"]),
                "title": item.get("title") or item.get("original_title") or "",
                "year": int(item.get("release_date", "0000")[:4]) if item.get("release_date") else None,
                "metadata": item,
            }
            for item in response.json().get("results", [])
        ]


class OpenLibraryProvider:
    provider_name = "openlibrary"

    async def search(self, title: str, year: int | None, media_type: MediaType) -> list[dict]:
        if media_type != MediaType.BOOK:
            return []
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"{get_settings().open_library_base_url}/search.json", params={"title": title})
            response.raise_for_status()
        return [
            {
                "provider": self.provider_name,
                "provider_id": item.get("key", ""),
                "title": item.get("title", ""),
                "year": item.get("first_publish_year"),
                "metadata": item,
            }
            for item in response.json().get("docs", [])[:10]
        ]


class MusicBrainzProvider:
    provider_name = "musicbrainz"

    async def search(self, title: str, year: int | None, media_type: MediaType) -> list[dict]:
        if media_type != MediaType.MUSIC:
            return []
        headers = {"User-Agent": "DoubanRefugee/0.1 (privacy-first cultural archive)"}
        async with httpx.AsyncClient(timeout=10, headers=headers) as client:
            response = await client.get(
                f"{get_settings().musicbrainz_base_url}/release/",
                params={"query": title, "fmt": "json", "limit": 10},
            )
            response.raise_for_status()
        return [
            {
                "provider": self.provider_name,
                "provider_id": item.get("id", ""),
                "title": item.get("title", ""),
                "year": int(item.get("date", "0000")[:4]) if item.get("date") else None,
                "metadata": item,
            }
            for item in response.json().get("releases", [])
        ]

