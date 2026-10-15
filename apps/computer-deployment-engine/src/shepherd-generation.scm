;;; LAGOON's GNU Shepherd generation: the forms that register one machine's
;;; services under Shepherd, for a host whose PID 1 is not systemd.
;;;
;;; Pure data in, pure data out; nothing here touches Guix or the host. The
;;; systemd generation in (guix-deployment) is unchanged. Ported from
;;; guix-machine-release-service src/guix-deployment.scm (the donor), per
;;; supervisor-for-machines-without-systemd.md in this section.
(define-module (shepherd-generation)
  #:use-module (ice-9 match)
  #:use-module (srfi srfi-1)
  #:export (shepherd-service-forms
            shepherd-generation-forms
            shepherd-unsupported))

;; What has no Shepherd form yet. Returns the list of reasons (empty when the
;; machine is inside the supported subset). A caller refuses before any host
;; file changes when this is not empty.
(define* (shepherd-unsupported #:key (auxiliary-units '()) first-cutover
                               state-check retirement-lock (drain-units '()))
  (append
   (filter-map (lambda (service)
                 (cond ((assoc-ref service 'timer)
                        (format #f "timer on ~a" (assoc-ref service 'name)))
                       ((not (equal? (assoc-ref service 'type) "simple"))
                        (format #f "oneshot service ~a" (assoc-ref service 'name)))
                       (else #f)))
               auxiliary-units)
   (if first-cutover '("first-cutover") '())
   (if state-check '("state-check") '())
   (if retirement-lock '("retirement-lock") '())
   (if (null? drain-units) '() '("drain-units"))))

(define (service-form name command directory files respawn-delay)
  `(service '(,(string->symbol name))
     #:documentation ,(string-append name " Guix deployment")
     #:start (lambda _
               ((make-forkexec-constructor ',command
                  #:directory ,directory
                  #:environment-variables (environment-of ',files)
                  #:file-creation-mask #o077)))
     #:stop (make-kill-destructor)
     #:respawn? #t
     #:respawn-delay ,respawn-delay))

;; The services of one generation: the main service, then each simple
;; auxiliary. Environment files are read again at every start, a later file
;; winning, as with systemd's EnvironmentFile.
(define* (shepherd-service-forms machine-name launcher directory
                                 #:key (environment-files '()) (restart-seconds 5)
                                 (auxiliary-services '()))
  (cons (service-form (string-append machine-name "-561-group") (list launcher)
                      directory environment-files restart-seconds)
        (map (lambda (aux)
               (match aux
                 ((name command directory files)
                  (service-form (if (string-suffix? ".service" name)
                                    (string-drop-right name 8)
                                    name)
                                command directory files 5))))
             auxiliary-services)))

;; The whole `.guix-shepherd/NAME-561-group.scm`, as a list of forms to write.
(define (shepherd-generation-forms service-forms)
  `((use-modules (shepherd service) (ice-9 rdelim) (srfi srfi-1))
    (define (environment-of files)
      (let ((table '()))
        (for-each
         (lambda (file)
           (when (file-exists? file)
             (call-with-input-file file
               (lambda (port)
                 (let loop ((line (read-line port)))
                   (unless (eof-object? line)
                     (let* ((line (string-trim-both line))
                            (equals (string-index line #\=)))
                       (when (and equals (> equals 0) (not (string-prefix? "#" line)))
                         (let ((value (substring line (+ equals 1))))
                           (set! table
                                 (assoc-set! table (substring line 0 equals)
                                             (if (string-prefix? "\"" value)
                                                 (call-with-input-string value read)
                                                 value))))))
                     (loop (read-line port))))))))
         files)
        (map (lambda (pair) (string-append (car pair) "=" (cdr pair))) table)))
    (register-services (list ,@service-forms))))
