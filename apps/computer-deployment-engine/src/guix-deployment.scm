;;; LAGOON realizes the published application and target's public configuration.
;;; Guix owns construction and profiles. State and credentials stay on the host.
(define-module (guix-deployment)
  #:use-module (guix packages)
  #:use-module (guix gexp)
  #:use-module ((guix store) #:select (store-path?))
  #:use-module (guix build-system trivial)
  #:use-module (gnu packages node)
  #:use-module (gnu packages bash)
  #:use-module (gnu packages ssh)
  #:use-module ((gnu packages linux) #:select (util-linux))
  #:use-module ((gnu packages pdf) #:select (poppler-next))
  #:use-module (ice-9 format)
  #:use-module (srfi srfi-1)
  #:export (enterprise-deployment))

(define portable-runtime-check
  (local-file "../scripts/portable-runtime.mjs"
              "lagoon-portable-runtime.mjs"))

(define node-job-instance-realizer
  (local-file "../scripts/realize-node-job-instance.mjs"
              "lagoon-realize-node-job-instance.mjs"))

;; Units and launchers are built with their actual store paths. The host's
;; systemd remains responsible for sockets, cgroups and process supervision.
(define* (enterprise-deployment machine-name directory entry
                               #:key profile environment-file (environment '())
                               socket (heap 512) (restart-seconds 5)
                               oom-score memory-high (auxiliary-units '()) (commands '()) reverse-tunnel
                               (requires '()) (declarations '()) health node-job-instance
                               (configuration-files #()) (restart-units #())
                               (retired-units #()) (retired-files #()) (drain-units #())
                               state-check state-plan (state-writers #()) first-cutover retirement-lock)
  (let ((admitted-source (getenv "GUIX_DEPLOYMENT_SOURCE"))
        (configuration-files (vector->list configuration-files))
        (restart-units (vector->list restart-units))
        (first-cutover (and (getenv "GUIX_DEPLOYMENT_FIRST_CUTOVER") first-cutover)))
    (unless (and admitted-source (file-exists? admitted-source))
      (error "GUIX_DEPLOYMENT_SOURCE must name the fabricated registry runtime"))
    (when profile
      (unless (and (string? profile) (absolute-file-name? profile))
        (error "deployment profile must be an absolute path" profile)))
    (package
      (name (string-append machine-name "-deployment"))
      (version "1")
      (source #f)
      (build-system trivial-build-system)
      (arguments
       (list
        #:modules '((guix build utils) (ice-9 format) (ice-9 regex) (ice-9 ftw) (srfi srfi-1) (srfi srfi-13))
        #:builder
        #~(begin
            (use-modules (guix build utils) (ice-9 format) (ice-9 regex) (ice-9 ftw) (srfi srfi-1) (srfi srfi-13))
            (let* ((out #$output)
                   (runtime #$(file-append node "/bin/node"))
                   (bin (string-append out "/bin"))
                   (units (string-append out "/.guix-systemd"))
                   (launcher (string-append bin "/" #$machine-name))
                   (unit (string-append units "/" #$machine-name "-561-group.service"))
                   (env
                    (map (lambda (pair)
                           (cons (car pair)
                                 (regexp-substitute/global
                                  #f "\\{release\\}" (cdr pair) 'pre out 'post)))
                         (append '#$environment
                           (list (cons "NODE_OPTIONS" (format #f "--max-old-space-size=~a --disable-sigusr1" #$heap))
                                 (cons "PATH" (string-append out "/bin:/home/emsenn/.local/bin:/usr/local/bin:/usr/bin:/bin")))))))
              ;; The admitted tree is already an immutable Guix input. Retain it
              ;; in the output's closure without copying the entire tree twice.
              (mkdir-p out) (mkdir-p bin) (mkdir-p units)
              (let ((tree #$(if (store-path? admitted-source)
                               admitted-source
                               (local-file admitted-source "registry-runtime" #:recursive? #t))))
                (invoke runtime #$portable-runtime-check tree #$entry)
                (when (file-exists? (string-append tree "/.guix-systemd"))
                  (error "application contains reserved deployment directory"))
                (for-each (lambda (file)
                            (cond ((member file '("." "..")) #t)
                              ((string=? file "bin")
                                (for-each (lambda (name)
                                  (unless (member name '("." ".."))
                                    (symlink (string-append tree "/bin/" name)
                                             (string-append bin "/" name))))
                                  (scandir (string-append tree "/bin"))))
                              (else (symlink (string-append tree "/" file)
                                             (string-append out "/" file)))))
                          (scandir tree)))
              (symlink runtime (string-append bin "/node"))
              (symlink #$(file-append util-linux "/bin/flock") (string-append bin "/flock"))
              (symlink #$(file-append poppler-next "/bin/pdftotext")
                       (string-append bin "/pdftotext"))
              (for-each
                (lambda (name source)
                  (when (file-exists? (string-append out "/" name))
                    (error "target declarations overlap application content" name))
                  (copy-recursively source (string-append out "/" name)))
                '#$(map car declarations) (list #$@(map cdr declarations)))
              ;; Realize only the explicitly selected native job fields, after
              ;; retaining the exact authored instance in this same output.
              (when #$(and node-job-instance #t)
                (let ((pointer (assoc-ref '#$node-job-instance 'deployment-records-pointer)))
                  (unless (and (string? pointer) (not (string-null? pointer)))
                    (error "native node jobs require their authored deployment-records-pointer"))
                  (invoke runtime #$node-job-instance-realizer out
                    (assoc-ref '#$node-job-instance 'path)
                    (assoc-ref '#$node-job-instance 'module)
                    (assoc-ref '#$node-job-instance 'export)
                    pointer)))
              ;; The authored ingress already contains the Caddy configuration;
              ;; realize those bytes in Guix rather than carrying a release envelope.
              (when (file-exists? (string-append out "/deployment/ingress.json"))
                (invoke runtime "--input-type=module" "-e"
                  "import{readFileSync,writeFileSync}from'node:fs';const root=process.argv[1],s=JSON.parse(readFileSync(root+'/deployment/ingress.json','utf8')).caddyConfiguration;if(typeof s!=='string'||!s.length)throw Error('ingress lacks Caddy configuration');writeFileSync(root+'/deployment/Caddyfile',s,{flag:'wx',mode:0o644});"
                  out))
              (when #$state-plan
                (invoke runtime "--input-type=module" "-e"
                  "import{readFileSync,writeFileSync}from'node:fs';const[root,plan]=process.argv.slice(1);writeFileSync(root+'/.guix-systemd/state-plan.json',readFileSync(root+'/'+plan,'utf8').replaceAll('@CURRENT_RELEASE@',root),{flag:'wx',mode:0o644});"
                  out #$state-plan))
              (call-with-output-file (string-append units "/deployment.scm")
                (lambda (port)
                  (write
                    `((profile . ,#$profile)
                      (main-unit . ,(string-append #$machine-name "-561-group.service"))
                      (restart-units . ,(delete-duplicates
                        (append (list (string-append #$machine-name "-561-group.service"))
                          '#$restart-units
                          (if '#$reverse-tunnel (list (string-append #$machine-name "-ingress.service")) '()))))
                      (timers . ,(filter-map
                        (lambda (service)
                          (and (assoc-ref service 'timer)
                            (assoc-ref (assoc-ref service 'timer) 'name))) '#$auxiliary-units))
                      (configuration-files . ,(map (lambda (spec)
                          (cons (cons "source" (string-append out "/" (assoc-ref spec "source")))
                                (filter (lambda (pair) (not (equal? (car pair) "source"))) spec)))
                          '#$configuration-files))
                      (checks . ,(append-map (lambda (service)
                        (let ((checks (assoc-ref service 'precheck)))
                          (map (lambda (program)
                            `((program . ,(string-append out "/" program))
                              (directory . ,(string-append out "/" (assoc-ref service 'directory)))
                              (environment-files . ,(append (or (assoc-ref service 'environment-files) '())
                                (list (string-append units "/" (assoc-ref service 'name) ".environment"))))))
                            (cond ((not checks) '()) ((string? checks) (list checks)) (else checks)))))
                        '#$auxiliary-units))
                      (retirement-lock . ,#$retirement-lock)
                      (state-check . ,(and #$state-check (string-append out "/" #$state-check)))
                      (state-plan . ,(and #$state-plan (string-append units "/state-plan.json")))
                      (state-writers . ,(vector->list '#$state-writers))
                      (first-cutover . ,#$first-cutover)
                      (drain-units . ,(vector->list '#$drain-units))
                      (retired-units . ,(vector->list '#$retired-units))
                      (retired-files . ,(vector->list '#$retired-files))
                      (health . ,#$health)) port)
                  (newline port)))
              (unless (file-exists? (string-append out "/" #$entry))
                (error "application entry is absent" #$entry))
              (when (file-exists? launcher) (error "application overlaps deployment launcher" launcher))
              (call-with-output-file launcher
                (lambda (port)
                  (format port "#!~a~%exec ~s ~s \"$@\"~%"
                          #$(file-append bash-minimal "/bin/sh")
                          runtime (string-append out "/" #$entry))))
              (chmod launcher #o555)
              (for-each
                (lambda (command)
                  (let ((path (string-append bin "/" (assoc-ref command 'name)))
                        (program (string-append out "/" (assoc-ref command 'program))))
                    (unless (file-exists? program) (error "operator program missing" program))
                    (when (file-exists? path) (error "application overlaps operator launcher" path))
                    (call-with-output-file path
                      (lambda (port)
                        (format port "#!~a~%exec ~s ~s \"$@\"~%"
                                #$(file-append bash-minimal "/bin/sh") runtime program)))
                    (chmod path #o555)))
                '#$commands)
              ;; Receive declared carriers before writing runnable units. These
              ;; are structural checks only; never execute a precheck here.
              (for-each
                (lambda (path)
                  (unless (and (string? path) (not (absolute-file-name? path))
                               (every (lambda (part) (and (not (string-null? part))
                                                         (not (member part '("." "..")))))
                                      (string-split path #\/)))
                    (error "deployment carrier must be a relative file path" path))
                  (unless (eq? 'regular (stat:type (stat (string-append out "/" path))))
                    (error "declared deployment carrier is absent or nonregular" path)))
                (append
                  (list #$entry)
                  (map (lambda (command) (assoc-ref command 'program)) '#$commands)
                  (map (lambda (spec) (assoc-ref spec "source")) '#$configuration-files)
                  (if #$state-check (list #$state-check) '())
                  (append-map (lambda (service)
                    (let ((checks (assoc-ref service 'precheck))
                          (poststop (assoc-ref service 'poststop)))
                      (append (list (assoc-ref service 'program))
                        (cond ((not checks) '()) ((string? checks) (list checks)) (else checks))
                        (if poststop (list poststop) '())))) '#$auxiliary-units)))
              (call-with-output-file unit
                (lambda (port)
                  ;; Units the service cannot start without (its rendered credentials, say)
                  ;; run first, and again whenever the service starts.
                  (format port "[Unit]~%Description=~a Guix enterprise deployment~%After=network-online.target~a~%Wants=network-online.target~a~%~a~%[Service]~%Type=simple~%WorkingDirectory=~a/~a~%ExecStart=~a~%EnvironmentFile=~a~%"
                          #$machine-name
                          (string-append (if #$socket (string-append " " #$socket) "")
                            (apply string-append (map (lambda (u) (string-append " " u)) '#$requires)))
                          (string-append (if #$socket (string-append " " #$socket) "")
                            (if '#$reverse-tunnel (string-append " " #$machine-name "-ingress.service") ""))
                          (if (null? '#$requires) ""
                              (string-append "Requires=" (string-join '#$requires " ") "\n"))
                          out #$directory launcher #$environment-file)
                  (format port "EnvironmentFile=~a/environment~%" units)
                  (format port "Environment=\"PATH=~a/bin:/home/emsenn/.local/bin:/usr/local/bin:/usr/bin:/bin\"~%" out)
                  (format port "Environment=\"NODE_OPTIONS=--max-old-space-size=~a --disable-sigusr1\"~%" #$heap)
                  (when #$oom-score (format port "OOMScoreAdjust=~a~%" #$oom-score))
                  (when #$memory-high (format port "MemoryHigh=~a~%" #$memory-high))
                  (format port "Restart=on-failure~%RestartSec=~a~%TimeoutStartSec=600~%UMask=0077~%~%[Install]~%WantedBy=default.target~%" #$restart-seconds)))
              (call-with-output-file (string-append units "/environment")
                (lambda (port)
                  (for-each (lambda (pair) (format port "~a=~s~%" (car pair) (cdr pair))) env)))
              (when '#$reverse-tunnel
                (call-with-output-file (string-append units "/" #$machine-name "-ingress.service")
                  (lambda (port)
                    (format port "[Unit]~%Description=~a private ingress transport~%After=network-online.target~%[Service]~%Type=simple~%ExecStart=~a -NT -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -R ~a ~a~%Restart=always~%RestartSec=5~%UMask=0077~%"
                      #$machine-name #$(file-append openssh "/bin/ssh")
                      (cadr '#$reverse-tunnel) (car '#$reverse-tunnel)))))
              ;; Additional services belong to the same immutable generation
              ;; and are installed by the same release transaction.
              (for-each
                (lambda (service)
                  (let* ((name (assoc-ref service 'name))
                         (program (assoc-ref service 'program))
                         (command (string-append out "/" program))
                         (interpreter (if (assoc-ref service 'shell?)
                                          #$(file-append bash-minimal "/bin/bash") runtime)))
                    (unless (file-exists? command) (error "auxiliary program missing" name program))
                    (call-with-output-file (string-append units "/" name)
                      (lambda (port)
                        (format port "[Unit]~%Description=~a Guix deployment~%After=network-online.target~a~%~a[Service]~%Type=~a~%WorkingDirectory=~a/~a~%ExecStart=~a ~a~%TimeoutStartSec=~a~%UMask=0077~%"
                                name (if (assoc-ref service 'after) (string-append " " (assoc-ref service 'after)) "")
                                (if (assoc-ref service 'requires) (string-append "Requires=" (assoc-ref service 'requires) "\n") "")
                                (if (equal? (assoc-ref service 'type) "simple") "simple" "oneshot")
                                out (assoc-ref service 'directory) interpreter command
                                (or (assoc-ref service 'timeout) "3600"))
                        (when (equal? (assoc-ref service 'type) "simple")
                          (format port "Restart=on-failure~%RestartSec=5~%"))
                        (let ((checks (assoc-ref service 'precheck)))
                          (for-each (lambda (program)
                            (format port "ExecStartPre=~a ~a/~a~%" runtime out program))
                            (cond ((not checks) '()) ((string? checks) (list checks)) (else checks))))
                        (when (assoc-ref service 'poststop)
                          (format port "ExecStopPost=~a ~a/~a~%" runtime out (assoc-ref service 'poststop)))
                        (when (assoc-ref service 'memory-high)
                          (format port "MemoryHigh=~a~%" (assoc-ref service 'memory-high)))
                        (when (assoc-ref service 'nice)
                          (format port "Nice=~a~%" (assoc-ref service 'nice)))
                        (for-each (lambda (file) (format port "EnvironmentFile=~a~%" file))
                                  (or (assoc-ref service 'environment-files) '()))
                        (format port "EnvironmentFile=~a/~a.environment~%" units name)))
                    (call-with-output-file (string-append units "/" name ".environment")
                      (lambda (port)
                        (for-each
                          (lambda (pair)
                            (format port "~a=~s~%" (car pair)
                                    (regexp-substitute/global #f "\\{release\\}" (cdr pair) 'pre out 'post)))
                          (append (or (assoc-ref service 'environment) '())
                                  (list (cons "PATH" (string-append out "/bin:/home/emsenn/.local/bin:/usr/local/bin:/usr/bin:/bin")))))))
                    (when (assoc-ref service 'timer)
                      (let ((timer (assoc-ref service 'timer)))
                        (call-with-output-file (string-append units "/" (assoc-ref timer 'name))
                          (lambda (port)
                            (format port "[Unit]~%Description=~a schedule~%[Timer]~%OnBootSec=~a~%OnUnitInactiveSec=~a~%Unit=~a~%Persistent=true~%[Install]~%WantedBy=timers.target~%"
                                    name (assoc-ref timer 'boot) (assoc-ref timer 'interval) name)))))))
                '#$auxiliary-units)
              #t))))
      (home-page "https://561.group")
      (synopsis (string-append machine-name " enterprise deployment"))
      (description
       "A published application closure, its Guix interpreter, launcher and service.
Persistent state and credentials remain in the host's existing custody.")
      (license #f))))


