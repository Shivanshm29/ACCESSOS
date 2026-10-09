"""Document Intelligence Constants (Phase 9).

Explicit safety, size, and processing bounds for document ingestion and analysis.
"""

# Maximum file size in bytes (10 Megabytes)
MAX_FILE_SIZE_BYTES: int = 10 * 1024 * 1024

# Maximum allowed page count for processing
MAX_PAGE_COUNT: int = 20

# Maximum extracted text length (characters)
MAX_EXTRACTED_TEXT_LENGTH: int = 50_000

# Maximum length for evidence reference snippets
MAX_EVIDENCE_LENGTH: int = 250

# Maximum number of extracted facts per document
MAX_FACTS_COUNT: int = 50

# Supported MIME types
SUPPORTED_MIME_TYPES: tuple[str, ...] = (
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "text/plain",
)

# Supported file extensions
SUPPORTED_EXTENSIONS: tuple[str, ...] = (
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
    ".txt",
)
