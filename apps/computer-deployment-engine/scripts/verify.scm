#!/usr/bin/env guile
!#
;;; verify.scm — WO-6's "the contract is one typed spec file naming every verb
;;; either side exposes, checked at session start" made runnable: opens the
;;; Node worker (computer-system-engine's generic stdio verb server, given
;;; LAGOON's own composed verbs module, exactly as (node-worker) itself
;;; does), and for every verb the handshake declared prints
;;;
;;;   verb <name> args:<yes|no> returns:<yes|no> refusal:<yes|no>
;;;
;;; then exits 1 if any verb is missing any of the three schemas, 0 if every
;;; verb's contract is complete. Computes nothing the handshake did not
;;; already answer — this script only reads (node-worker)'s own
;;; worker-verbs/worker-verb-spec and renders the result.
;;;
;;; Run from the repository root, inside the dev shell:
;;;   guix shell -m manifest.scm -- guile scripts/verify.scm
;;; or directly when guile + guile-json are already on PATH:
;;;   guile scripts/verify.scm
;;;
;;; Fixed path, not `(dirname (current-filename))`: the same real Guile quirk
;;; (node-worker)'s own header names and works around —
;;; `current-filename` reads #f once a module has been auto-compiled to its
;;; .go cache. LAGOON_APP_ROOT overrides the constant for relocated
;;; checkouts, exactly as (node-worker) and scripts/look.scm already
;;; do. `app-root` is a PROCEDURE, not a shared top-level `define`, for the
;;; same reason scripts/look.scm's is: `add-to-load-path` runs at compile
;;; time too, so a top-level `define` before it would read as unbound.
(define (app-root)
  (or (getenv "LAGOON_APP_ROOT")
      "/home/emsenn/info/lib/emsenn/services/561-group/services/engineering-services-section/services/computer-engineering-services-section/services/computer-systems-engineering-services-section/services/computer-operating-system-services-section/apps/computer-deployment-engine"))

(add-to-load-path (string-append (app-root) "/src"))

(use-modules (node-worker))

(define (yes/no v) (if v "yes" "no"))

(let* ((worker (open-worker))
       (verbs (worker-verbs worker))
       (complete? #t))
  (for-each
   (lambda (verb)
     (let* ((spec (worker-verb-spec worker verb))
            (has-args (and spec (assoc-ref spec "args") #t))
            (has-returns (and spec (assoc-ref spec "returns") #t))
            (has-refusal (and spec (assoc-ref spec "refusal") #t)))
       (unless (and has-args has-returns has-refusal)
         (set! complete? #f))
       (format #t "verb ~a args:~a returns:~a refusal:~a~%"
               verb (yes/no has-args) (yes/no has-returns) (yes/no has-refusal))))
   verbs)
  (close-worker worker)
  (exit (if complete? 0 1)))
