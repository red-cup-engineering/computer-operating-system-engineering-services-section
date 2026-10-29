# Computer filesystem services section

These services require an operating-system filesystem: paths, directories,
files, symlinks, reads, writes, and atomic relocation. A file may carry data,
but these implementations operate on the filesystem system that stores it.

The section separates effects from address and observation semantics:

- `scripts/read-file.mjs` and `scripts/write-file.mjs` expose the registered file-carrier commands.
- `services/filepath-services-section/` normalizes and confines addresses. Its self-contained `scripts/search-filepath.mjs` command searches either filepath spellings or literal text beneath an explicit file or directory path.
- `services/directory-services-section/` observes one directory level and relocates whole directories.
- `services/file-observation-services-section/services/path-walking-service/` recursively observes real filesystem paths without following symlinks.
- `services/file-observation-services-section/services/file-type-slicing-service/` classifies an already-observed file set by extension.
- `services/file-projection-services-section/services/replacing-file-content-service/` projects replacement content.

Markdown admission and Markdown-vault meaning belong to the sibling text-service layers, not here.
