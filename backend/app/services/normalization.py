import re
import unicodedata

BRACKETED = re.compile(r"[\(\[（【].*?[\)\]）】]")
PUNCTUATION = re.compile(r"[\W_]+", re.UNICODE)


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value or "").casefold()
    normalized = BRACKETED.sub(" ", normalized)
    normalized = PUNCTUATION.sub(" ", normalized)
    return " ".join(normalized.split())


def title_variants(titles: dict[str, str]) -> list[str]:
    seen: set[str] = set()
    variants: list[str] = []
    for key in ("zh", "en", "original"):
        value = titles.get(key)
        if value and value not in seen:
            seen.add(value)
            variants.append(value)
    return variants

