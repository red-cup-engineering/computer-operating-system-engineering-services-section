#!/usr/bin/env guile
!#
;;; look.scm — the WO-10 "engine's own CLI entry" for `look <place>`: the presentation-layer
;;; (architecture Layer 1.5) render of one (node-worker) "look" call.
;;;
;;; This module computes NOTHING the worker did not already answer: (node-worker)'s "look"
;;; verb (FeltOS's Flatfile world operation, composing the EAVT exports) does
;;; every fold, every filter, every join. This script's only job is deciding HOW to print what came
;;; back — Layer 1.5's own rule, "⊤ shown, never hidden": a cell charged both pos and neg (a
;;; genuine told-both — desired and observed disagree, still held, never resolved by fiat) prints
;;; as a HELD ⊤, not silently as one value or the other.
;;;
;;; Run from the repository root, inside the dev shell:
;;;   guix shell -m manifest.scm -- guile scripts/look.scm [place]
;;; (place defaults to "bare-cedar-fog"; the trace defaults to this app's data/state/world-state/world.eavt.)
;;;
;;; Fixed path, not `(dirname (current-filename))`: the same real Guile quirk (lagoon
;;; node-worker)'s own header names and works around — `current-filename` reads #f once a module
;;; has been auto-compiled to its .go cache. LAGOON_APP_ROOT overrides the constant for relocated
;;; checkouts, exactly as (node-worker) already does.
;;;
;;; `app-root` is a PROCEDURE, not a shared top-level `define`, and is called fresh everywhere it
;;; is needed (here, and again in default-trace-path below) — checked directly: `add-to-load-path`
;;; runs at compile time too (an `eval-when` macro, so a later `use-modules` in this file resolves
;;; against the path it adds), and a top-level `(define lagoon-app-root ...)` placed BEFORE a
;;; separate top-level `add-to-load-path` call compiles with "Unbound variable: lagoon-app-root" —
;;; the macro's compile-time expansion runs before that top-level define's value exists. A
;;; self-contained expression (a procedure call, computed fresh) has no such ordering dependency.
(define (app-root)
  (or (getenv "LAGOON_APP_ROOT")
      "/home/emsenn/info/lib/emsenn/services/561-group/services/engineering-services-section/services/computer-engineering-services-section/services/computer-systems-engineering-services-section/services/computer-operating-system-services-section/apps/computer-deployment-engine"))

(add-to-load-path (string-append (app-root) "/src"))

(use-modules (node-worker))

(define (default-trace-path)
  (or (getenv "LAGOON_WORLD_TRACE_PATH")
      (string-append (app-root) "/data/state/world-state/world.eavt")))

;; render-cell — one fiber cell, Layer 1.5's "⊤ shown, never hidden" rule applied: a cell
;; charged both faces prints as a held ⊤ (both faces named), never collapsed to either one.
(define (render-cell cell)
  (let* ((predicate (assoc-ref cell "predicate"))
         (object (assoc-ref cell "object"))
         (value (assoc-ref cell "value"))
         (pos (assoc-ref value "pos"))
         (neg (assoc-ref value "neg")))
    (cond
     ((and (= pos 1) (= neg 1))
      (format #t "    ~a: ~a  [HELD ⊤ — told both ways; desired and observed disagree, unresolved]~%"
              predicate object))
     ((= pos 1)
      (format #t "    ~a: ~a~%" predicate object))
     ((= neg 1)
      (format #t "    ~a: NOT ~a~%" predicate object))
     (else
      (format #t "    ~a: ~a  [no evidence]~%" predicate object)))))

(define (render-attributes attrs)
  (if (eq? attrs 'null)
      (display "  (no attributes)\n")
      (for-each (lambda (pair) (format #t "  ~a: ~a~%" (car pair) (cdr pair)))
                attrs)))

(define (render-thing thing)
  (let* ((address (assoc-ref thing "address"))
         (attrs (assoc-ref thing "attributes"))
         (name (if (eq? attrs 'null) address (or (assoc-ref attrs "name") address)))
         (fiber (vector->list (assoc-ref thing "fiber"))))
    (format #t "~%- ~a (~a)~%" name address)
    (for-each render-cell fiber)))

(define (look-and-render worker place)
  (let* ((found (call-worker worker "look"
                              `(("path" . ,(default-trace-path)) ("place" . ,place))
                              'session))
         (address (assoc-ref found "address")))
    (format #t "look ~a~%" place)
    (if (eq? address 'null)
        (display "nothing here by that name.\n")
        (begin
          (format #t "~a~%" address)
          (render-attributes (assoc-ref found "placeAttributes"))
          (let ((things (vector->list (assoc-ref found "things"))))
            (if (null? things)
                (display "\n(nothing located here)\n")
                (for-each render-thing things)))
          (let ((duties (vector->list (or (assoc-ref found "recentDuties") #()))))
            (unless (null? duties)
              (display "\nrecent duty events:\n")
              (for-each render-thing duties)))))))

(let* ((args (cdr (command-line)))
       (place (if (null? args) "bare-cedar-fog" (car args)))
       (worker (open-worker)))
  (look-and-render worker place)
  (close-worker worker))
