// read-text — read a file's bytes as a UTF-8 string. The lowest byte-touch: no kernel lift, no
// classification, just the decoded text. VPH owns every filesystem read, so a consumer that needs the
// raw text of a flatfile (to regex its frontmatter, parse its JSON, …) gets it here rather than reaching
// for node:fs itself. The richer node readings (which lift the text into a kernel category) compose this;
// this is the plain string they wrap.

import { readFileSync } from "node:fs";

export default function readText(path) {
  return readFileSync(path, "utf8");
}
