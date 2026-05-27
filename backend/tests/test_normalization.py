from app.services.normalization import normalize_text


def test_normalize_multilingual_title_removes_noise():
    assert normalize_text("花樣年華（2000） / In the Mood for Love") == "花樣年華 in the mood for love"
