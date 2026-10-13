#!/bin/bash
# Stamp a content hash onto every local asset referenced from the pages.
#
# GitHub Pages serves static files with `cache-control: max-age=14400`, so
# after a deploy the CDN keeps handing visitors the old bytes for up to four
# hours. The HTML itself refreshes quickly, which is the worst case: new markup
# against stale assets.
#
# This bit us twice. First on styles.css, when a mobile header fix shipped
# correctly and appeared not to work. Then on the hero images, when a replaced
# photograph kept serving the previous one under the same filename.
#
# Appending ?v=<hash of the file> makes the URL change whenever the file does,
# so a deploy is picked up immediately. Re-run before every commit that touches
# an asset; it is idempotent.
#
# Only href="..." / src="..." / srcset entries are rewritten, so prose mentions
# of filenames in comments are left alone.
set -euo pipefail
cd "$(dirname "$0")"

/opt/anaconda3/bin/python3 - <<'PY'
import hashlib, pathlib, re

root = pathlib.Path(".")
pages = sorted(root.glob("*.html"))
targets = [pathlib.Path("styles.css"), pathlib.Path("script.js")]
# The root favicons were missing here until 2026-10-13, so their ?v= was a hand-typed constant that
# never changed when the files did - leaving the browser tab icon, the one asset browsers cache
# hardest, as the only thing on the site exempt from the cache-busting this script exists to do.
targets += [pathlib.Path("favicon.ico"), pathlib.Path("favicon.png")]
targets += sorted(root.glob("assets/images/*.[jpwa]*"))   # jpg jpeg png webp avif
targets += sorted(root.glob("assets/fonts/*.woff2"))

digests = {}
for t in targets:
    if t.is_file():
        digests[t.as_posix()] = hashlib.md5(t.read_bytes()).hexdigest()[:8]

stamped = 0
for page in pages:
    s = original = page.read_text(encoding="utf-8")
    for path, h in digests.items():
        # match the path only where it is a real URL: preceded by =" or a
        # srcset comma-space, and followed by an optional old stamp then a
        # quote, space (srcset descriptor) or comma.
        # The leading slash is optional and preserved: the favicons are referenced root-relative
        # ("/favicon.ico"), and without this the lookbehind sees "/" and never matches them.
        pat = re.compile(r'(?<=[="\s,])(/?)' + re.escape(path) + r'(\?v=[0-9a-f]{8})?(?=["\s,])')
        s, n = pat.subn(lambda m: m.group(1) + path + "?v=" + h, s)
        stamped += n
    if s != original:
        page.write_text(s, encoding="utf-8")

print(f"  {len(digests)} assets hashed, {stamped} references stamped across {len(pages)} pages")
PY
