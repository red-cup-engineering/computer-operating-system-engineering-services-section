;;; Run with the pinned Guix: guix time-machine -C channels.scm -- repl -- FILE ARGS...
;;; stdout is one JSON reading; Guix's progress belongs on stderr.
(use-modules (ice-9 popen) (ice-9 rdelim) (ice-9 ftw)
             (ice-9 match) (ice-9 format) (json) (srfi srfi-1))

(define (run . arguments)
  (format (current-error-port) "Guix deployment: ~a~%" (car arguments))
  (let* ((port (apply open-pipe* OPEN_READ arguments))
         (lines (let loop ((result '()))
                  (let ((line (read-line port)))
                    (if (eof-object? line) (reverse result)
                        (loop (cons line result))))))
         (status (close-pipe port)))
    (unless (zero? status) (error "deployment command failed" arguments status))
    lines))

(define (guix channels . arguments)
  (apply run "guix" "repl" "--" (string-append (dirname (car (command-line))) "/pinned-guix.scm") channels arguments))

;; Runtime packages must be closed over their files. In particular, an
;; install seeded from another release must not retain links to that release.
(define (assert-closed source)
  (let* ((root (canonicalize-path source))
         (prefix (string-append root "/")))
    (file-system-fold
     (lambda (file stat result) #t)
     (lambda (file stat result)
       (when (eq? 'symlink (stat:type stat))
         (when (absolute-file-name? (readlink file))
           (error "runtime link is absolute and cannot relocate into the store" file))
         (let ((target (canonicalize-path file)))
           (unless (or (string=? target root) (string-prefix? prefix target))
             (error "runtime link escapes the admitted closure" file target))))
       result)
     (lambda (file stat result) result)
     (lambda (file stat result) result)
     (lambda (file stat result) result)
     (lambda (file stat errno result) (error "cannot read runtime input" file errno))
     #t root lstat)))

(define result
  (match (cdr (command-line))
    (("build" channels load-path definition source root)
     (assert-closed source)
     (setenv "GUIX_DEPLOYMENT_SOURCE" (canonicalize-path source))
     (let* ((lines (guix channels "build" "--no-grafts" "-L" load-path
                         "-f" definition (string-append "--root=" root)))
            (store (last lines)))
       (unless (string-prefix? "/gnu/store/" store)
         (error "Guix returned no store output" lines))
       `(("storePath" . ,store) ("root" . ,root)
         ("narSha256" . ,(last (guix channels "hash" "--serializer=nar" "--format=hex" store))))))
    (_ (error "usage: build CHANNELS LOAD-PATH DEFINITION SOURCE ROOT"))))

(display (scm->json-string result))
(newline)
