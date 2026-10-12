;;; (node-worker) — WO-6, the Guile body invoking one Node worker.
;;;
;;; The node-worker is deliberately small and boring. It spawns the Node worker
;;; (computer-system-engine's generic stdio verb server, given LAGOON's own
;;; composed verbs module) as a child process, speaks newline-delimited
;;; JSON frames over its stdin/stdout, and does exactly three things:
;;;
;;;   1. a session-start handshake — ask the worker's "verbs" verb what it
;;;      exposes, and remember the full typed spec (args/returns/refusal
;;;      schemas) each verb answered with, never just its bare name;
;;;   2. call-worker — send one frame, read the matching reply, and PROJECT the
;;;      reply's JSON value into a Guile value (guile-json's parse — no byte
;;;      interpretation, no re-encoding, no local computation of anything the
;;;      worker could answer instead);
;;;   3. refuse, as a typed record, any verb whose remembered spec lacks an
;;;      args schema — including a verb the handshake never named at all —
;;;      the node-worker never asks the worker to do something it did not
;;;      first claim, with a stated contract, to be able to do.
;;;
;;; Per the owner's binary law (2026-08-30): I/O and data transformation are
;;; Node's job; Guile maps operational reality. This module holds NO fold, no
;;; hash, no canonicalization, no CBOR/base64 decode — every substrate law
;;; (row identity, canonical encoding, append, fold) is a leaf-call to
;;; @red-cup-engineering/eavt-services-section through its own generic verbs module, served over
;;; stdio. A Guile-resident value here is only ever a projection of what the
;;; worker already answered.
;;;
;;; Every call is tagged with an origin symbol from the WO-6 closed enum:
;;; local (kernel housekeeping), cross-thing (one thing's rule invoking
;;; another's affordance), session (a mask-wearing inhabitant), driver
;;; (scheduler/heartbeat).
;;;
;;; WO-6 also requires: "the return is output + a witness receipt row appended
;;; to the acting thing's trace before results are surfaced." call-worker
;;; takes an optional RECEIPT context — an alist of "path" (the trace to
;;; append to), "actor" (the acting entity's address), and "t" (the trace
;;; ordinal the caller assigns the receipt, exactly as every other domain
;;; verb already takes its own explicit t). When given, a receipt row is
;;; appended before call-worker returns, on every outcome: a successful
;;; call, a worker-reported error, and a Guile-side admissibility refusal.
;;; The two hashes (of the call's args and of its outcome) and the append
;;; itself are leaf-calls to already-handshaked worker verbs (row-id,
;;; append) — this module still performs no hashing or canonical encoding
;;; of its own; only the call's wall-clock duration is measured here, with
;;; Guile's own clock, since that is instrumentation of the call, not a
;;; substrate law over its data.

(define-module (node-worker)
  #:use-module (ice-9 popen)
  #:use-module (ice-9 rdelim)
  #:use-module (srfi srfi-9)
  #:use-module (srfi srfi-1)
  #:use-module (json)
  #:export (open-worker
            close-worker
            worker-verbs
            worker-verb-spec
            worker-type-system-identity
            worker-type-system
            call-worker
            origins
            refusal?
            refusal-state
            refusal-by
            refusal-at
            refusal-because))

;; The WO-6 closed enum of call origins. No richer provenance scheme yet.
(define origins '(local cross-thing session driver))

;; A refusal is ALWAYS this typed record — never a bare boolean (WO standing
;; rule). state is 'refused; by is the origin that made the refused call; at
;; is the epoch-second the refusal happened; because is a human-readable
;; string naming the reason.
(define-record-type <refusal>
  (make-refusal state by at because)
  refusal?
  (state   refusal-state)
  (by      refusal-by)
  (at      refusal-at)
  (because refusal-because))

(define (refuse origin because)
  (make-refusal 'refused origin (current-time) because))

;; A worker is the spawned Node process plus the SPECS its handshake
;; reported — an alist of (verb-name . spec-entry), spec-entry itself the
;; parsed handshake alist ("verb"/"args"/"returns"/"refusal") for that verb
;; — plus a request-id counter. Opaque outside this module. worker-specs is
;; internal; worker-verbs and worker-verb-spec are the module's public
;; readers over it (WO-6: "the contract is one typed spec file naming every
;; verb either side exposes, checked at session start").
(define-record-type <worker>
  (make-worker port specs id-box type-system-identity type-system)
  worker?
  (port    worker-port)
  (specs   worker-specs)
  (id-box  worker-id-box)
  (type-system-identity worker-type-system-identity)
  (type-system worker-type-system))

;; worker-verbs — the verb names the handshake declared, in handshake order.
(define (worker-verbs worker)
  (map car (worker-specs worker)))

;; worker-verb-spec — the full spec alist ("verb"/"args"/"returns"/"refusal")
;; the handshake reported for one verb, or #f if the handshake never named
;; it. A key present in "args"/"returns"/"refusal" is itself #f exactly when
;; the worker's own handshake reply omitted that key (guile-json's own
;; assoc-ref-on-missing-key behaviour) — never inferred or filled in here.
(define (worker-verb-spec worker verb)
  (assoc-ref (worker-specs worker) verb))

(define (next-id! worker)
  (let* ((box (worker-id-box worker))
         (n (+ 1 (car box))))
    (set-car! box n)
    n))

;; computer-system-engine's own root, fixed rather than derived: `current-filename` is unreliable
;; here — it reads #f once this module has been auto-compiled to its .go cache (a real Guile
;; quirk, checked directly, not assumed), so a path derived from it would work uncompiled and
;; break silently once cached. Every JSNode process this Guile module spawns is normal computing
;; (WO-6 rule 5: computer-systems-engineering owns the software; LAGOON, a Guile engine, holds no
;; JavaScript of its own at all), so it is always computer-system-engine's own generic stdio verb
;; server (scripts/serve-verbs-over-stdio.mjs) that is spawned — no worker script of LAGOON's own
;; exists anymore. COMPUTER_SYSTEM_ENGINE_ROOT overrides the constant for relocated checkouts.
(define computer-system-engine-root
  (or (getenv "COMPUTER_SYSTEM_ENGINE_ROOT")
      "/home/emsenn/info/lib/emsenn/services/561-group/services/engineering-services-section/services/computer-engineering-services-section/services/computer-systems-engineering-services-section/apps/computer-system-engine"))

;; Bare package specifiers, resolved by the tree's house resolver exactly as every other Node
;; process this repository spawns already resolves them (NODE_OPTIONS --import
;; register-house-resolver.mjs, ambient in the invoking environment — this module sets nothing
;; itself, the same as this module's own prior single-script spawn never did either).
;; Every verb a Guile caller needs, across the four owners that publish one: EAVT's own generic
;; verbs, FeltOS's flatfile resource inspection and world look/go/say, systemd unit observation,
;; and inference procurement. `--verbs` repeats (the generic server's own composition: one process,
;; one shared type catalog, rule 10 — no merge file of LAGOON's own, LAGOON holds no JavaScript at
;; all). One owner's own broken import (inference-dispatch-service's, currently) is served without
;; by the generic server itself, never by anything here.
(define (default-worker-command)
  (list "node" (string-append computer-system-engine-root "/scripts/serve-verbs-over-stdio.mjs")
        "--verbs" "@red-cup-engineering/eavt-services-section/verbs"
        "--verbs" "@red-cup-engineering/flatfile-resource-graph-service/flatfile-world-verbs"
        "--verbs" "@red-cup-engineering/computer-code-development-engine/flatfile-inspection-verbs"
        "--verbs" "@red-cup-engineering/systemd-unit-inventory-observation-service/observe-unit-inventory-verb"
        "--verbs" "@red-cup-engineering/computer-inference-engine/dispatch/inference-work-verbs"))

;; send-frame! — write one JSON frame line to the worker and flush. The ONLY
;; encoding step in this module: JSON text is the wire's own frame plumbing,
;; not a data transformation of what the frame carries.
(define* (send-frame! port id verb args origin #:optional (type-system-identity #f))
  (display (scm->json-string
            `(("id" . ,id)
              ("verb" . ,verb)
              ("args" . ,(or args '()))
              ("typeSystemIdentity" . ,type-system-identity)
              ("origin" . ,(symbol->string origin))))
           port)
  (newline port)
  (force-output port))

;; read-reply — read one reply line and project it to a Guile value via
;; guile-json. No interpretation of what the value MEANS happens here.
(define (read-reply port)
  (let ((line (read-line port)))
    (if (eof-object? line)
        (error "lagoon node-worker: worker closed its output before replying")
        (json-string->scm line))))

;; open-worker — spawn the Node worker and run the session-start handshake:
;; ask its "verbs" verb what it exposes, and remember the FULL spec each
;; entry carries (args/returns/refusal schemas, WO-6's typed contract) —
;; never just the bare name. Every later call-worker refuses any verb whose
;; remembered spec lacks an args schema, which subsumes a verb absent from
;; the handshake entirely (its spec is simply #f).
(define* (open-worker #:optional (command (default-worker-command)))
  (let* ((port (apply open-pipe* OPEN_BOTH command))
         (id 0))
    (send-frame! port id "verbs" '() 'local)
    (let* ((reply (read-reply port))
           (ok (assoc-ref reply "ok")))
      (unless (eq? ok #t)
        (error "lagoon node-worker: worker refused its own verbs handshake"
               (assoc-ref reply "error")))
      (unless (equal? (assoc-ref reply "id") id)
        (error "lagoon node-worker: handshake reply id mismatch"))
      (let* ((identity (assoc-ref reply "typeSystemIdentity"))
             (entries (vector->list (assoc-ref reply "value")))
             (specs (map (lambda (entry) (cons (assoc-ref entry "verb") entry)) entries)))
        (unless (and (string? identity)
                     (every (lambda (entry) (equal? identity (assoc-ref entry "typeSystemIdentity"))) entries))
          (error "lagoon node-worker: handshake lacks one shared type catalog"))
        (unless (equal? identity (assoc-ref (assoc-ref reply "typeSystem") "identity"))
          (error "lagoon node-worker: handshake catalog differs from its declared identity"))
        (make-worker port specs (cons 0 #f) identity (assoc-ref reply "typeSystem"))))))

(define (close-worker worker)
  (close-pipe (worker-port worker)))

;; append-receipt! — the WO-6 witness receipt row: {invocationId, specVerb,
;; inputHash, outputHash, exitStatus, wallClockMs} as the "v" of one strict
;; {e,a,v,t} row, e the receipt-context's actor, a "invocation-receipt", t
;; the receipt-context's own t. input-hash and output-hash are the
;; already-handshaked "row-id" verb called on the call's args and outcome in
;; turn; the append is the already-handshaked "append" verb — never a hash
;; or a canonical encoding computed in this module. Called with origin
;; 'local (the kernel housekeeping act of witnessing a call is not itself
;; the call being witnessed).
(define (append-receipt! worker receipt invocation-id verb args outcome exit-status started)
  (let* ((path (assoc-ref receipt "path"))
         (actor (assoc-ref receipt "actor"))
         (t (assoc-ref receipt "t"))
         (input-hash (call-worker worker "row-id" `(("row" . ,args)) 'local))
         (output-hash (call-worker worker "row-id" `(("row" . ,outcome)) 'local))
         (wall-clock-ms (round (/ (* 1000 (- (get-internal-real-time) started))
                                  internal-time-units-per-second)))
         (row `(("e" . ,actor)
                ("a" . "invocation-receipt")
                ("v" . (("invocationId" . ,invocation-id)
                        ("specVerb" . ,verb)
                        ("inputHash" . ,input-hash)
                        ("outputHash" . ,output-hash)
                        ("exitStatus" . ,exit-status)
                        ("wallClockMs" . ,wall-clock-ms)))
                ("t" . ,t))))
    (call-worker worker "append" `(("path" . ,path) ("row" . ,row)) 'local)))

;; verb-admissible? — WO-6's typed-contract check: a verb is admissible only
;; when the session-start handshake reported it AND its spec carries an args
;; schema. This is the whole check: Guile only checks the CONTRACT IS
;; PRESENT, never validates a call's argument VALUES against that schema —
;; that is data transformation and belongs to Node (the language law,
;; owner-ruled 2026-08-30). A verb wholly absent from the handshake has spec
;; #f, so it fails this the same way a present-but-incomplete spec does —
;; one check, not two.
(define (verb-admissible? worker verb)
  (let ((spec (worker-verb-spec worker verb)))
    (and spec (assoc-ref spec "args") #t)))

;; call-worker — the node-worker's one verb for reaching the Node actuators.
;; Refuses (typed record, never a bare boolean) any verb whose spec is not
;; admissible per verb-admissible? above — an unknown verb, or a verb the
;; handshake named but whose spec lacks an args schema alike. Otherwise
;; sends the frame, reads the matching reply, and either returns the
;; projected value (ok: #t) or errors with the worker's own reported error
;; (ok: #f) — the node-worker adds nothing to it.
;;
;; RECEIPT, when given, is an alist of "path"/"actor"/"t" (see append-receipt!
;; above): a witness receipt row is appended before this call's outcome is
;; returned or raised, on every outcome — success, worker-reported error, and
;; Guile-side admissibility refusal alike (WO-6: "the refusal is itself a
;; recorded datum").
(define* (call-worker worker verb #:optional (args '()) (origin 'local) (receipt #f))
  (unless (memq origin origins)
    (error "lagoon node-worker: unknown call origin" origin))
  (let ((started (get-internal-real-time)))
    (if (not (verb-admissible? worker verb))
        (let* ((invocation-id (next-id! worker))
               (result (refuse origin (string-append "verb spec missing args contract: " verb))))
          (when receipt
            (append-receipt! worker receipt invocation-id verb args
                              `(("state" . "refused") ("because" . ,(refusal-because result)))
                              "refused" started))
          result)
        (let* ((invocation-id (next-id! worker))
               (port (worker-port worker)))
          (send-frame! port invocation-id verb args origin (worker-type-system-identity worker))
          (let* ((reply (read-reply port))
                 (reply-id (assoc-ref reply "id"))
                 (ok (assoc-ref reply "ok")))
            (unless (equal? reply-id invocation-id)
              (error "lagoon node-worker: reply id did not match request id"
                     (list 'sent invocation-id 'got reply-id)))
            (unless (equal? (assoc-ref reply "typeSystemIdentity") (worker-type-system-identity worker))
              (error "lagoon node-worker: reply type catalog changed after handshake"))
            (if (eq? ok #t)
                (let ((value (assoc-ref reply "value")))
                  (when receipt
                    (append-receipt! worker receipt invocation-id verb args value "ok" started))
                  value)
                (let ((err (assoc-ref reply "error")))
                  (when receipt
                    (append-receipt! worker receipt invocation-id verb args err "error" started))
                  (error "lagoon node-worker: worker reported an error" err))))))))
