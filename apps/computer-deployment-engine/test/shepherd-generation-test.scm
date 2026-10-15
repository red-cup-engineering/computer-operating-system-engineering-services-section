;;; shepherd-generation-test.scm — SRFI-64 tests for (shepherd-generation).
;;; Run: guile -L src test/shepherd-generation-test.scm
;;; or scripts/run-shepherd-generation-tests.scm from any directory.
(use-modules (srfi srfi-64) (ice-9 match) (ice-9 textual-ports) (ice-9 rdelim)
             (shepherd-generation))

(define (kw form key)
  (let loop ((l form))
    (cond ((null? l) #f) ((eq? (car l) key) (cadr l)) (else (loop (cdr l))))))

(test-begin "shepherd-generation")

(define aux '(("scan.service" ("/gnu/store/x-node/bin/node" "/rel/scan.mjs")
               "/rel/app" ("/rel/a.environment"))))
(define forms
  (shepherd-service-forms "cold-red-gate" "/rel/bin/cold-red-gate" "/rel/app"
                          #:environment-files '("/etc/crg.env" "/rel/.guix-systemd/environment")
                          #:restart-seconds 7 #:auxiliary-services aux))

(test-equal "main service then each simple auxiliary" 2 (length forms))
(test-equal "main service is named for the machine"
  ''(cold-red-gate-561-group) (list-ref (car forms) 1))
(test-equal "auxiliary drops the .service suffix" ''(scan) (list-ref (cadr forms) 1))
(test-equal "respawn delay carried to main" 7 (kw (car forms) #:respawn-delay))
(test-equal "auxiliary respawns after 5" 5 (kw (cadr forms) #:respawn-delay))
(test-equal "forks the launcher in the working directory, umask 077"
  '(("/rel/bin/cold-red-gate") "/rel/app" #o077)
  (match (kw (car forms) #:start)
    (('lambda '_ (('make-forkexec-constructor ('quote cmd) . rest)))
     (list cmd (kw rest #:directory) (kw rest #:file-creation-mask)))))

(test-assert "the service file reads back as forms and registers every service"
  (let* ((file (tmpnam))
         (generation (shepherd-generation-forms forms)))
    (call-with-output-file file
      (lambda (p) (for-each (lambda (f) (write f p) (newline p)) generation)))
    (let ((read-back (call-with-input-file file
                       (lambda (p) (let loop ((f (read p)) (acc '()))
                                     (if (eof-object? f) (reverse acc) (loop (read p) (cons f acc))))))))
      (delete-file file)
      (and (equal? read-back generation)
           (let ((register (last-pair read-back)))
             (eq? 'register-services (car (car register))))))))

(test-equal "later environment file wins, quoted values are read"
  '("A=2" "B=two words" "C=3")
  (let* ((dir (mkdtemp "/tmp/shepherd-generation-XXXXXX"))
         (one (string-append dir "/one")) (two (string-append dir "/two")))
    (call-with-output-file one (lambda (p) (display "A=1\n# note\nB=\"two words\"\n" p)))
    (call-with-output-file two (lambda (p) (display "A=2\nC=3\n" p)))
    ;; evaluate only the environment-of definition, never Shepherd
    (let ((env-def (list-ref (shepherd-generation-forms '()) 1))
          (m (make-fresh-user-module)))
      (module-use! m (resolve-module '(ice-9 rdelim)))
      (module-use! m (resolve-module '(srfi srfi-13)))
      (eval env-def m)
      (let ((result (sort ((module-ref m 'environment-of) (list one two)) string<?)))
        (delete-file one) (delete-file two) (rmdir dir)
        result))))

(test-equal "the supported subset has no refusals" '()
  (shepherd-unsupported #:auxiliary-units '(((name . "a.service") (type . "simple")))))
(test-equal "timers, oneshots, first-cutover, state-check, retirement-lock and drain are refused"
  '("timer on t.service" "oneshot service j.service" "first-cutover" "state-check"
    "retirement-lock" "drain-units")
  (shepherd-unsupported
   #:auxiliary-units '(((name . "t.service") (type . "simple") (timer . ((name . "t.timer"))))
                       ((name . "j.service") (type . "oneshot")))
   #:first-cutover #t #:state-check "check.mjs" #:retirement-lock '((x . 1))
   #:drain-units '("u")))

(let ((failures (test-runner-fail-count (test-runner-current))))
  (test-end "shepherd-generation")
  (exit (if (zero? failures) 0 1)))
