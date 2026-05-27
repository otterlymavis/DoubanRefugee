import re
from datetime import date

from bs4 import BeautifulSoup

from app.domain.enums import MediaType, SourcePlatform
from app.schemas import CanonicalMediaPayload, RatingPayload


class DoubanHtmlParser:
    """Fallback parser for user-supplied Douban HTML exports."""

    def parse(self, html: str, media_type: MediaType) -> list[CanonicalMediaPayload]:
        soup = BeautifulSoup(html, "html.parser")
        items = []
        for node in soup.select(".item, .doulist-item, li.subject-item"):
            href = node.select_one("a[href*='douban.com/subject/']")
            title_node = node.select_one(".title, h2, a")
            if not href or not title_node:
                continue
            match = re.search(r"/subject/(\d+)/", href.get("href", ""))
            source_id = match.group(1) if match else href.get("href", "")
            rating_node = node.select_one(".rating, .date + span")
            date_node = node.select_one(".date, .pl")
            rating = self._parse_rating(rating_node.get_text(" ", strip=True) if rating_node else "")
            items.append(
                CanonicalMediaPayload(
                    media_type=media_type,
                    source_platform=SourcePlatform.DOUBAN,
                    source_id=source_id,
                    titles={"zh": title_node.get_text(" ", strip=True)},
                    rating=rating,
                    consumed_date=self._parse_date(date_node.get_text(" ", strip=True) if date_node else ""),
                )
            )
        return items

    def _parse_rating(self, value: str) -> RatingPayload | None:
        stars = re.search(r"rating(\d)-t", value)
        if stars:
            return RatingPayload(value=int(stars.group(1)), scale=5)
        numeric = re.search(r"([0-5](?:\.\d)?)", value)
        if numeric:
            return RatingPayload(value=float(numeric.group(1)), scale=5)
        return None

    def _parse_date(self, value: str) -> date | None:
        match = re.search(r"(\d{4})-(\d{2})-(\d{2})", value)
        if not match:
            return None
        return date(int(match.group(1)), int(match.group(2)), int(match.group(3)))

