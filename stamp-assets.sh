#!/bin/bash
# Stamp a content hash onto the CSS/JS links in every page.
#
# GitHub Pages serves styles.css and script.js with `cache-control: max-age=14400`,
# so after a deploy the CDN keeps handing visitors the old file for up to four
# hours. The HTML itself refreshes quickly, which is the worst case: new markup
# against a stale stylesheet. That is exactly what happened when the mobile
# header fix went out and appeared not to work.
#
# Appending ?v=<hash of the file> makes the URL change whenever the file does,
# so a deploy is picked up immediately. Re-run this before every commit that
# touches styles.css or script.js; it is idempotent.
#
# Only href="..." / src="..." are rewritten, so prose mentions of the filenames
# in comments are left alone.
set -euo pipefail
cd "$(dirname "$0")"

for asset in styles.css script.js; do
  [ -f "$asset" ] || continue
  h=$(md5 -q "$asset" | cut -c1-8)
  for f in *.html; do
    ASSET="$asset" HASH="$h" perl -pi -e '
      my ($a, $v) = ($ENV{ASSET}, $ENV{HASH});
      s{\b(href|src)="\Q$a\E(?:\?v=[0-9a-f]+)?"}{$1="$a?v=$v"}g;
    ' "$f"
  done
  printf "  %-12s v=%s\n" "$asset" "$h"
done
