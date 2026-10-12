;;; node-worker-test.scm — SRFI-64 conformance tests for (node-worker), WO-6.
;;;
;;; Every assertion here goes THROUGH the node-worker to the real Node worker
;;; (computer-system-engine's generic stdio verb server, given LAGOON's own
;;; composed verbs module) — nothing here recomputes a substrate law in Guile.
;;; Golden values (canonical bytes, ni: identity) are recorded by calling the
;;; worker at first principles and checking it against ITSELF (determinism
;;; across two calls), never worker-computed here.
;;;
;;; Run from the repository root, inside the dev shell:
;;;   guix shell -m manifest.scm -- guile -L <section>/src <section>/test/node-worker-test.scm
;;; or via the runner entry: scripts/run-node-worker-tests.scm

(use-modules (srfi srfi-1)
             (srfi srfi-64)
             (ice-9 popen)
             (ice-9 rdelim)
             (node-worker))

;; The section's own root, the same LAGOON_APP_ROOT-overridable constant
;; (node-worker), scripts/look.scm, and scripts/verify.scm each carry —
;; needed here only to locate the worker script and scripts/verify.scm for the
;; two tests below that spawn a worker/script of their own.
(define (app-root)
  (or (getenv "LAGOON_APP_ROOT")
      "/home/emsenn/info/lib/emsenn/services/561-group/services/engineering-services-section/services/computer-engineering-services-section/services/computer-systems-engineering-services-section/services/computer-operating-system-services-section/apps/computer-deployment-engine"))

;; computer-system-engine's own root, the same fixed-not-derived, env-overridable shape as
;; (node-worker)'s own computer-system-engine-root — needed here only by the spec-incomplete-verb
;; group below, which spawns the generic stdio verb server directly.
(define (computer-system-engine-root)
  (or (getenv "COMPUTER_SYSTEM_ENGINE_ROOT")
      "/home/emsenn/info/lib/emsenn/services/561-group/services/engineering-services-section/services/computer-engineering-services-section/services/computer-systems-engineering-services-section/apps/computer-system-engine"))

;; Test-scratch trace lives in a tmp dir, never under any section's data/
;; (house data custody law: leaf services do not journal locally).
(define trace-path
  (string-append "/tmp/lagoon-node-worker-test-" (number->string (getpid)) ".jsonl"))

(define (cleanup!)
  (when (file-exists? trace-path) (delete-file trace-path)))

