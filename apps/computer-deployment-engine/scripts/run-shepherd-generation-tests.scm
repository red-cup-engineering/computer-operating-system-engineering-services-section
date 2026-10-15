#!/usr/bin/env guile
!#
;;; run-shepherd-generation-tests.scm — the runner entry for the (shepherd-generation)
;;; SRFI-64 suite. Needs only guile; no Guix, Shepherd or Node.
(let* ((section (dirname (dirname (current-filename)))))
  (add-to-load-path (string-append section "/src"))
  (load (string-append section "/test/shepherd-generation-test.scm")))
