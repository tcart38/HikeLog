#!/usr/bin/env python3
"""Sanity-check an Unraid Docker template (Container version 2). Usage: check-unraid-template.py hikelog.xml"""
import sys
import xml.etree.ElementTree as ET

path = sys.argv[1] if len(sys.argv) > 1 else "hikelog.xml"
root = ET.parse(path).getroot()  # raises on malformed XML
errors = []
if root.tag != "Container" or root.get("version") != "2":
    errors.append('root must be <Container version="2">')
for tag in ("Name", "Repository", "Registry", "Network", "Support", "Project", "Overview", "Category", "WebUI", "TemplateURL", "Icon"):
    el = root.find(tag)
    if el is None or not (el.text or "").strip():
        errors.append(f"missing or empty <{tag}>")
for tag in ("Support", "Project", "TemplateURL", "Icon", "Registry"):
    el = root.find(tag)
    if el is not None and el.text and not el.text.strip().startswith("https://"):
        errors.append(f"<{tag}> must be an https URL")
configs = root.findall("Config")
if not configs:
    errors.append("no <Config> entries")
names = set()
for c in configs:
    n = c.get("Name")
    if n in names:
        errors.append(f"duplicate Config name {n!r}")
    names.add(n)
    if c.get("Type") not in ("Port", "Path", "Variable", "Device", "Label"):
        errors.append(f"{n}: bad Type {c.get('Type')!r}")
    if not c.get("Target"):
        errors.append(f"{n}: missing Target")
    if c.get("Mode") is None and c.get("Type") in ("Port", "Path"):
        errors.append(f"{n}: Port/Path needs Mode")
    if c.get("Type") == "Variable" and (c.get("Default") or "") and "ey" in (c.get("Target") or "").lower():
        errors.append(f"{n}: do not ship default secrets")
if not any(c.get("Type") == "Path" and c.get("Target") == "/data" for c in configs):
    errors.append("no /data path mapping")
if errors:
    print("\n".join("ERROR: " + e for e in errors))
    sys.exit(1)
print(f"{path}: OK ({len(configs)} config entries)")
