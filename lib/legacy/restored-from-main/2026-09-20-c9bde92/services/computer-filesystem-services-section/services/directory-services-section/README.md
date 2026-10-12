# Directory services

`relocate-directory` moves one complete directory only when its destination is
absent. `merge-directory-contents` moves the contents of one existing source
directory into an existing destination while preserving each relative path.

```sh
merge-directory-contents --source path/to/source --destination path/to/existing-destination
merge-directory-contents --source path/to/source --destination path/to/existing-destination --apply
```

The first command returns a typed survey. The apply form refuses before writes
when inventories contain source symlinks or special entries, roots overlap,
filesystems differ, or a destination path would collide. File movement uses a
no-replace hard-link then source-unlink sequence, so a later target collision
cannot overwrite destination bytes. Directory creation and the whole merge are
not atomic. A failed apply returns completed write evidence; a successful one
includes readback completeness and source-removal evidence.
