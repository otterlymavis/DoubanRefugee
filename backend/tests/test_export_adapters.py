from datetime import date

from app.domain.enums import MediaType, SourcePlatform
from app.models import MediaItem, Rating, Review
from app.services.export_adapters import LetterboxdAdapter


def test_letterboxd_adapter_renders_csv(tmp_path):
    item = MediaItem(
        media_type=MediaType.MOVIE,
        source_platform=SourcePlatform.DOUBAN,
        source_id="1291557",
        titles={"en": "In the Mood for Love", "zh": "花样年华"},
        year=2000,
        consumed_date=date(2024, 1, 2),
        tags=["archive"],
        external_ids={},
    )
    item.rating = Rating(value=4.5, scale=5)
    item.review = Review(body="Preserved.")
    path = LetterboxdAdapter().render([item], tmp_path)
    assert "In the Mood for Love" in path.read_text(encoding="utf-8")

