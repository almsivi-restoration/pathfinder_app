import shutil

import pytest

from reference_library import ReferenceLibrary


def test_indexes_and_searches_page_aware_local_reference(tmp_path):
    library = ReferenceLibrary(tmp_path / "reference_library")
    library.index_pages(
        "1e",
        "core_rulebook.pdf",
        "Core Rulebook",
        ["Combat begins with initiative.\n\nArmor Class determines whether an attack hits.", "Spells use a saving throw."],
    )

    results = library.search("1e", "armor class")

    assert len(results) == 1
    assert results[0]["title"] == "Core Rulebook"
    assert results[0]["filename"] == "core_rulebook.pdf"
    assert results[0]["page_number"] == 1
    assert "Armor Class determines" in results[0]["excerpt"]


def test_search_ignores_empty_queries_and_unindexed_rulesets(tmp_path):
    library = ReferenceLibrary(tmp_path / "reference_library")

    assert library.search("1e", "") == []
    assert library.search("2e", "initiative") == []


def test_discovers_sources_in_the_configured_ruleset_directory(tmp_path):
    library = ReferenceLibrary(tmp_path / "reference_library")
    source_dir = library.root_dir / "sources" / "pathfinder_1e"
    source_dir.mkdir(parents=True)
    (source_dir / "core_rulebook.pdf").touch()

    assert library.available_sources("1e", "pathfinder_1e") == ["core_rulebook.pdf"]


def test_source_path_is_limited_to_the_configured_directory(tmp_path):
    library = ReferenceLibrary(tmp_path / "reference_library")
    source_dir = library.root_dir / "sources" / "pathfinder_1e"
    source_dir.mkdir(parents=True)
    source_path = source_dir / "core_rulebook.pdf"
    source_path.touch()

    assert library.get_source_path("1e", "core_rulebook.pdf", "pathfinder_1e") == source_path
    assert library.get_source_path("1e", "../core_rulebook.pdf", "pathfinder_1e") is None


# --- OCR fallback --------------------------------------------------------------


def _write_text_pdf(path, text_by_page):
    """A synthetic PDF with embedded text and no images — never OCR'd."""
    import pymupdf

    document = pymupdf.open()
    for text in text_by_page:
        page = document.new_page()
        page.insert_text((72, 72), text)
    document.save(str(path))
    document.close()


def _write_scan_pdf(path, text_by_page):
    """A synthetic scanned PDF: each page is a rendered image with no text layer."""
    import pymupdf

    document = pymupdf.open()
    for text in text_by_page:
        # Render the words into an image on a scratch document...
        scratch = pymupdf.open()
        scratch_page = scratch.new_page(width=612, height=300)
        scratch_page.insert_text((60, 100), text, fontsize=20)
        pixmap = scratch_page.get_pixmap(dpi=300)
        scratch.close()
        # ...then place that image on the real page, leaving no text layer.
        page = document.new_page(width=612, height=300)
        page.insert_image(page.rect, pixmap=pixmap)
    document.save(str(path))
    document.close()


def test_ocr_available_reports_tesseract_presence():
    assert ReferenceLibrary.ocr_available() == (shutil.which("tesseract") is not None)


def test_import_embedded_text_never_touches_ocr(tmp_path, monkeypatch):
    library = ReferenceLibrary(tmp_path / "reference_library")
    source_dir = library.root_dir / "sources" / "pathfinder_1e"
    source_dir.mkdir(parents=True)
    pdf = source_dir / "core_rulebook.pdf"
    _write_text_pdf(pdf, ["Combat begins with initiative and attack rolls and saving throws."])

    def _fail_if_called(*args, **kwargs):
        raise AssertionError("OCR ran on a text-bearing page")

    monkeypatch.setattr(library, "_ocr_pages", _fail_if_called)
    record = library.import_source("1e", "core_rulebook.pdf", "pathfinder_1e")

    assert record["page_count"] == 1
    assert record["ocr"] == {"available": library.ocr_available(), "pages_ocr": 0, "pages_empty": 0}
    assert library.search("1e", "initiative")[0]["page_number"] == 1


def test_import_reports_unavailable_ocr_without_it(tmp_path, monkeypatch):
    library = ReferenceLibrary(tmp_path / "reference_library")
    source_dir = library.root_dir / "sources" / "pathfinder_1e"
    source_dir.mkdir(parents=True)
    pdf = source_dir / "scan.pdf"
    _write_scan_pdf(pdf, ["Some words rendered only as pixels"])

    monkeypatch.setattr(ReferenceLibrary, "ocr_available", staticmethod(lambda: False))
    record = library.import_source("1e", "scan.pdf", "pathfinder_1e")

    assert record["ocr"] == {"available": False, "pages_ocr": 0, "pages_empty": 1}
    assert library.search("1e", "pixels") == []


@pytest.mark.skipif(shutil.which("tesseract") is None, reason="tesseract not installed")
def test_import_ocr_recovers_scanned_pages(tmp_path):
    """End-to-end: a real image-only page, recognized by the real Tesseract."""
    library = ReferenceLibrary(tmp_path / "reference_library")
    source_dir = library.root_dir / "sources" / "pathfinder_1e"
    source_dir.mkdir(parents=True)
    pdf = source_dir / "scan.pdf"
    _write_scan_pdf(pdf, ["The fireball spell deals six dice of damage to every creature."])

    record = library.import_source("1e", "scan.pdf", "pathfinder_1e")

    assert record["ocr"]["pages_ocr"] == 1
    assert record["ocr"]["pages_empty"] == 0
    results = library.search("1e", "fireball damage")
    assert len(results) == 1
    assert results[0]["page_number"] == 1


def test_ensure_source_directories_creates_ruleset_drop_locations(tmp_path):
    library = ReferenceLibrary(tmp_path / "reference_library")

    created = library.ensure_source_directories(["pathfinder_1e", "pathfinder_2e"])
    created_again = library.ensure_source_directories(["pathfinder_1e", "pathfinder_2e"])

    for directory in ("pathfinder_1e", "pathfinder_2e"):
        assert (library.root_dir / "sources" / directory).is_dir()
    assert created == created_again
    assert library.available_sources("1e", "pathfinder_1e") == []