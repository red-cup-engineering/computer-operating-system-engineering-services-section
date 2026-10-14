# Native node-job instance realization

## Requirement and owner

LAGOON's existing `enterprise-deployment` constructor must bind the target's native job selection to the same immutable Guix output that supplies its programs and installed MetroPlat declaration. The generic Engineering `node-job-service` remains the sole declaration/receipt/execution provider. Group Computer consumes it through its installed job operation and schedule factories; neither LAGOON nor the target invents a second job registry.

The optional `#:node-job-instance` keyword is one typed selection: `(path . "deployment/instance.json")`, `(module . "the selected package/subpath")` and `(export . "the selected schedule factory")`. The path names an output-relative regular MetroPlat instance JSON file already included by the target's `#:declarations`. Only schedule sources matching that exact module/export pair are in this realization domain. An unrelated scheduler's identically named field remains unchanged. Absence leaves existing callers unchanged. A selected file without any native job configuration refuses. The output is Guix's actual builder `#$output`; no source producer precomputes its own store hash.

## Authored and realized data

The native schedule source owns one `configuration.jobConfiguration` with the provider's existing fields:

- `runtimeRoot` and `artifact` must each be exactly `{release}` in authored source.
- `jobsDirectory` is an authored runtime-relative path.
- `stateRoot` is an authored absolute receipt root, preserved unchanged.
- `unitPrefix` is the authored existing host job-unit prefix.

Only those two exact output fields are replaced. Partial, missing, previously realized or unresolved output references refuse. A placeholder in a native state/job-directory field refuses; ordinary strings elsewhere are unchanged. Other source configuration is preserved, including the deployment name and the selected public module/export. Before writing, the helper validates all native configurations and reads their actual declarations through the packed runtime's public `node-job-service` export. It never invokes a job, precheck, network port, systemd command or host state writer.

The exact original UTF-8 bytes are retained at `.guix-systemd/source-declarations/<instance-path>`, inside the same output. Invalid UTF-8 and redirected instance paths refuse. The normal installed path receives deterministic derived JSON; its identity and every unrelated declaration remain the authored values. The output's `.guix-systemd` directory is already reserved by LAGOON and cannot come from packed application content. Repeating realization cannot overwrite retained source.

Both MetroPlat factory passes and later job findings read the same immutable installed instance identified by `METROPLAT_INSTANCE`. Its admitted identity check remains in the existing loader/Group composition. Operating permissions and office powers do not follow from source realization. The target's execution role still controls whether factories or schedules run; an actor-only declaration does not acquire worker duties by being structurally realized.

## Native generations and existing receipt custody

Ordinary and first-cutover construction use the same declaration realization. Their distinct Guix outputs each contain their own runtime/artifact references. The first-cutover state converter and activation checks remain independent. Rollback selects its earlier native output and that output's own realized instance, rather than rewriting an older instance to point at the latest generation. State roots remain the target's authored existing receipt locations across all generations.

The paired machine amendment selects `deployment/instance.json` in BCF and CRG. Both operation/schedule bindings move together to the Group Computer public export. BCF also gains the missing explicit `METROPLAT_INSTANCE={release}/deployment/instance.json` environment declaration; CRG already has that declaration. Existing retained release.json values establish receipt directory and unit prefix, while the authored machine declarations establish the existing `/home/emsenn` home. No credential, access, policy or host setting is changed by this source proposal.

## Receiving boundaries

The Node suite preserves all eleven portable-runtime tests and adds deterministic/field-boundary/source-custody refusals. Paired target receiving uses the exact BCF/CRG instance and 28 job declarations, checking the two actual factory passes through the real MetroPlat installer and job provider without invoking any run verb. That bounded local assay maps only test-owned Guix-output/state coordinates to temporary files; it is not a native Guix build or a whole-instance runtime qualification.

The existing Guix/Guile construction and activation suites still apply. Actual source-only CI must receive the complete frozen runtime, each target/variant's Guix output, actual installed role and prior-generation configuration before activation. This helper does not relax whole-root ownership, package closure, existing source/build receiving or activation conditions.
