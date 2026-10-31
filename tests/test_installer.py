import io, json, os, sys, tempfile, zipfile
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "custom_components" / "flow_cards"))
from installer import install_zip

src = HERE.parent / "custom_components" / "flow_cards"
def make_zip(prefix="Flow_cards-main/", extra=None, drop=None, domain=None):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for p in src.rglob("*"):
            if p.is_file() and "__pycache__" not in p.parts:
                rel = p.relative_to(src).as_posix()
                if drop and rel == drop: continue
                data = p.read_bytes()
                if domain and rel == "manifest.json":
                    m = json.loads(data); m["domain"] = domain; data = json.dumps(m).encode()
                z.writestr(f"{prefix}custom_components/flow_cards/{rel}", data)
        z.writestr(f"{prefix}README.md", "x")
        for name, data in (extra or {}).items(): z.writestr(name, data)
    return buf.getvalue()

with tempfile.TemporaryDirectory() as cfg:
    cc = Path(cfg) / "custom_components"
    target = cc / "flow_cards"; target.mkdir(parents=True)
    (target / "engine.py").write_text("OLD"); (target / "keep_me.txt").write_text("user file")
    other = cc / "affalddk"; other.mkdir(); (other / "manifest.json").write_text("{}")
    v = install_zip(make_zip(extra={"Flow_cards-main/custom_components/flow_cards/../../evil.txt": "x"}), target)
    assert v == json.loads((src / "manifest.json").read_text())["version"], v
    assert (target / "engine.py").read_text() != "OLD" and (target / "frontend" / "flow-cards-panel.js").is_file()
    assert (target / "keep_me.txt").read_text() == "user file", "unrelated files in flow_cards kept"
    assert (other / "manifest.json").read_text() == "{}", "other integrations untouched"
    assert not (Path(cfg) / "evil.txt").exists() and not (cc / "evil.txt").exists(), "path traversal blocked"
    before = (target / "engine.py").read_text()
    for bad, why in [(make_zip(domain="hacs"), "anden integration"), (make_zip(drop="engine.py"), "mangler"), (b"not a zip", "")]:
        try:
            install_zip(bad, target); raise AssertionError("should fail")
        except AssertionError: raise
        except Exception as e:
            assert why in str(e), (why, e)
    assert (target / "engine.py").read_text() == before, "failed install changed nothing"
print("INSTALLER TESTS PASSED")
