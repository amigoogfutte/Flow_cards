"""Install a Flow Cards release from a GitHub zip (no Home Assistant imports, so it can be tested)."""

from __future__ import annotations

import io
import json
from pathlib import Path
import shutil
import tempfile
import zipfile

MARKER = "custom_components/flow_cards/manifest.json"


def install_zip(blob: bytes, target: Path) -> str:
    """Copy custom_components/flow_cards from the zip over `target`. Returns the new version.

    Only files inside flow_cards are written; nothing else in /config is touched.
    The new files are fully extracted and checked before anything is copied.
    """
    with zipfile.ZipFile(io.BytesIO(blob)) as zf:
        names = zf.namelist()
        hit = next((n for n in names if n.endswith(MARKER)), None)
        if hit is None:
            raise ValueError("pakken indeholder ikke Flow Cards")
        root = hit[: -len("manifest.json")]
        manifest = json.loads(zf.read(hit))
        if manifest.get("domain") != "flow_cards":
            raise ValueError("pakken indeholder en anden integration")
        with tempfile.TemporaryDirectory() as tmp:
            count = 0
            for name in names:
                if not name.startswith(root) or name.endswith("/"):
                    continue
                rel = Path(name[len(root):])
                if rel.is_absolute() or ".." in rel.parts:
                    continue
                dest = Path(tmp) / rel
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(zf.read(name))
                count += 1
            for needed in ("__init__.py", "manifest.json", "engine.py", "frontend/flow-cards-panel.js"):
                if not (Path(tmp) / needed).is_file():
                    raise ValueError(f"pakken mangler {needed}")
            shutil.copytree(tmp, target, dirs_exist_ok=True)
    return str(manifest.get("version") or "?")
