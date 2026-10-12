// sniff — sniff a regular file's leading bytes for binarity (does the head block carry a NUL?). The
// byte-level sub-reading regular-file reading uses to derive its binarity claim — the analogue of statting (a
// sub-reading that enriches the parent's read). Returns "flat" | "binary".
import { openSync, readSync, closeSync } from "node:fs";

export default function sniff(path) {
  const fd = openSync(path, "r");
  try {
    const b = Buffer.alloc(8192);
    const n = readSync(fd, b, 0, b.length, 0);
    for (let i = 0; i < n; i++) if (b[i] === 0) return "binary";
    return "flat";
  } finally {
    closeSync(fd);
  }
}
