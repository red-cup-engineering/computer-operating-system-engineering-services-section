#!/usr/bin/env guile
!#
;;; run-node-worker-tests.scm — the runner entry for the (node-worker) SRFI-64
;;; suite (WO-6). Locates the section's src/ on the load path itself, so it
;;; runs from any working directory:
;;;
;;;   guix shell -m manifest.scm -- guile scripts/run-node-worker-tests.scm
;;;
;;; (guile + guile-json come from the dev shell manifest; node comes from the
;;; ambient box, invoked by the node-worker itself.)

(let* ((here (dirname (current-filename)))     ; .../scripts
       (section (dirname here))                ; the lagoon section root
       (src (string-append section "/src"))
       (test-file (string-append section "/test/node-worker-test.scm")))
  (add-to-load-path src)
  (load test-file))
