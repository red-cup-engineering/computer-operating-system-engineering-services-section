;;; LAGOON's application deployment entry. Guix owns builds and generations.
;;; Run with guix time-machine -C CHANNELS -- repl -- THIS-FILE ARGUMENTS...
(use-modules (guix profiles) (guix channels) (guix describe)
             ((guix scripts build) #:select (register-root))
             ((guix store) #:select (with-store valid-path-syntax? valid-path? add-temp-root))
             (ice-9 match) (ice-9 popen) (ice-9 rdelim)
             (ice-9 ftw) (ice-9 regex) (ice-9 format) (ice-9 textual-ports) (json) (srfi srfi-1))
(umask #o077)

(define (run . args)
  (unless (zero? (apply system* args)) (error "deployment command failed" (car args))))
(define (cleanup label thunk)
  (catch #t (lambda () (thunk) #t)
    (lambda args
      (format (current-error-port) "Cleanup did not finish (~a); retained files may remain.~%" label) #f)))
(define (capture . args)
  (let* ((port (apply open-pipe* OPEN_READ args))
         (body (get-string-all port)) (status (close-pipe port)))
    (unless (zero? status) (error "deployment command failed" (car args)))
    (string-trim-both body)))
(define (current-pinned-guix channels)
  (let ((profile (current-profile)) (expected (load channels))
        (actual (current-channels)))
    (define (revisions channels)
      (map (lambda (channel) (cons (channel-name channel) (channel-commit channel))) channels))
    (and profile (pair? expected) (equal? (revisions expected) (revisions actual))
         (string-append (canonicalize-path profile) "/bin/guix"))))
(define (guix-command channels)
  (let ((installed (current-pinned-guix channels)))
    (if installed (list installed) (list "guix" "time-machine" "-C" channels "--"))))
(define (guix channels . args)
  (apply run (append (guix-command channels) args)))
(define (exists? file)
  (catch 'system-error
    (lambda () (lstat file))
    (lambda args
      ;; An unreadable original must never be recorded as a missing file.
      (if (equal? ENOENT (system-error-errno args)) #f (apply throw args)))))
(define (artifact profile)
  (match (manifest-entries (profile-manifest profile))
    (() #f)
    ((entry) (manifest-entry-item entry))
    (_ (error "application profile contains more than one package" profile))))
(define (layout store)
  (call-with-input-file (string-append store "/.guix-systemd/deployment.scm") read))
(define* (actor-only-host? store #:optional required?)
  ;; Missing or unreadable retained configuration cannot prove safe resumption.
  (and store
    (catch #t
      (lambda ()
        (let ((host (call-with-input-file (string-append store "/deployment/host.json") json->scm)))
          (and (equal? "feltos.enterprise-host" (assoc-ref host "hostKind"))
               (equal? "actor-only" (assoc-ref (assoc-ref host "web") "executionRole")))))
      (lambda args (if required? (apply throw args) #f)))))
(define (systemctl . args) (apply run "systemctl" "--user" args))
(define (stop-unit unit)
  ;; stop also waits out activating/deactivating transitions. A read of
  ;; is-active followed by conditional stop would leave an admission race.
  (unless (equal? "not-found"
            (capture "systemctl" "--user" "show" "--property=LoadState" "--value" unit))
    (systemctl "stop" unit)))
(define (enabled-state unit)
  (let* ((port (open-pipe* OPEN_READ "systemctl" "--user" "is-enabled" unit))
         (state (string-trim-both (get-string-all port)))
         (status (status:exit-val (close-pipe port))))
    ;; is-enabled normally returns nonzero for disabled/masked/missing units.
    ;; Empty output, unknown states and failed queries are not disabled intent.
    (unless (or (and (equal? status 0)
                     (member state '("enabled" "enabled-runtime" "static" "alias" "indirect" "generated")))
                (and (equal? status 1)
                     (member state '("disabled" "linked" "linked-runtime" "masked" "masked-runtime" "transient")))
                (and (equal? status 4) (equal? state "not-found")))
      (error "cannot determine unit enablement" unit state status))
    state))
(define (enabled? unit) (member (enabled-state unit) '("enabled" "enabled-runtime")))
(define (disable-unit unit)
  (let loop ((state (enabled-state unit)))
    (when (member state '("enabled" "enabled-runtime"))
      (apply systemctl "disable" (append (if (equal? state "enabled-runtime") '("--runtime") '()) (list unit)))
      (let ((next (enabled-state unit)))
        (when (equal? state next) (error "unit remained enabled" unit))
        (loop next)))))
(define (units store)
  (filter (lambda (name) (any (lambda (suffix) (string-suffix? suffix name))
                            '(".service" ".socket" ".timer")))
          (scandir (string-append store "/.guix-systemd"))))
(define (unit-path name) (string-append (getenv "HOME") "/.config/systemd/user/" name))
(define (configuration-unit-names config)
  (if config (filter-map (lambda (spec)
    (let ((path (assoc-ref spec "path")))
      (and (equal? (dirname path) (dirname (unit-path "unit")))
           (any (lambda (suffix) (string-suffix? suffix path)) '(".service" ".timer" ".socket"))
           (basename path)))) (assoc-ref config 'configuration-files)) '()))
(define (replace-file source target mode)
  (run "mkdir" "-p" (dirname target))
  (let ((next (string-append target ".lagoon-" (number->string (getpid)))))
    (copy-file source next) (chmod next mode) (sync-path next)
    (rename-file next target) (sync-path (dirname target))))
(define (save-file path scratch index)
  (let* ((info (exists? path))
         (link (and info (eq? (stat:type info) 'symlink) (readlink path)))
         (saved (string-append scratch "/" (number->string index))))
    (when info
      (if link (symlink link saved) (begin (copy-file path saved) (sync-path saved))))
    (list path saved link (and info (not link) (stat:perms info)))))
(define (restore-file saved)
  (match saved
    ((path backup link mode)
     (cond (link
            (let ((next (string-append path ".lagoon-" (number->string (getpid)))))
              (symlink link next) (rename-file next path) (sync-path (dirname path))))
           (mode (replace-file backup path mode))
           ((exists? path) (delete-file path) (sync-path (dirname path)))))))
(define* (configuration-commands config action store #:optional (restoring? #f))
  (for-each
    (lambda (spec)
      (let ((command (assoc-ref spec action)))
        (when (and command
                   (not (and restoring? (equal? (vector-ref command 0) "systemctl"))))
          (apply run
            (map (lambda (word)
              (let ((position (string-contains word "{release}")))
                (if position
                  (string-append (substring word 0 position) store
                                 (substring word (+ position 9))) word)))
              (vector->list command))))))
    (assoc-ref config 'configuration-files)))
(define (healthy? url store)
  (let ((deadline (+ (get-internal-real-time) (* 600 internal-time-units-per-second))))
    (let loop ()
      (if (catch #t
            (lambda ()
              (let ((reading (json-string->scm
                (capture "curl" "--fail" "--silent" "--show-error" "--max-time" "3" url))))
                (and (eq? #t (assoc-ref reading "ok"))
                     (equal? store (assoc-ref reading "artifact")))))
            (lambda args #f)) #t
          (if (< (get-internal-real-time) deadline) (begin (sleep 3) (loop))
              (error "application did not become healthy"))))))

;; Actual unit state is the admission/drain boundary, not a fabricated receipt.
(define (job-prefix main)
  (string-append (string-drop-right main (string-length ".service")) "-job-"))
(define (job-unit? main name) (string-prefix? (job-prefix main) name))
(define (job-units main)
  (filter-map (lambda (line)
    (let ((words (string-tokenize line))) (and (pair? words) (car words))))
    (string-split (capture "systemctl" "--user" "list-units" "--all" "--plain"
      "--no-legend" "--type=service" (string-append (job-prefix main) "*.service")) #\newline)))
(define (busy? name)
  (or (member (capture "systemctl" "--user" "show" "--property=ActiveState" "--value" name)
              '("active" "activating" "deactivating" "reloading"))
      ;; A worker may queue its publisher while exiting. Native Job is empty
      ;; only when no systemd start/stop job remains for the unit.
      (not (string-null? (capture "systemctl" "--user" "show" "--property=Job" "--value" name)))))
(define* (wait-units names #:optional (discover (lambda () '())))
  (let loop ()
    (let ((busy (filter busy? (delete-duplicates (append names (discover))))))
      (unless (null? busy)
        (format (current-error-port) "Waiting for existing jobs to finish: ~a~%" busy)
        (sleep 5) (loop)))))
(define (check-cutover-writers config store)
  ;; A writer needs a current declaration or explicit retirement in the target.
  ;; Merely naming it in the quiescence set never retires its policy.
  (let ((declared (append (units store) (configuration-unit-names config)
                          (assoc-ref config 'retired-units))))
    (for-each (lambda (name)
      (when (and (not (member name declared))
                 (not (job-unit? (assoc-ref config 'main-unit) name))
                 (or (busy? name) (enabled? name)))
        (error "first-cutover lacks a compatible current declaration for active/enabled writer" name)))
      (assoc-ref config 'state-writers))))
(define (check-state config store)
  (when (assoc-ref config 'state-check)
    (run (string-append store "/bin/node") (assoc-ref config 'state-check)
         (assoc-ref config 'state-plan))))
(define (cutover-state config store phase work original-artifact)
  (run (string-append store "/bin/node") (assoc-ref config 'first-cutover)
       phase (assoc-ref config 'state-plan) work "--writers-stopped"
       "--original-artifact" original-artifact))

;; The first native generation is the real configured application, even when
;; it is unhealthy. Never infer that baseline from old current/profile aliases.
(define (configured-artifact main)
  (let* ((command (capture "systemctl" "--user" "show" "--property=ExecStart" "--value" main))
         (match (string-match "path=([^ ;]+)" command)))
    (unless match (error "main unit has no configured executable" main))
    (let* ((program (canonicalize-path (match:substring match 1)))
           (root (string-match "^(/gnu/store/[^/]+)(/|$)" program)))
      (unless root (error "configured application is not an immutable Guix output" main))
      (let* ((store (match:substring root 1))
             (pid (string->number (capture "systemctl" "--user" "show" "--property=MainPID" "--value" main))))
        (when (and pid (> pid 0))
          (let ((command-line (call-with-input-file
                    (string-append "/proc/" (number->string pid) "/cmdline") get-string-all)))
            (unless (string-contains command-line (string-append store "/"))
              (error "running process differs from configured output; establish its actual baseline" main))))
        (format (current-error-port) "Configured application baseline (health not assumed): ~a~%" store)
        store))))

;; An absent first-generation unit has no configured/running application to
;; identify historical readers. Use only the actual native manifest's one valid
;; immutable artifact, after positively establishing that absence. Configured
;; applications still use their real executable and must match that artifact.
(define (initial-artifact main held-store)
  (let ((state (capture "systemctl" "--user" "show" "--property=LoadState" "--value" main)))
    (if (equal? state "not-found")
      (begin
        (unless (and (equal? "0" (capture "systemctl" "--user" "show"
                              "--property=MainPID" "--value" main))
                     (not (busy? main)))
          (error "absent main unit still has a writer or queued job" main))
        (unless (and held-store (valid-path-syntax? held-store)
                     (with-store connection (valid-path? connection held-store)))
          (error "absent initial unit has no valid held native artifact" main))
        (format (current-error-port)
          "Absent initial unit: held native artifact supplies historical readers: ~a~%" held-store)
        held-store)
      (configured-artifact main))))

;; Install exactly one existing store output with Guix's ordinary manifest API.
;; No candidate receipt, custom generation link, retention ledger or GC writer.
(define (install-artifact channels profile store scratch)
  (let ((file (string-append scratch "/manifest.scm")))
    (call-with-output-file file
      (lambda (port)
        (format port "(use-modules (guix profiles))~%(manifest (list (manifest-entry (name ~s) (version ~s) (item ~s))))~%"
                "lagoon-application" "1" store)))
    (guix channels "package" (string-append "--profile=" profile)
          (string-append "--manifest=" file))))
(define (restore-generation channels profile number)
  (unless (= number (generation-number profile))
    (if (and (zero? number) (not (file-exists? (generation-file-name profile 0))))
      ;; A first install has generation 1. Guix itself realizes empty generation 0.
      (guix channels "package" (string-append "--profile=" profile) "--roll-back")
      (guix channels "package" (string-append "--profile=" profile)
            (string-append "--switch-generation=" (number->string number)))))
  (unless (= number (generation-number profile)) (error "profile restoration failed")))

(define (sync-path path)
  (let ((fd (open-fdes path O_RDONLY)))
    (dynamic-wind (lambda () #t) (lambda () (fsync fd)) (lambda () (close-fdes fd)))))
(define (durable-write file value)
  (let ((next (string-append file ".next")))
    (call-with-output-file next
      (lambda (port) (write value port) (newline port) (force-output port) (fsync port)))
    (rename-file next file) (sync-path (dirname file))))
(define (acquire-retirement-lock config)
  (and (assoc-ref config 'retirement-lock)
    (let ((port (open-file (assoc-ref config 'retirement-lock) "a")))
      ;; flock locks the inherited open-file description; our descriptor keeps
      ;; that existing application lock held after the utility exits.
      (fcntl port F_SETFD 0)
      (catch #t
        (lambda ()
          (run "flock" "--exclusive" "--wait" "45" (number->string (fileno port)))
          (fcntl port F_SETFD FD_CLOEXEC) port)
        (lambda args (close-port port) (apply throw args))))))
(define* (restore-activation channels profile scratch #:optional held-lock)
  (let* ((record (call-with-input-file (string-append scratch "/restore.scm") read))
         (store (assoc-ref record 'candidate-store)) (config (layout store))
         (held-store (assoc-ref record 'held-store))
         (held-config (and held-store
           (file-exists? (string-append held-store "/.guix-systemd/deployment.scm")) (layout held-store)))
         (resume-state-writers?
           (not (and (equal? "cold-red-gate-561-group.service" (assoc-ref config 'main-unit))
                     (actor-only-host? store #t) (not (actor-only-host? held-store)))))
         (state-writers (delete-duplicates
           (append (cons (assoc-ref config 'main-unit) (assoc-ref config 'state-writers))
             (if held-config (cons (assoc-ref held-config 'main-unit)
                                   (assoc-ref held-config 'state-writers)) '()))))
         (affected (assoc-ref record 'affected)) (draining (assoc-ref config 'drain-units))
         (saved (assoc-ref record 'files))
         (changed? (assoc-ref record 'changed?)) (stopped? (assoc-ref record 'stopped?))
         (state-started? (assoc-ref record 'state-started?))
         (lock held-lock) (own-lock? #f) (lock-ok? #t)
         (failures '()) (stops-ok? #t) (profile-ok? #t) (files-ok? #t) (state-ok? #t))
    (define (attempt label thunk)
      (catch #t (lambda () (thunk) #t)
        (lambda failure
          (set! failures (cons label failures))
          (format (current-error-port) "Restoration step failed: ~a~%" label) #f)))
    (unless (equal? profile (assoc-ref record 'profile)) (error "backup belongs to another profile"))
    (when (and changed? (not lock) (assoc-ref config 'retirement-lock))
      (unless (attempt "acquire existing application retirement lock"
                (lambda () (wait-units draining) (set! lock (acquire-retirement-lock config)) (set! own-lock? #t)))
        (set! stops-ok? #f) (set! lock-ok? #f) (set! files-ok? #f)))
    (when changed?
      (for-each (lambda (name)
        (unless (attempt (string-append "stop " name) (lambda () (stop-unit name)))
          (set! stops-ok? #f))) (lset-difference equal? affected
            (append draining (if lock-ok? '() (assoc-ref config 'retired-units))))))
    (unless resume-state-writers?
      ;; Restoring bytes and compatible state must not resume a legacy worker
      ;; that can admit financial schedules. Preserve its recorded intent, but
      ;; hold only affected state writers; independent in-flight jobs still drain.
      (for-each (lambda (name)
        (unless (attempt (string-append "hold unsafe retained writer " name)
                  (lambda () (stop-unit name)))
          (set! stops-ok? #f))
        (attempt (string-append "withhold unsafe retained enablement " name)
          (lambda () (disable-unit name))))
        (lset-difference equal? (lset-intersection equal? affected state-writers) draining))
      (format (current-error-port)
        "Operating restoration incomplete: retained Cold Red Gate host is not proven actor-only; affected state writers will not be resumed. Backups: ~a~%" scratch))
    (when stopped?
      (for-each (lambda (pair)
        (attempt (string-append "disable " (car pair))
          (lambda () (disable-unit (car pair))))) (assoc-ref record 'enabled)))
    (when state-started?
      (set! state-ok? (and stops-ok?
        (attempt "drain new jobs"
          (lambda () (wait-units (assoc-ref config 'state-writers)
            (lambda () (job-units (assoc-ref config 'main-unit))))))
        (attempt "restore first-cutover state"
          (lambda () (cutover-state config store "restore" (assoc-ref record 'state-work) held-store))))))
    ;; Guix remains the only generation authority, even after process failure.
    (set! profile-ok? (attempt "restore native Guix generation"
      (lambda () (restore-generation channels profile (assoc-ref record 'generation)))))
    (when (and changed? lock-ok?)
      (for-each (lambda (file)
        (unless (attempt (string-append "restore " (car file)) (lambda () (restore-file file)))
          (set! files-ok? #f))) saved)
      (unless (attempt "reload restored unit files" (lambda () (systemctl "daemon-reload")))
        (set! files-ok? #f))
      (for-each (lambda (spec)
        (attempt (string-append "reload " (assoc-ref spec "path"))
          (lambda () (configuration-commands `((configuration-files . (,spec)))
                        "reload" (or held-store store) #t))))
        (assoc-ref config 'configuration-files)))
    (when (and state-ok? held-config)
      (set! state-ok? (attempt "validate held owner's live state"
        (lambda () (check-state held-config held-store)))))
    (when (and stopped? stops-ok? profile-ok? files-ok?)
      (for-each (lambda (pair)
        (when (or (and state-ok? resume-state-writers?)
                  (not (member (car pair) state-writers)))
         (attempt (string-append "restore enablement " (car pair))
          (lambda ()
            (cond ((equal? (cdr pair) "enabled") (systemctl "enable" (car pair)))
                  ((equal? (cdr pair) "enabled-runtime") (systemctl "enable" "--runtime" (car pair))))))))
        (assoc-ref record 'enabled))
      (for-each (lambda (pair)
        ;; Drained jobs already completed. Restarting them would replay work.
        (when (and (not (member (car pair) draining))
                   (or (and state-ok? resume-state-writers?)
                       (not (member (car pair) state-writers)))
                   (member (cdr pair) '("active" "activating" "reloading")))
          (attempt (string-append "restart held " (car pair))
            (lambda () (systemctl "start" (car pair)))))) (assoc-ref record 'active)))
    (when (and own-lock? lock) (close-port lock))
    (let ((restored? (and stops-ok? profile-ok? files-ok? state-ok?
                          resume-state-writers? (null? failures))))
      (unless restored?
        (format (current-error-port) "Restoration incomplete; actual backups remain at ~a~%" scratch))
      restored?)))

;; The foreign host keeps its supervisor, credential service, state, journals
;; and queues. Only declared unit/configuration files and this profile change.
(define* (activate channels profile store switch #:optional cutover-work)
  (let* ((config (layout store)) (names (units store))
         (held-generation (generation-number profile))
         (held-store (artifact profile))
         (old-config (and held-store
           (file-exists? (string-append held-store "/.guix-systemd/deployment.scm")) (layout held-store)))
         (old-names (if (and held-store (file-exists? (string-append held-store "/.guix-systemd")))
                        (units held-store) '()))
         (restart (assoc-ref config 'restart-units)) (timers (assoc-ref config 'timers))
         (configuration-units (configuration-unit-names config))
         (old-units (delete-duplicates (append old-names (configuration-unit-names old-config))))
         (retired (filter (lambda (name) (not (job-unit? (assoc-ref config 'main-unit) name)))
           (delete-duplicates (append (assoc-ref config 'retired-units)
             (lset-difference equal? old-units (append names configuration-units))))))
         (new-paths (map (lambda (spec) (assoc-ref spec "path")) (assoc-ref config 'configuration-files)))
         (retired-files (delete-duplicates (append (assoc-ref config 'retired-files)
           (map unit-path (lset-difference equal? old-units (append names configuration-units)))
           (if old-config (lset-difference equal?
             (map (lambda (spec) (assoc-ref spec "path")) (assoc-ref old-config 'configuration-files))
             new-paths) '()))))
         (state-writers (assoc-ref config 'state-writers))
         (draining (assoc-ref config 'drain-units))
         (affected (delete-duplicates (append restart timers retired
                     (if cutover-work (filter (lambda (name) (string-suffix? ".timer" name)) state-writers) '())
                     (filter (lambda (name) (string-suffix? ".timer" name)) configuration-units))))
         (files (append (map (lambda (name)
                   (cons (unit-path name) (string-append store "/.guix-systemd/" name))) names)
                 (map (lambda (spec) (cons (assoc-ref spec "path") (assoc-ref spec "source")))
                      (assoc-ref config 'configuration-files))
                 (map (lambda (path) (cons path #f)) retired-files)))
         (scratch (mkdtemp (string-append (dirname profile) "/.lagoon-XXXXXX")))
         (held-active (map (lambda (name) (cons name (capture "systemctl" "--user" "show" "--property=ActiveState" "--value" name))) affected))
         (held-enabled (map (lambda (name) (cons name (enabled-state name))) affected))
         (saved (map (lambda (file index) (save-file (car file) scratch index))
                     files (iota (length files))))
         (stopped? #f) (changed? #f) (state-started? #f) (retirement-port #f))
    (define (save-recovery)
      (durable-write (string-append scratch "/restore.scm")
        `((profile . ,profile) (generation . ,held-generation) (held-store . ,held-store)
          (candidate-store . ,store) (files . ,saved) (active . ,held-active) (enabled . ,held-enabled)
          (affected . ,affected) (state-work . ,cutover-work)
          (stopped? . ,stopped?) (changed? . ,changed?) (state-started? . ,state-started?)))
      (sync-path (dirname scratch)))
    (when (and cutover-work (not (assoc-ref config 'first-cutover)))
      (error "target has no pinned first-cutover source input"))
    (when cutover-work
      (check-cutover-writers config store)
      (unless (equal? held-store (initial-artifact (assoc-ref config 'main-unit) held-store))
        (error "first-cutover baseline differs from the configured application")))
    (unless cutover-work
      (when (assoc-ref config 'state-check)
        (unless old-config
          (error "existing target needs its one-time owner cutover before ordinary activation"))
        (unless (equal? held-store (configured-artifact (assoc-ref config 'main-unit)))
          (error "native profile differs from the configured application; recover its actual baseline first")))
      (check-state config store))
    ;; Validation is read-only and precedes the native profile switch.
    (configuration-commands config "validate" store)
    ;; Reuse the service's actual ExecStartPre programs and environment. This
    ;; runs checks only, never the scheduled newsroom or backup job itself.
    (for-each (lambda (check)
      (apply run "systemd-run" "--user" "--wait" "--pipe" "--collect" "--quiet"
        "--property=MemoryMax=640M" "--property=RuntimeMaxSec=600"
        (string-append "--working-directory=" (assoc-ref check 'directory))
        (append (map (lambda (file) (string-append "--property=EnvironmentFile=" file))
                     (assoc-ref check 'environment-files))
                (list (string-append store "/bin/node") (assoc-ref check 'program)))))
      (assoc-ref config 'checks))
    (save-recovery)
    (format (current-error-port) "Host-file recovery backup: ~a~%" scratch)
    (catch #t
      (lambda ()
        (set! stopped? #t) (save-recovery)
        ;; Disable future retired timer admissions before draining their jobs.
        (for-each (lambda (name)
          (when (string-suffix? ".timer" name)
            (disable-unit name) (stop-unit name))) retired)
        (wait-units draining)
        (set! retirement-port (acquire-retirement-lock config))
        (when cutover-work
          (let ((main (assoc-ref config 'main-unit)))
            (for-each (lambda (name)
              (when (or (and (member name state-writers) (string-suffix? ".timer" name))
                        (equal? name main))
                (disable-unit name) (stop-unit name))) affected)
            ;; The actor no longer admits jobs. Existing immutable job units
            ;; finish naturally; never terminate financial or queued work.
            (wait-units (delete main state-writers) (lambda () (job-units main)))
            (set! state-started? #t) (save-recovery)
            (cutover-state config store "prepare" cutover-work held-store)
            (cutover-state config store "bind" cutover-work held-store)
            (check-state config store)))
        (for-each (lambda (name) (stop-unit name)) retired)
        (switch scratch)
        (unless (equal? store (artifact profile)) (error "profile selected another application"))
        (set! changed? #t) (save-recovery)
        (for-each disable-unit retired)
        (for-each (lambda (file saved)
          (if (cdr file) (replace-file (cdr file) (car file) (or (list-ref saved 3) (logior #o644 (logand #o111 (stat:perms (stat (cdr file)))))))
            (when (exists? (car file)) (delete-file (car file)) (sync-path (dirname (car file)))))) files saved)
        (systemctl "daemon-reload")
        (systemctl "enable" (assoc-ref config 'main-unit))
        ;; Jobs already in flight finish on their immutable programs. Only
        ;; the declared services restart; timers use the new files next time.
        (for-each (lambda (name) (systemctl "restart" name)) restart)
        (for-each (lambda (name) (systemctl "enable" "--now" name)) timers)
        (configuration-commands config "reload" store)
        (when (assoc-ref config 'health)
          (healthy? (assoc-ref config 'health) store))
        (configuration-commands config "receive" store)
        (when retirement-port
          (cleanup "release application lock" (lambda () (close-port retirement-port)))
          (set! retirement-port #f))
        (if cutover-work
          (format (current-error-port) "First-cutover host baseline retained at ~a~%" scratch)
          (cleanup "remove completed host backup" (lambda () (run "rm" "-rf" scratch))))
        (display store) (newline))
      (lambda args
        (let ((restored? (catch #t
                (lambda () (restore-activation channels profile scratch retirement-port))
                (lambda recovery-error
                  (format (current-error-port) "Restoration could not finish; actual backups remain at ~a~%" scratch) #f))))
          (when retirement-port
            (cleanup "release application lock after failure" (lambda () (close-port retirement-port))))
          (when (and restored? (not cutover-work))
            (cleanup "remove restored host backup" (lambda () (run "rm" "-rf" scratch)))))
        (apply throw args)))))


(define* (build channels load-path definition source root #:optional first-cutover?)
  ;; The immutable builder owns confinement and validates every runtime once.
  (if first-cutover? (setenv "GUIX_DEPLOYMENT_FIRST_CUTOVER" "1")
      (unsetenv "GUIX_DEPLOYMENT_FIRST_CUTOVER"))
  (setenv "GUIX_DEPLOYMENT_SOURCE" (canonicalize-path source))
  (apply capture (append (guix-command channels)
    (list "build" "--no-grafts" "-L" load-path "-f" definition)
    (if root (list (string-append "--root=" root)) '()))))
(define* (receive-artifact channels store profile work #:optional cutover-work)
  ;; Both local construction and an already imported output use this same
  ;; baseline admission and activation transaction. WORK only holds a native
  ;; Guix manifest; cutover originals and host-file recovery keep their own paths.
  (when cutover-work
    (unless (assoc-ref (layout store) 'first-cutover)
      (error "target has no pinned first-cutover source input"))
    (unless (absolute-file-name? cutover-work) (error "first-cutover work directory must be absolute"))
    (check-cutover-writers (layout store) store)
    (let ((held (configured-artifact (assoc-ref (layout store) 'main-unit))))
      (when (file-exists? (string-append held "/.guix-systemd/deployment.scm"))
        (error "configured application already uses LAGOON; use ordinary state validation or explicit interrupted recovery"))
      (unless (equal? held (artifact profile)) (install-artifact channels profile held work))))
  (activate channels profile store
    (lambda (scratch) (install-artifact channels profile store scratch)) cutover-work))

(define (check-receiving-target store profile target)
  ;; This bounded entrance receives only the existing reviewed machine family.
  ;; The caller supplies the exact STORE returned by its reviewed source build;
  ;; a store path does not independently attest a Git revision.
  (unless (member target '("cold-red-gate" "bare-cedar-fog"))
    (error "prebuilt output does not name an existing target" target))
  (for-each (lambda (relative)
    (let ((file (string-append store "/" relative)))
      (unless (and (equal? file (canonicalize-path file))
                   (eq? 'regular (stat:type (lstat file))))
        (error "receiving declaration is not an immutable file in this output" file))))
    (list ".guix-systemd/deployment.scm" ".guix-systemd/environment"
          (string-append ".guix-systemd/" target "-561-group.service")
          "deployment/host.json" "deployment/instance.json"))
  (let* ((main (string-append target "-561-group.service"))
         (config (layout store))
         (host (call-with-input-file (string-append store "/deployment/host.json") json->scm))
         (instance (call-with-input-file (string-append store "/deployment/instance.json") json->scm))
         (environment (string-split (call-with-input-file
           (string-append store "/.guix-systemd/environment") get-string-all) #\newline))
         (unit (string-split (call-with-input-file
           (string-append store "/.guix-systemd/" main) get-string-all) #\newline)))
    (unless (equal? profile (assoc-ref config 'profile))
      (error "receiving profile differs from the sealed target declaration" profile))
    (unless (and (equal? main (assoc-ref config 'main-unit))
                 (equal? "feltos.enterprise-host" (assoc-ref host "hostKind"))
                 (equal? "instance.json" (assoc-ref host "instance"))
                 (equal? (string-append target ".561.group")
                         (assoc-ref (assoc-ref instance "identity") "id"))
                 (member (string-append "ExecStart=" store "/bin/" target) unit)
                 (member (string-append "EnvironmentFile=" store "/.guix-systemd/environment") unit)
                 (equal? (filter (lambda (line) (string-prefix? "FELTOS_WORLD=" line)) environment)
                         (list (format #f "FELTOS_WORLD=~s" (string-append store "/deployment/host.json")))))
      (error "prebuilt output differs from the intended target and host binding" target store))
    (when (equal? target "cold-red-gate")
      (unless (member (assoc-ref (assoc-ref host "web") "executionRole")
                      '("actor-only" "worker"))
        (error "Cold Red Gate receiving requires an explicit supported host execution role" store)))))

(define (protect-receiving-inputs connection channels)
  (unless (current-pinned-guix channels)
    (error "receiving requires the imported pinned Guix profile"))
  (let ((inputs (map canonicalize-path
                    (list channels (car (command-line)) (current-profile)))))
    (for-each (lambda (input)
      (unless (valid-path-syntax? input) (error "receiving input is not a native store item" input))
      (add-temp-root connection input)
      (unless (valid-path? connection input) (error "receiving input is not registered" input))) inputs)
    inputs))

(define* (receive channels store profile target #:optional cutover-work)
  ;; Receiving uses the builder's already-realized native Guix, never a local
  ;; time-machine rebuild. Its ordinary profile metadata identifies the source.
  (unless (current-pinned-guix channels)
    (error "receiving requires the imported pinned Guix profile"))
  (unless (valid-path-syntax? store)
    (error "receiving requires one exact native Guix store output" store))
  (with-store connection
    ;; Hold the native temporary root before looking up the imported output.
    ;; The scratch profile below keeps it rooted after interruption as well.
    (add-temp-root connection store)
    (unless (and (valid-path? connection store)
                 (equal? store (canonicalize-path store))
                 (eq? 'directory (stat:type (lstat store))))
      (error "prebuilt Guix output is absent or not an immutable directory" store))
    (protect-receiving-inputs connection channels)
    (check-receiving-target store profile target)
    (when (and cutover-work (not (absolute-file-name? cutover-work)))
      (error "first-cutover work directory must be absolute"))
    (let* ((work (mkdtemp (string-append (dirname profile) "/.lagoon-receive-XXXXXX")))
           (root (string-append work "/application")))
      (register-root connection
        (map canonicalize-path (list channels (car (command-line)) (current-profile)))
        (string-append work "/receiving-input"))
      (install-artifact channels root store work)
      (unless (equal? store (artifact root)) (error "receiving root selected another application"))
      (format (current-error-port) "Prebuilt output retained by native Guix profile: ~a~%" root)
      ;; Do not remove this native profile on any failure. The existing recovery
      ;; operation may still need the candidate after this process exits.
      (receive-artifact channels store profile work cutover-work)
      (cleanup "remove completed receiving root" (lambda () (run "rm" "-rf" work))))))

(define* (deploy channels load-path definition source profile #:optional cutover-work)
  (let* ((work (mkdtemp (string-append (dirname profile) "/.lagoon-build-XXXXXX")))
         (root (string-append work "/application"))
         (store (build channels load-path definition source root cutover-work)))
    ;; Retain the native build root if activation or state restoration fails.
    (receive-artifact channels store profile work cutover-work)
    (cleanup "remove temporary native build root"
      (lambda ()
        (delete-file root)
        (when (file-exists? (string-append work "/manifest.scm")) (delete-file (string-append work "/manifest.scm")))
        (rmdir work)))))
(define* (rollback channels profile #:optional target)
  (let ((number (previous-generation-number profile)))
    (when (zero? number) (error "no previous application generation"))
    (let ((store (artifact (generation-file-name profile number))))
      (define (activate-previous)
        (activate channels profile store
          (lambda (scratch) (guix channels "package" (string-append "--profile=" profile)
            (string-append "--switch-generation=" (number->string number))))))
      (unless store (error "previous generation has no application"))
      (unless (file-exists? (string-append store "/.guix-systemd/deployment.scm"))
        (error "previous output predates LAGOON; its retained host files and data need explicit owner restoration"))
      (if target
        (with-store connection
          (let ((inputs (protect-receiving-inputs connection channels)))
            (check-receiving-target store profile target)
            (let ((work (mkdtemp (string-append (dirname profile) "/.lagoon-rollback-XXXXXX"))))
              (register-root connection inputs (string-append work "/receiving-input"))
              ;; Preserve these roots if activation or recovery raises.
              (activate-previous)
              (cleanup "remove completed rollback input roots"
                (lambda ()
                  ;; register-root numbers multiple inputs from zero.
                  (for-each (lambda (index)
                    (delete-file (string-append work "/receiving-input-" (number->string index))))
                    (iota (length inputs)))
                  (rmdir work))))))
        (activate-previous)))))
(define (perform args)
  (match args
    (("build" channels load-path definition source root)
     (display (build channels load-path definition source root)) (newline))
    (("build" channels load-path definition source root "--first-cutover")
     (display (build channels load-path definition source root #t)) (newline))
    (("deploy" channels load-path definition source profile)
     (deploy channels load-path definition source profile))
    (("deploy" channels load-path definition source profile "--first-cutover" work)
     (deploy channels load-path definition source profile work))
    (("receive" channels store profile target)
     (receive channels store profile target))
    (("receive" channels store profile target "--first-cutover" work)
     (receive channels store profile target work))
    (("recover" channels profile scratch)
     (unless (restore-activation channels profile scratch) (error "interrupted activation recovery is incomplete")))
    (("rollback" channels profile) (rollback channels profile))
    (("rollback" channels profile target) (rollback channels profile target))
    (_ (error "usage: build CHANNELS LOAD-PATH DEFINITION SOURCE ROOT [--first-cutover] | deploy CHANNELS LOAD-PATH DEFINITION SOURCE PROFILE [--first-cutover WORK] | receive CHANNELS STORE PROFILE TARGET [--first-cutover WORK] | rollback CHANNELS PROFILE [TARGET] | recover CHANNELS PROFILE BACKUP"))))

(match (cdr (command-line))
  (("--locked" . args) (perform args))
  (("build" . rest) (perform (cons "build" rest)))
  (args
   (let* ((profile (match args
                    (("deploy" channels load-path definition source profile) profile)
                    (("deploy" channels load-path definition source profile "--first-cutover" work) profile)
                    (("receive" channels store profile target) profile)
                    (("receive" channels store profile target "--first-cutover" work) profile)
                    (("rollback" channels profile) profile)
                    (("rollback" channels profile target) profile)
                    (("recover" channels profile scratch) profile)
                    (_ (error "invalid LAGOON invocation"))))
          (channels (cadr args)))
     (unless (absolute-file-name? profile) (error "Guix profile must be an absolute path"))
     (when (and (or (equal? "receive" (car args))
                    (and (equal? "rollback" (car args)) (= 4 (length args))))
                (not (current-pinned-guix channels)))
       (error "receiving requires the imported pinned Guix profile"))
     (run "mkdir" "-p" (dirname profile))
     (apply run "flock" "--exclusive" "--wait" "900" (string-append profile ".lagoon-lock")
       (append (guix-command channels) (list "repl" "--"
         (canonicalize-path (car (command-line))) "--locked") args)))))
