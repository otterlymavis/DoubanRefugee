from sqlalchemy.orm import Session

from app.repositories import MediaRepository, UserRepository
from app.schemas import BrowserExtensionImportRequest, HtmlImportRequest, ImportResponse
from app.services.douban_ingestion import DoubanHtmlParser


class ImportService:
    def __init__(self, db: Session):
        self.db = db
        self.users = UserRepository(db)
        self.media = MediaRepository(db)

    def import_browser_extension(self, request: BrowserExtensionImportRequest) -> ImportResponse:
        user = self.users.get_or_create(request.user_id)
        snapshot = self.media.create_snapshot(
            user_id=user.id,
            import_method="browser-extension",
            raw_payload={"source_profile": request.source_profile},
            item_count=len(request.items),
        )
        items = self.media.upsert_items(user.id, snapshot.id, request.items)
        self.db.commit()
        return ImportResponse(user_id=user.id, snapshot_id=snapshot.id, imported_count=len(items))

    def import_html(self, request: HtmlImportRequest) -> ImportResponse:
        parsed = DoubanHtmlParser().parse(request.html, request.media_type)
        user = self.users.get_or_create(request.user_id)
        snapshot = self.media.create_snapshot(
            user_id=user.id,
            import_method="html",
            raw_payload={"html_length": len(request.html)},
            item_count=len(parsed),
        )
        items = self.media.upsert_items(user.id, snapshot.id, parsed)
        self.db.commit()
        return ImportResponse(user_id=user.id, snapshot_id=snapshot.id, imported_count=len(items))