;; Skip SRFI-64's default per-suite .log file (it would otherwise land in
;; whatever directory guile was invoked from); the pass/fail counts this
;; prints to stdout are the witness the report quotes.
;; Older SRFI-64 writes a per-suite .log file unless this knob is unset;
;; newer Guile's SRFI-64 dropped the knob entirely.
(when (defined? 'test-log-to-file) (set! test-log-to-file #f))

(test-begin "lagoon-node-worker-wo6")

(define worker (open-worker))

(test-group "shared system engine"
  (test-assert "Guile retains the worker's addressed type catalog"
    (string-prefix? "ni:///sha-256;" (worker-type-system-identity worker)))
  (test-equal "the full catalog carries that same identity"
    (worker-type-system-identity worker)
    (assoc-ref (worker-type-system worker) "identity"))
  (for-each
    (lambda (verb)
      (let ((spec (worker-verb-spec worker verb)))
        (test-equal (string-append verb " binds its shared catalog")
          (worker-type-system-identity worker) (assoc-ref spec "typeSystemIdentity"))
        (test-equal (string-append verb " names its operation's domain")
          (assoc-ref spec "domain") (assoc-ref (assoc-ref spec "operation") "domain"))))
    (worker-verbs worker)))

;; --- 1. handshake lists expected verbs -------------------------------------
(test-group "handshake"
  (let ((verbs (worker-verbs worker)))
    (test-assert "verbs is a non-empty list" (and (list? verbs) (positive? (length verbs))))
    (for-each (lambda (expected)
                (test-assert (string-append "handshake lists " expected)
                  (member expected verbs)))
              '("assert-row" "encode-cbor" "decode-cbor" "row-id"
                "append" "read" "entities" "fold-trace" "fold" "settle" "section"
                "constitute" "verify-address" "observe-unit-inventory" "look" "go" "say"))))

;; sample-row is defined here (ahead of its natural home in group 2 below) so
;; groups 1b/1c, which need a well-formed row to call assert-row/row-id with,
;; can use it too.
(define sample-row
  '(("e" . "thing:pebble") ("a" . "named") ("v" . "pebble") ("t" . 1)))

;; --- 1b. WO-6's typed contract: the handshake names every verb's full spec,
;; and worker-verb-spec resolves it — "one typed spec file naming every verb
;; either side exposes... argument schema, return schema, and the
;; error/refusal schema" (architecture §3, "Contract"). ----------------------
(test-group "handshake specs (WO-6 contract)"
  (for-each
   (lambda (verb)
     (let ((spec (worker-verb-spec worker verb)))
       (test-assert (string-append "worker-verb-spec resolves " verb) (pair? spec))
       (test-assert (string-append verb " spec carries an args schema")
         (assoc-ref spec "args"))
       (test-assert (string-append verb " spec carries a returns schema")
         (assoc-ref spec "returns"))
       (test-assert (string-append verb " spec carries a refusal schema")
         (assoc-ref spec "refusal"))))
   (worker-verbs worker))
  (test-assert "worker-verb-spec on a verb the handshake never named is #f"
    (not (worker-verb-spec worker "not-a-real-verb"))))

;; --- 1c. a verb whose handshake spec lacks an args schema is refused, same
;; as an unknown verb — the "verbs" reply drives admissibility, never the
;; handler table alone (WO-6: "a hand whose observed face does not match its
;; spec is refused before any cut is admitted"). Uses computer-system-engine's
;; generic stdio verb server's own test-only VERBS_STRIP_SPEC_ARGS_VERB knob
;; (its header names it), spawned directly against eavt's OWN verbs module —
;; "the right --verbs specifier for [the assert-row-owning] owner" — to get a
;; real handshake reply missing one verb's args schema, rather than a second
;; worker script to maintain. --------------------------------------------------
(test-group "spec-incomplete verb is refused (WO-6 contract check)"
  (let* ((worker-script (string-append (computer-system-engine-root) "/scripts/serve-verbs-over-stdio.mjs"))
         (stripped-worker
          (open-worker (list "env" "VERBS_STRIP_SPEC_ARGS_VERB=assert-row"
                              "node" worker-script
                              "--verbs" "@red-cup-engineering/eavt-services-section/verbs"))))
    (test-assert "the stripped verb is still named by the handshake"
      (member "assert-row" (worker-verbs stripped-worker)))
    (test-assert "...but its spec no longer carries an args schema"
      (not (assoc-ref (worker-verb-spec stripped-worker "assert-row") "args")))
    (let ((refusal (call-worker stripped-worker "assert-row" `(("row" . ,sample-row)) 'session)))
      (test-assert "the call is refused, as a typed record" (refusal? refusal))
      (test-equal "refusal state is 'refused" 'refused (refusal-state refusal))
      (test-assert "the refusal's because names the verb"
        (string-contains (refusal-because refusal) "assert-row")))
    ;; an unaffected verb on the SAME worker is unaffected: only assert-row's
    ;; declared contract was stripped, no other verb's.
    (let ((ok (call-worker stripped-worker "row-id" `(("row" . ,sample-row)) 'session)))
      (test-assert "an untouched verb on the same worker still works"
        (and (string? ok) (string-prefix? "ni:///sha-256;" ok))))
    (close-worker stripped-worker)))

;; --- 2. row assertion, canonical encoding, ni: identity, determinism ------
;; (sample-row is defined above group 1b, which needs it too.)
(test-group "assert-row + canonical encoding + ni: identity"
  ;; assert-row: a well-formed {e,a,v,t} row is accepted and workered back.
  (let ((asserted (call-worker worker "assert-row" `(("row" . ,sample-row)) 'session)))
    (test-assert "assert-row returns an alist" (pair? asserted))
    (test-equal "assert-row preserves e" "thing:pebble" (assoc-ref asserted "e")))

  ;; canonical encoding: encode-cbor called twice on the same row gives the
  ;; identical base64 wire bytes both times (the golden value IS whatever the
  ;; worker returns the first time — checked against itself, not worker-derived).
  (let* ((encoded-1 (call-worker worker "encode-cbor" `(("value" . ,sample-row)) 'session))
         (encoded-2 (call-worker worker "encode-cbor" `(("value" . ,sample-row)) 'session)))
    (test-assert "canonical encoding is a non-empty string" (and (string? encoded-1) (positive? (string-length encoded-1))))
    (test-equal "canonical encoding is deterministic across two calls" encoded-1 encoded-2)

    ;; round-trip: decoding the encoded bytes back gives an equivalent row.
    (let ((decoded (call-worker worker "decode-cbor" `(("bytes" . ,encoded-1)) 'session)))
      (test-equal "decode-cbor round-trips e" "thing:pebble" (assoc-ref decoded "e"))
      (test-equal "decode-cbor round-trips a" "named" (assoc-ref decoded "a"))))

  ;; ni: identity: row-id called twice on the same row gives the identical
  ;; RFC 6920 ni: URI both times.
  (let* ((id-1 (call-worker worker "row-id" `(("row" . ,sample-row)) 'session))
         (id-2 (call-worker worker "row-id" `(("row" . ,sample-row)) 'session)))
    (test-assert "row-id is a ni: URI" (and (string? id-1) (string-prefix? "ni:///sha-256;" id-1)))
    (test-equal "row-id is deterministic across two calls" id-1 id-2)))

;; --- 3. a small trace appended then folded gives the expected projection --
(test-group "append + fold"
  (let* ((row-1 '(("e" . "thing:pebble") ("a" . "named") ("v" . "pebble") ("t" . 1)))
         (row-2 '(("e" . "thing:pebble") ("a" . "located-in") ("v" . "place:riverbed") ("t" . 2))))
    ;; append both rows durably to the tmp trace path.
    (call-worker worker "append" `(("path" . ,trace-path) ("row" . ,row-1)) 'session)
    (call-worker worker "append" `(("path" . ,trace-path) ("row" . ,row-2)) 'session)
    (test-assert "append actually wrote the trace file" (file-exists? trace-path))

    ;; fold the same trace (the node-worker holds no read-back-from-disk verb;
    ;; see the report finding) through the worker's fold verb.
    (let* ((folded (call-worker worker "fold"
                               `(("subject" . "thing:pebble")
                                 ("rows" . #(,row-1 ,row-2)))
                               'session))
           (fiber (assoc-ref folded "fiber")))
      (test-equal "fold names the folded entity" "thing:pebble" (assoc-ref folded "entity"))
      (test-equal "fold's fiber has one cell per distinct predicate" 2 (vector-length fiber))
      (let* ((cells (vector->list fiber))
             (named-cell (find (lambda (c) (equal? (assoc-ref c "predicate") "named")) cells))
             (location-cell (find (lambda (c) (equal? (assoc-ref c "predicate") "located-in")) cells)))
        (test-assert "fold produced a 'named' cell" named-cell)
        (test-equal "the 'named' cell's object is the asserted value" "pebble" (assoc-ref named-cell "object"))
        (test-equal "the 'named' cell reads affirmed (pos=1,neg=0)" 1 (assoc-ref (assoc-ref named-cell "value") "pos"))
        (test-equal "the 'named' cell has no negative evidence" 0 (assoc-ref (assoc-ref named-cell "value") "neg"))
        (test-assert "fold produced a 'located-in' cell" location-cell)
        (test-equal "the 'located-in' cell's object is the asserted value" "place:riverbed" (assoc-ref location-cell "object"))))))

;; --- 3b. fold honors opts.converse: a declared converse pair charges the --
;; positive predicate's negative face, settling to a held contradiction ----
;; (eavt 0.4.0's opts.converse compatibility lane; opts absent = 0.3.0 bytes) -
(test-group "fold + opts.converse"
  (let* ((row-open '(("e" . "thing:door") ("a" . "open") ("v" . "yes") ("t" . 1)))
         (row-shut '(("e" . "thing:door") ("a" . "shut") ("v" . "yes") ("t" . 2))))
    (let* ((folded (call-worker worker "fold"
                               `(("subject" . "thing:door")
                                 ("rows" . #(,row-open ,row-shut))
                                 ("opts" . (("converse" . (("shut" . "open"))))))
                               'session))
           (fiber (assoc-ref folded "fiber"))
           (cells (vector->list fiber))
           (open-cell (find (lambda (c) (equal? (assoc-ref c "predicate") "open")) cells)))
      (test-assert "fold produced an 'open' cell" open-cell)
      (test-equal "the 'open' cell reads affirmed (pos=1) from the direct row"
        1 (assoc-ref (assoc-ref open-cell "value") "pos"))
      (test-equal "the declared converse ('shut') charges 'open''s negative face (neg=1)"
        1 (assoc-ref (assoc-ref open-cell "value") "neg")))))

;; --- 4. entities lists appended subjects, deduped, first-occurrence order -----
(test-group "entities"
  ;; trace-path already carries thing:pebble's two rows from the append+fold group above;
  ;; append a second subject so entities must actually list/dedupe, not just echo one name.
  (let ((row-3 '(("e" . "thing:leaf") ("a" . "named") ("v" . "leaf") ("t" . 3))))
    (call-worker worker "append" `(("path" . ,trace-path) ("row" . ,row-3)) 'session))
  (let ((entities (call-worker worker "entities" `(("path" . ,trace-path)) 'session)))
    (test-assert "entities returns an array" (vector? entities))
    (test-equal "entities lists appended subjects, first-occurrence order"
      #("thing:pebble" "thing:leaf") entities)))

;; --- 5. fold-trace folds FROM DISK, matching an in-memory fold of the same rows ----
(test-group "fold-trace"
  (let* ((row-1 '(("e" . "thing:pebble") ("a" . "named") ("v" . "pebble") ("t" . 1)))
         (row-2 '(("e" . "thing:pebble") ("a" . "located-in") ("v" . "place:riverbed") ("t" . 2)))
         ;; from disk: the worker reads trace-path itself (it also carries thing:leaf's row by
         ;; now, from the entities group above; fold-trace filters to the requested subject, so
         ;; that extra row must not change the result).
         (from-disk (call-worker worker "fold-trace"
                                  `(("path" . ,trace-path) ("subject" . "thing:pebble"))
                                  'session))
         ;; in memory: the same two thing:pebble rows, folded without touching disk at all.
         (in-memory (call-worker worker "fold"
                                  `(("subject" . "thing:pebble") ("rows" . #(,row-1 ,row-2)))
                                  'session)))
    (test-equal "fold-trace (from disk) matches fold (in memory) on the same rows" in-memory from-disk)))

;; --- 6. an unknown verb is refused by the node-worker, as a typed record -----
(test-group "unknown-verb refusal"
  (let ((refusal (call-worker worker "not-a-real-verb" '() 'session)))
    (test-assert "the node-worker returns a refusal record, not a bare boolean"
      (and (refusal? refusal) (not (boolean? refusal))))
    (test-equal "refusal state is 'refused" 'refused (refusal-state refusal))
    (test-equal "refusal names the calling origin" 'session (refusal-by refusal))
    (test-assert "refusal carries a timestamp" (number? (refusal-at refusal)))
    (test-assert "refusal explains why" (string? (refusal-because refusal)))
    ;; the worker itself is never even asked: no verb of that name exists in
    ;; its handshake list.
    (test-assert "the unknown verb really is absent from the handshake"
      (not (member "not-a-real-verb" (worker-verbs worker))))))

;; --- 6b. WO-6 witness receipt: a receipt row lands for both a successful and a
;; refused call, appended to the acting entity's own trace before call-worker
;; returns (WO-6: "the return is output + a witness receipt row appended to the
;; acting thing's trace before results are surfaced"; "the refusal is itself a
;; recorded datum"). ------------------------------------------------------------
(define receipt-trace-path
  (string-append "/tmp/lagoon-receipt-test-" (number->string (getpid)) ".jsonl"))

(define (receipt-cleanup!)
  (when (file-exists? receipt-trace-path) (delete-file receipt-trace-path)))

(define (receipts-for path actor)
  (filter (lambda (row) (and (equal? (assoc-ref row "e") actor)
                              (equal? (assoc-ref row "a") "invocation-receipt")))
          (vector->list (call-worker worker "read" `(("path" . ,path)) 'local))))

(test-group "WO-6 witness receipt"
  (let ((actor "session:test-witness"))
    ;; a successful call carrying a receipt context appends exactly one receipt
    ;; row naming that call, before returning its ordinary result unchanged.
    (let ((result (call-worker worker "assert-row" `(("row" . ,sample-row)) 'session
                                `(("path" . ,receipt-trace-path) ("actor" . ,actor) ("t" . 1)))))
      (test-equal "the receipted call still returns its ordinary, unwrapped result"
        "thing:pebble" (assoc-ref result "e")))
    (let* ((rows (receipts-for receipt-trace-path actor))
           (receipt (and (pair? rows) (assoc-ref (car rows) "v"))))
      (test-equal "exactly one receipt row was appended for the successful call" 1 (length rows))
      (test-equal "the receipt names the called verb" "assert-row" (assoc-ref receipt "specVerb"))
      (test-equal "the receipt records a successful exit status" "ok" (assoc-ref receipt "exitStatus"))
      (test-assert "the receipt carries an input hash" (string? (assoc-ref receipt "inputHash")))
      (test-assert "the receipt carries an output hash" (string? (assoc-ref receipt "outputHash")))
      (test-assert "the receipt's wall-clock duration is a non-negative number"
        (let ((ms (assoc-ref receipt "wallClockMs"))) (and (number? ms) (>= ms 0))))
      (test-assert "the receipt carries an invocation id" (assoc-ref receipt "invocationId")))

    ;; a refused call (unknown verb) carrying the same receipt context also
    ;; appends a receipt — the admissibility refusal never reaches the Node
    ;; worker's own dispatch, but is still recorded as a datum.
    (let ((refusal (call-worker worker "not-a-real-verb" '() 'session
                                 `(("path" . ,receipt-trace-path) ("actor" . ,actor) ("t" . 2)))))
      (test-assert "the refused call still returns the ordinary typed refusal record"
        (refusal? refusal)))
    (let* ((rows (receipts-for receipt-trace-path actor))
           (refused-receipt (assoc-ref (list-ref rows 1) "v")))
      (test-equal "a second receipt row was appended for the refused call" 2 (length rows))
      (test-equal "the refusal's receipt names the refused verb" "not-a-real-verb"
        (assoc-ref refused-receipt "specVerb"))
      (test-equal "the refusal's receipt records a refused exit status" "refused"
        (assoc-ref refused-receipt "exitStatus")))))

;; --- 7. entity constitution: the EAVT sketch-lane <kind>:<ni-digest> address rule ------------
;; (see @red-cup-engineering/eavt-services-section's src/eavt.mjs for the three-sentence derivation, and why this
;; is the sketch-lane address, not the glass-sponge §9 typed-envelope semantic-identity law).
(test-group "entity constitution"
  (let* ((attrs '(("title" . "dig")))
         (constituted (call-worker worker "constitute"
                                    `(("kind" . "task") ("attributes" . ,attrs) ("t" . 1))
                                    'session))
         (address (assoc-ref constituted "address"))
         (genesis-row (assoc-ref constituted "genesisRow")))
    ;; constitute returns an address.
    (test-assert "constitute returns a string address" (string? address))
    (test-assert "the address is kind-prefixed" (string-prefix? "task:" address))
    (test-equal "the returned genesis row's e IS the derived address" address (assoc-ref genesis-row "e"))

    ;; constituting the same input twice gives the same address.
    (let* ((constituted-again (call-worker worker "constitute"
                                            `(("kind" . "task") ("attributes" . ,attrs) ("t" . 1))
                                            'session))
           (address-again (assoc-ref constituted-again "address")))
      (test-equal "constituting the same input twice gives the same address" address address-again))

    ;; verify-address recomputes the same address from the genesis row alone.
    (test-equal "verify-address recomputes the stored address"
      address (call-worker worker "verify-address" `(("row" . ,genesis-row)) 'session))

    ;; fold over the genesis row names the entity.
    (let* ((folded (call-worker worker "fold"
                               `(("subject" . ,address) ("rows" . #(,genesis-row)))
                               'session)))
      (test-equal "fold over the genesis row names the entity" address (assoc-ref folded "entity")))))

;; --- 8. observe-unit-inventory: its effect is advertised but not granted ---
;; The Node receiver independently exercises both refusal and an admitted
;; command.  This Guile boundary has no principal-session authority, so it
;; verifies the handshake advertises the controlled process effect instead of
;; bypassing the admission boundary to probe the local host.
(test-group "observe-unit-inventory"
  (let ((spec (worker-verb-spec worker "observe-unit-inventory")))
    (test-equal "observe-unit-inventory declares its process effect"
      '("process:execute") (vector->list (assoc-ref spec "effects")))
    (test-equal "observe-unit-inventory is a capability-effect operation"
      "capability-effect" (assoc-ref (assoc-ref (assoc-ref spec "operation") "body") "kind"))))

;; --- 9. look: a place plus its located-in things, drift held as ⊤ (WO-9) --------------------
;; A synthetic scratch trace, never the real world.eavt — the "held ⊤" mechanic under test is
;; the shipped eavt 0.4.0 opts.converse lane: a declared (running, has-converse, stopped) row
;; plus a same-subject "stopped"="yes" row charges the negative face of that subject's
;; "running"="yes" cell, landing pos:1,neg:1 — a genuine told-both, never Guile-computed.
(define look-trace-path
  (string-append "/tmp/lagoon-look-test-" (number->string (getpid)) ".jsonl"))

(define (look-cleanup!)
  (when (file-exists? look-trace-path) (delete-file look-trace-path)))

(test-group "look"
  (define (constitute-and-append! kind attrs t)
    (let* ((constituted (call-worker worker "constitute" `(("kind" . ,kind) ("attributes" . ,attrs) ("t" . ,t)) 'session))
           (genesis-row (assoc-ref constituted "genesisRow")))
      (call-worker worker "append" `(("path" . ,look-trace-path) ("row" . ,genesis-row)) 'session)
      (assoc-ref constituted "address")))

  (let* ((machine-address (constitute-and-append! "machine" '(("name" . "test-machine")) 1))
         (svc-a (constitute-and-append! "systemd-service" `(("name" . "svc-a") ("machine" . "test-machine")) 2))
         (svc-b (constitute-and-append! "systemd-service" `(("name" . "svc-b") ("machine" . "test-machine")) 3)))

    ;; the has-converse declaration row — a vocabulary row, not an entity (Layer 0 Declarations).
    (call-worker worker "append"
                 `(("path" . ,look-trace-path)
                   ("row" . (("e" . "running") ("a" . "has-converse") ("v" . "stopped") ("t" . 4))))
                 'session)

    ;; both services located-in the machine and desired running; only svc-b is observed stopped.
    (for-each (lambda (svc t)
                (call-worker worker "append" `(("path" . ,look-trace-path) ("row" . (("e" . ,svc) ("a" . "located-in") ("v" . ,machine-address) ("t" . ,t)))) 'session)
                (call-worker worker "append" `(("path" . ,look-trace-path) ("row" . (("e" . ,svc) ("a" . "running") ("v" . "yes") ("t" . ,t)))) 'session))
              (list svc-a svc-b) '(5 6))
    (call-worker worker "append" `(("path" . ,look-trace-path) ("row" . (("e" . ,svc-b) ("a" . "stopped") ("v" . "yes") ("t" . 7)))) 'session)

    (let* ((found (call-worker worker "look" `(("path" . ,look-trace-path) ("place" . "test-machine")) 'session))
           (things (vector->list (assoc-ref found "things")))
           (find-thing (lambda (addr) (find (lambda (th) (equal? (assoc-ref th "address") addr)) things)))
           (running-cell (lambda (th) (find (lambda (c) (equal? (assoc-ref c "predicate") "running")) (vector->list (assoc-ref th "fiber"))))))
      (test-equal "look resolves the place to its constituted address" machine-address (assoc-ref found "address"))
      (test-equal "look's placeAttributes names the place" "test-machine" (assoc-ref (assoc-ref found "placeAttributes") "name"))
      (test-equal "look lists both located-in things" 2 (length things))

      (let ((cell (running-cell (find-thing svc-a))))
        (test-equal "svc-a (told only running) reads affirmed" 1 (assoc-ref (assoc-ref cell "value") "pos"))
        (test-equal "svc-a (told only running) has no negative evidence" 0 (assoc-ref (assoc-ref cell "value") "neg")))

      (let ((cell (running-cell (find-thing svc-b))))
        (test-equal "svc-b (told running AND stopped) reads affirmed" 1 (assoc-ref (assoc-ref cell "value") "pos"))
        (test-equal "svc-b (told running AND stopped) is a genuine held ⊤ (neg=1)" 1 (assoc-ref (assoc-ref cell "value") "neg"))))

    (let ((missing (call-worker worker "look" `(("path" . ,look-trace-path) ("place" . "no-such-place")) 'session)))
      (test-assert "look on an unknown place returns a null address" (eq? 'null (assoc-ref missing "address")))
      (test-assert "look on an unknown place returns null placeAttributes" (eq? 'null (assoc-ref missing "placeAttributes")))
      (test-equal "look on an unknown place returns no things" 0 (vector-length (assoc-ref missing "things"))))

    ;; --- 9b. re-observation: a retraction tombstone resolves the held ⊤, a fresh assertion ------
    ;; re-raises it (the seed-systemd-services.mjs bug this fixes: it used to only ever APPEND
    ;; "stopped"="yes" and never retract it once a service came back up, so `look` held a ⊤
    ;; forever. The fix lives entirely in seed-systemd-services.mjs's own use of eavt's shipped
    ;; supersede + fold's already-shipped v:null retraction tombstone — nothing here or in
    ;; world-look.mjs changed; this test proves the SAME "look" verb already exercised above
    ;; renders both directions correctly once such a tombstone lands in the trace.)
    (define (svc-b-running-cell)
      (let* ((found (call-worker worker "look" `(("path" . ,look-trace-path) ("place" . "test-machine")) 'session))
             (things (vector->list (assoc-ref found "things")))
             (thing (find (lambda (th) (equal? (assoc-ref th "address") svc-b)) things)))
        (find (lambda (c) (equal? (assoc-ref c "predicate") "running")) (vector->list (assoc-ref thing "fiber")))))

    ;; svc-b was already told both "running" (t=6) and "stopped"="yes" (t=7) above: drift present.
    (let ((cell (svc-b-running-cell)))
      (test-equal "before retraction: svc-b still reads a held ⊤ (neg=1)" 1 (assoc-ref (assoc-ref cell "value") "neg")))

    ;; a later retraction tombstone (v: null) supersedes the stale "stopped" claim.
    (call-worker worker "append" `(("path" . ,look-trace-path) ("row" . (("e" . ,svc-b) ("a" . "stopped") ("v" . ,'null) ("t" . 8)))) 'session)
    (let ((cell (svc-b-running-cell)))
      (test-equal "after retraction: svc-b's 'running' cell still reads affirmed (pos=1)" 1 (assoc-ref (assoc-ref cell "value") "pos"))
      (test-equal "after retraction: the held ⊤ is resolved (neg=0)" 0 (assoc-ref (assoc-ref cell "value") "neg")))

    ;; a fresh "stopped"="yes" assertion after the tombstone re-raises the drift.
    (call-worker worker "append" `(("path" . ,look-trace-path) ("row" . (("e" . ,svc-b) ("a" . "stopped") ("v" . "yes") ("t" . 9)))) 'session)
    (let ((cell (svc-b-running-cell)))
      (test-equal "after a fresh assertion: the ⊤ re-raises (neg=1 again)" 1 (assoc-ref (assoc-ref cell "value") "neg")))))

;; --- 9c. look: recentDuties lists reported-at entities, newest-first, separate from things ---
;; (the office-founding lot's extension to world-look.mjs: a duty is not a permanent located-in
;; occupant, so it surfaces through its own capped, time-ordered field instead.)
(test-group "look + recentDuties"
  (define (constitute-and-append! kind attrs t)
    (let* ((constituted (call-worker worker "constitute" `(("kind" . ,kind) ("attributes" . ,attrs) ("t" . ,t)) 'session))
           (genesis-row (assoc-ref constituted "genesisRow")))
      (call-worker worker "append" `(("path" . ,look-trace-path) ("row" . ,genesis-row)) 'session)
      (assoc-ref constituted "address")))

  (let* ((office (constitute-and-append! "office" '(("name" . "recent-duty-test-office")) 20))
         (duty-early (constitute-and-append! "duty" '(("activity" . "skill-selected") ("name" . "early")) 21))
         (duty-late (constitute-and-append! "duty" '(("activity" . "skill-selected") ("name" . "late")) 22)))
    (call-worker worker "append" `(("path" . ,look-trace-path) ("row" . (("e" . ,duty-early) ("a" . "reported-at") ("v" . ,office) ("t" . 21)))) 'session)
    (call-worker worker "append" `(("path" . ,look-trace-path) ("row" . (("e" . ,duty-late) ("a" . "reported-at") ("v" . ,office) ("t" . 22)))) 'session)

    (let* ((found (call-worker worker "look" `(("path" . ,look-trace-path) ("place" . "recent-duty-test-office")) 'session))
           (duties (vector->list (assoc-ref found "recentDuties"))))
      (test-equal "look resolves the office" office (assoc-ref found "address"))
      (test-equal "look's things does not count duties as located-in occupants" 0 (vector-length (assoc-ref found "things")))
      (test-equal "recentDuties lists both reported-at duties" 2 (length duties))
      (test-equal "recentDuties orders newest-first" (list duty-late duty-early)
        (map (lambda (d) (assoc-ref d "address")) duties)))))

;; --- 10. go: an actor moves place, by pure append — never edited, never retracted -----------
;; (rows are appended, never edited; a second `go` leaves BOTH witnesses in the trace, per the
;; dispatcher's own instruction — no local retraction logic invented here).
(define go-trace-path
  (string-append "/tmp/lagoon-go-test-" (number->string (getpid)) ".jsonl"))

(define (go-cleanup!)
  (when (file-exists? go-trace-path) (delete-file go-trace-path)))

(test-group "go"
  (define (constitute-and-append! kind attrs t)
    (let* ((constituted (call-worker worker "constitute" `(("kind" . ,kind) ("attributes" . ,attrs) ("t" . ,t)) 'session))
           (genesis-row (assoc-ref constituted "genesisRow")))
      (call-worker worker "append" `(("path" . ,go-trace-path) ("row" . ,genesis-row)) 'session)
      (assoc-ref constituted "address")))

  (let* ((riverbed (constitute-and-append! "place" '(("name" . "riverbed")) 1))
         (meadow (constitute-and-append! "place" '(("name" . "meadow")) 2))
         (pebble (constitute-and-append! "thing" '(("name" . "pebble")) 3)))

    (let ((result (call-worker worker "go" `(("path" . ,go-trace-path) ("actor" . ,pebble) ("place" . "meadow") ("t" . 4)) 'session)))
      (test-equal "go resolves the named destination to its constituted address" meadow (assoc-ref result "address"))
      (test-equal "go echoes the actor" pebble (assoc-ref result "actor"))
      (test-equal "go echoes the place name" "meadow" (assoc-ref result "place")))

    (let* ((found (call-worker worker "look" `(("path" . ,go-trace-path) ("place" . "meadow")) 'session))
           (things (vector->list (assoc-ref found "things"))))
      (test-equal "look at the destination now finds the mover" 1 (length things))
      (test-equal "the mover found is the same actor that went there" pebble (assoc-ref (car things) "address")))

    ;; a second go to a different place: both located-in witnesses survive in the trace.
    (call-worker worker "go" `(("path" . ,go-trace-path) ("actor" . ,pebble) ("place" . "riverbed") ("t" . 5)) 'session)
    (let* ((at-riverbed (call-worker worker "look" `(("path" . ,go-trace-path) ("place" . "riverbed")) 'session))
           (at-meadow (call-worker worker "look" `(("path" . ,go-trace-path) ("place" . "meadow")) 'session)))
      (test-equal "go never retracts: the mover still reads located-in the first place too"
        1 (length (vector->list (assoc-ref at-riverbed "things"))))
      (test-equal "...and located-in the second place"
        1 (length (vector->list (assoc-ref at-meadow "things")))))

    ;; going to a place never constituted: the worker itself refuses the malformed call (an
    ;; ordinary ok:false error, not the node-worker's own typed unknown-verb refusal — the verb
    ;; "go" IS in the handshake list here).
    (test-error "go to an unconstituted place signals an error"
      #t
      (call-worker worker "go" `(("path" . ,go-trace-path) ("actor" . ,pebble) ("place" . "nowhere") ("t" . 6)) 'session))))

;; --- 11. say: an utterance is constituted and attributed to its speaker and place -------------
(define say-trace-path
  (string-append "/tmp/lagoon-say-test-" (number->string (getpid)) ".jsonl"))

(define (say-cleanup!)
  (when (file-exists? say-trace-path) (delete-file say-trace-path)))

(test-group "say"
  (define (constitute-and-append! kind attrs t)
    (let* ((constituted (call-worker worker "constitute" `(("kind" . ,kind) ("attributes" . ,attrs) ("t" . ,t)) 'session))
           (genesis-row (assoc-ref constituted "genesisRow")))
      (call-worker worker "append" `(("path" . ,say-trace-path) ("row" . ,genesis-row)) 'session)
      (assoc-ref constituted "address")))

  (let* ((riverbed (constitute-and-append! "place" '(("name" . "riverbed")) 1))
         (inhabitant (constitute-and-append! "session" '(("name" . "test-session")) 2)))

    (let ((result (call-worker worker "say"
                                `(("path" . ,say-trace-path) ("speaker" . ,inhabitant)
                                  ("place" . "riverbed") ("text" . "hello") ("t" . 3))
                                'session)))
      (test-assert "say returns a string address" (string? (assoc-ref result "address")))
      (test-assert "the address is utterance-kind-prefixed" (string-prefix? "utterance:" (assoc-ref result "address")))
      (test-equal "say echoes the place name" "riverbed" (assoc-ref result "place"))
      (test-equal "the genesis row's e IS the derived address" (assoc-ref result "address") (assoc-ref (assoc-ref result "genesisRow") "e"))
      (test-equal "the genesis row carries the spoken text" "hello"
        (assoc-ref (assoc-ref (assoc-ref result "genesisRow") "v") "text"))

      (let* ((address (assoc-ref result "address"))
             (folded (call-worker worker "fold-trace" `(("path" . ,say-trace-path) ("subject" . ,address)) 'session))
             (cells (vector->list (assoc-ref folded "fiber")))
             (spoken-by (find (lambda (c) (equal? (assoc-ref c "predicate") "spoken-by")) cells))
             (spoken-at (find (lambda (c) (equal? (assoc-ref c "predicate") "spoken-at")) cells)))
        (test-assert "the utterance is attributed to its speaker" spoken-by)
        (test-equal "...naming the speaker's own address" inhabitant (assoc-ref spoken-by "object"))
        (test-assert "the utterance is attributed to its place" spoken-at)
        (test-equal "...naming the place's own address" riverbed (assoc-ref spoken-at "object"))))

    ;; speaking at a place never constituted: refused the same way go's malformed call is.
    (test-error "say at an unconstituted place signals an error"
      #t
      (call-worker worker "say"
                    `(("path" . ,say-trace-path) ("speaker" . ,inhabitant)
                      ("place" . "nowhere") ("text" . "hello") ("t" . 4))
                    'session))))

(close-worker worker)
(cleanup!)
(receipt-cleanup!)
(look-cleanup!)
(go-cleanup!)
(say-cleanup!)

;; --- 12. verify.scm: the WO-6 session-start spec check as a runnable command,
;; run for real against the real worker (no double: this is scripts/verify.scm
;; itself, spawned, not a re-implementation of its check here). --------------
(test-group "verify.scm"
  (let* ((verify-script (string-append (app-root) "/scripts/verify.scm"))
         (port (open-input-pipe (string-append "guile " verify-script " 2>/dev/null")))
         (lines (let loop ((acc '()))
                  (let ((line (read-line port)))
                    (if (eof-object? line) (reverse acc) (loop (cons line acc))))))
         (status (close-pipe port))
         (recount-worker (open-worker))
         (expected-verb-count (length (worker-verbs recount-worker))))
    (close-worker recount-worker)
    (test-assert "verify.scm printed one line per declared verb"
      (= (length lines) expected-verb-count))
    (test-assert "verify.scm's lines each name a verb with all three schemas"
      (every (lambda (line) (string-contains line "args:yes returns:yes refusal:yes")) lines))
    (test-equal "verify.scm exits 0 against the real worker (every verb fully specified)"
      0 (status:exit-val status))))

(define result-runner (test-runner-current))
(test-end "lagoon-node-worker-wo6")
(exit (if (and (= 0 (test-runner-fail-count result-runner))
               (= 0 (test-runner-xpass-count result-runner))) 0 1))
