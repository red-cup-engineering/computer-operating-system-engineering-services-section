// governance — the FOUR-valued jural/Hohfeldian governance layer that rides ON the federation.
//
// THE LAW for this file. A governance decision is NOT a boolean. Each regime's `admit(ctx)` returns a
// FOUR-valued charge — t affirmed, f denied, ⊥ not-yet-settled, ⊤ contradicted — so "denied" and
// "unknown" and "contradicted" stop collapsing into one silent false. A standing disagreement is held
// as ⊤ (both an affirmation and a withholding stand on the same action), surfaced, never destroyed.
// governAction does no I/O and no write: it FOLDS a context to a decision and returns it. Persisting
// that decision (append it to the actor's log; let the federation union it; settle later) is the
// caller's job — governance posits the value, the trace keeps it.
//
// ARCHITECTURE CONTRACT: imports ONLY the math kernel FOUR (the four-bilattice values) and the L2
// canonical JSON for the decision id. No coordinator, no clock (the caller stamps `now`), no node:fs.
// A decision is plural and situational — selectRegime folds the situation to a regime; nothing is
// assumed kyriarchical except by explicit default.
//
// Lifted from apps/tools/swarm/src/{regimes.mjs, governance.mjs}. The REGIMES registry, GOV_AXES, the
// known-but-underived families, and admitUnder are lifted verbatim-in-logic (cites preserved). The
// swarm-specific machinery — the on-disk write(memoryRootOf, term, doc), the cost-witness pulled from
// swarm's ledger graph, the office/structuration coupling — STAYS in swarm; this file takes a
// `can(agent, action)` and an optional pre-built `costWitness` as PARAMETERS instead of reaching into
// swarm's subsystems. That keeps governance pure and lets ANY federated peer govern, not just swarm.

 // the four-bilattice values
import { pointWitnesses } from "@red-cup-engineering/metrologic/chu"; // the cone reads: a point's witness row + its settled charge
import { canonicalJson } from "@red-cup-engineering/json-services-section/canonical-json";
import { sha256Bytes } from "@red-cup-engineering/cryptographic-computer-data-engineering-services-section/portable-sha256";
import { isTruthTop } from "@red-cup-engineering/computer-data-engineering-services-section/four";

// stableId(parts, kind) — content-addressed id of a decision (jcs->sha256, the row identity), so the
// same actor+action+target+time fold to the same decision id (federation can then dedupe them).
function stableId(parts, kind) {
  const digest = sha256Bytes(new TextEncoder().encode(canonicalJson(parts))).slice(0, 16);
  return `${kind}:${digest}`;
}

// === the six axes-of-variation in Gov ======================================================
// (what-is-the-theory-of-governance.md §lines 503-509). A regime names its position on each axis;
// positions the corpus states are sourced, the rest marked inferred so synthesis stays apart from fact.
export const GOV_AXES = Object.freeze([
  "persons-and-relations",            // individuals primitive, or relations primitive?
  "synchronic-diachronic",            // governance a state-of-being, or a sequence-of-acts?
  "constitutive-regulative",          // generate institutional facts, or regulate prior ones?
  "binding-source",                   // consent / kinship / office / recognition / force / ritual / cosmic-order
  "boundary-source",                  // territory / descent-and-clan / act-of-membership / belief / ritual / kinship
  "recursion-of-meta-governance",     // amendment / informal-evolution / ceremonial-revision / denial
]);

function affirmationsFrom(ctx) {
  const o = ctx.options ?? {};
  const t = ctx.target ?? {};
  return [].concat(o.affirmations ?? t.affirmations ?? []).filter(Boolean).map(String);
}

function withdrawalsFrom(ctx) {
  const o = ctx.options ?? {};
  const t = ctx.target ?? {};
  return [].concat(o.withdrawals ?? t.withdrawals ?? []).filter(Boolean).map(String);
}

function officeOf(ctx) {
  return ctx.officeName ?? ctx.agent?.office ?? ctx.agent?.name ?? "worker";
}

// readCone(space, point) — READ a settled cone (a sectionSpace Chu space) for ONE action point instead
// of re-folding flat FOUR by counting two arrays. The witness-states whose face is t/⊤ are the parties
// who AFFIRM the action; those whose face is f/⊤ WITHHOLD it; settleRow gives the action's settled FOUR
// face (⊤ = a held contradiction — both an affirmation and a withholding stand). This is the cone the
// federation already settled (sectionSpace), not a re-derivation. When no explicit point is given we use
// the space's single/first point. Returns { affirmations, withdrawals, settled } or null if unreadable.
function readCone(space, point) {
  if (!space || !Array.isArray(space.points)) return null;
  const pt = point != null && space.points.includes(point) ? point : space.points[0];
  if (pt == null) return null;
  const witnesses = pointWitnesses(space, pt);
  return { affirmations: witnesses.for, withdrawals: witnesses.against, settled: witnesses.settled };
}

// canOf(ctx) — the capability test. The caller supplies `can(agent, action) -> boolean`; absent one,
// the kyriarchical regime cannot affirm office-capability, so it denies (f). Governance does not
// invent an office model — that domain knowledge is the caller's, passed in.
function canOf(ctx) {
  const can = ctx.can ?? (() => false);
  return !!can(ctx.agent, ctx.action);
}

// === the regime registry ====================================================================
// Each regime is a point in the six-axis Gov space plus a settling rule that returns a FOUR-valued
// decision. SWARM does not pick a regime up front — selectGovernanceRegime folds the situation to one,
// defaulting to kyriarchical so a caller that passes neither governs exactly as before (admitted iff
// can()). The Lakota-named regime, roles, and virtues live in the corpus, cited below; this file
// authors NO Lakota content — it expresses consensus-by-withdrawal entirely in its own vocabulary.
export const REGIMES = Object.freeze({
  // ── Kyriarchical / captain regime — the delegation chain. ───────────────────────────────────
  // Captain at the apex; each link a scope-bounded, revocable delegation morphism; accountability is
  // H^0-invariant under chain extension. Admission is bare office-capability membership.
  //   — lab .../governing/docs/dev/notes/kyriarchical-agentics-may-2026.md §1
  kyriarchical: Object.freeze({
    name: "kyriarchical",
    title: "Kyriarchical (captain / delegation chain)",
    policy: "office-capability",
    summary: "Admit iff the actor's office holds the capability; authority flows down a revocable delegation chain from the captain.",
    source: "lab/.../governing/docs/dev/notes/kyriarchical-agentics-may-2026.md §1",
    axes: Object.freeze({
      "persons-and-relations": { value: "persons-primitive", inferred: true },
      "synchronic-diachronic": { value: "diachronic (sequence-of-dispatch-acts)", inferred: true },
      "constitutive-regulative": { value: "regulative-leaning", inferred: true },
      "binding-source": { value: "office (Weberian rational-legal)", source: "what-is-the-theory-of-governance.md §line 507" },
      "boundary-source": { value: "act-of-membership / office", inferred: true },
      "recursion-of-meta-governance": { value: "explicit-amendment", inferred: true },
    }),
    admit(ctx) {
      const ok = canOf(ctx);
      return {
        value: ok ? "potential" : "active",
        jural: "power",
        binding: true,
        policy: "office-capability",
        reason: ok
          ? `${officeOf(ctx)} office holds ${ctx.action}.`
          : `${officeOf(ctx)} office does not hold ${ctx.action}.`,
      };
    },
  }),

  // ── Consensus-by-withdrawal regime — the kin-relational settling, in this file's own vocabulary. ─
  // A settling over workers' affirmations (the same knowledge-join the kernel runs); a withholding is a
  // non-affirmation that keeps a cell out of the settled section; collective action proceeds when no
  // worker withholds. The substantive wolakȟota theory it points at remains the corpus's.
  //   — lab .../governing/docs/dev/notes/tiyospaye-is-agentic-drone-swarm-may-2026.md §1.3-1.5
  //   — lab/.../lakotaean-politics/philA/concepts/consensus-by-withdrawal.md
  "consensus-by-withdrawal": Object.freeze({
    name: "consensus-by-withdrawal",
    title: "Consensus by withdrawal (kin-relational settling)",
    policy: "consensus-by-withdrawal",
    summary: "Settle the collective model over worker affirmations; a withholding is a non-affirmation and is the veto; the settled section is the consensus.",
    source: "tiyospaye-is-agentic-drone-swarm-may-2026.md §1.3-1.5; swarm-spelled-out.md",
    axes: Object.freeze({
      "persons-and-relations": { value: "relations-primitive", source: "tiyospaye §2.5" },
      "synchronic-diachronic": { value: "synchronic (state-of-being-in-right-relation)", source: "tiyospaye §2.5" },
      "constitutive-regulative": { value: "constitutive", source: "tiyospaye §2.5" },
      "binding-source": { value: "kinship-and-relation", source: "tiyospaye §2.5" },
      "boundary-source": { value: "descent-and-clan", source: "tiyospaye §2.5" },
      "recursion-of-meta-governance": { value: "ceremonial-revision", source: "tiyospaye §2.5" },
    }),
    admit(ctx) {
      const withdrawals = withdrawalsFrom(ctx);
      const affirmations = affirmationsFrom(ctx);
      if (withdrawals.length) {
        return {
          value: "active",
          jural: "privilege",
          binding: true,
          policy: "consensus-by-withdrawal",
          reason: `a withholding keeps the action out of the settled section: ${withdrawals.join(", ")} withheld.`,
          withdrawals,
          affirmations,
        };
      }
      if (affirmations.length) {
        return {
          value: "potential",
          jural: "privilege",
          binding: true,
          policy: "consensus-by-withdrawal",
          reason: `no worker withheld; the collective model settles over ${affirmations.length} affirmation(s).`,
          withdrawals,
          affirmations,
        };
      }
      return {
        value: "absurd",
        jural: "privilege",
        binding: false,
        policy: "consensus-by-withdrawal",
        reason: "no affirmation has entered the join yet; the cell has not risen to the settled section.",
        withdrawals,
        affirmations,
      };
    },
  }),

  // ── Advisory regime — counsel without command. ───────────────────────────────────────────────
  // A role of counsel that binds no one (plural-situational-governance.md §lines 66-69): in Hohfeldian
  // terms the advisor holds a privilege (no duty is created in anyone) — permitted-but-non-binding.
  advisory: Object.freeze({
    name: "advisory",
    title: "Advisory (counsel without command)",
    policy: "advisory",
    summary: "Always permits the act of counsel; creates no duty in anyone — a privilege that binds no one.",
    source: "docs/dev/notes/2026-06-04-plural-situational-governance.md §lines 66-69",
    axes: Object.freeze({
      "persons-and-relations": { value: "either (overlay)", inferred: true },
      "binding-source": { value: "recognition (counsel is heeded, not commanded)", inferred: true },
    }),
    admit(ctx) {
      return {
        value: "potential",
        jural: "privilege",
        binding: false,
        policy: "advisory",
        reason: `advice on ${ctx.action} is offered as counsel; it binds no office.`,
      };
    },
  }),

  // ── Contrarian regime — productive contradiction made visible. ──────────────────────────────
  // The bearer of the move from ⊥ to ⊤: contradiction is generative, not defective. When affirmation and
  // withholding both stand on the same action, this regime surfaces it as ⊤ rather than collapsing it to
  // a silent denial. Points at the corpus's Heyókȟa (tiyospaye §1.6); authors no Lakota content.
  //   — docs/dev/notes/2026-06-04-plural-situational-governance.md §line 69
  contrarian: Object.freeze({
    name: "contrarian",
    title: "Contrarian (productive contradiction surfaced)",
    policy: "contrarian-surfacing",
    summary: "Surfaces a standing contradiction as ⊤ (both affirmed and withheld) instead of collapsing it; otherwise leaves the action unsettled.",
    source: "docs/dev/notes/2026-06-04-plural-situational-governance.md §line 69 (Heyókȟa, tiyospaye §1.6)",
    axes: Object.freeze({
      "persons-and-relations": { value: "relations-primitive (overlay)", inferred: true },
    }),
    admit(ctx) {
      const withdrawals = withdrawalsFrom(ctx);
      const affirmations = affirmationsFrom(ctx);
      if (withdrawals.length && affirmations.length) {
        return {
          value: "stable",
          jural: "privilege",
          binding: false,
          policy: "contrarian-surfacing",
          reason: `contradiction on ${ctx.action}: affirmed by ${affirmations.join(", ")} and withheld by ${withdrawals.join(", ")} — surfaced, not collapsed.`,
          withdrawals,
          affirmations,
        };
      }
      return {
        value: "absurd",
        jural: "privilege",
        binding: false,
        policy: "contrarian-surfacing",
        reason: "no standing contradiction to surface.",
        withdrawals,
        affirmations,
      };
    },
  }),
});

// Regime families the corpus NAMES but has not derived — catalogued for honesty, never executed.
//   — tiyospaye §2.5 (five documented cases); what-is-the-theory-of-governance.md §lines 504-509
export const KNOWN_REGIME_FAMILIES = Object.freeze([
  Object.freeze({ name: "haudenosaunee-great-law", derived: false, source: "tiyospaye §2.5" }),
  Object.freeze({ name: "ubuntu", derived: false, source: "what-is-the-theory-of-governance.md §line 504" }),
  Object.freeze({ name: "confucian-li", derived: false, source: "what-is-the-theory-of-governance.md §lines 505, 509" }),
  Object.freeze({ name: "maori-rangatiratanga", derived: false, source: "tiyospaye §2.5" }),
  Object.freeze({ name: "inuit-qaujimajatuqangit", derived: false, source: "tiyospaye §2.5" }),
]);

export const DEFAULT_REGIME = "kyriarchical";

export function regimeNames() {
  return Object.keys(REGIMES);
}

export function selectRegime(name) {
  return REGIMES[name] ?? REGIMES[DEFAULT_REGIME];
}

// admitUnder(regimeName, ctx) — run a named (or selected) regime's settling rule over a decision
// context. ctx is { agent, action, target, can, options, officeName }. Returns the regime name/title
// alongside the FOUR-valued decision.
export function admitUnder(regimeName, ctx) {
  const regime = selectRegime(regimeName);
  const decision = regime.admit(ctx);
  return { regime: regime.name, title: regime.title, ...decision };
}

// === governAction: fold a context to a persisted-able decision ==============================
// governAction(agent, action, target?, options?) — the top-level fold. Selects a regime (explicit
// options.regime wins; else options.regimeFor(structuration) if supplied; else DEFAULT_REGIME), runs
// its FOUR-valued admit, and returns a decision RECORD: a plain object an actor can append to its log
// as the value of (agent, "governed", record) so the federation unions it and a later settle folds it.
//
// This does NO write and NO clock-reach: options.now is the caller's stamp (federation has no clock),
// options.can is the capability test, options.costWitness is an OPTIONAL pre-built witness the caller
// computed (e.g. from costGraphSummary below or swarm's ledger). Governance posits; the trace keeps.
export function governAction(agent, action, target = {}, options = {}) {
  const now = options.now ?? null; // no Date.now() here — the caller stamps; absent => unstamped fold.
  const regimeName = options.regime
    ?? (options.structuration && options.regimeFor ? options.regimeFor(options.structuration) : DEFAULT_REGIME);
  const officeName = options.officeName ?? agent?.office ?? agent?.name ?? "worker";

  // OPTIONAL cone reading: when the caller hands a sectionSpace cone (options.space) for this action,
  // READ the affirmations/withdrawals off it (settleRow + chuRow) rather than re-folding flat FOUR, and
  // feed them through the SAME regime admit path. The cone's witnesses are UNIONED with any explicit
  // arrays the caller also passed (a cone party and an explicit party both count). When no space is
  // given, behavior is EXACTLY as before — every current call path uses the flat arrays untouched.
  let admitOptions = options;
  if (options.space) {
    const cone = readCone(options.space, options.point);
    if (cone) {
      admitOptions = {
        ...options,
        affirmations: [...new Set([...[].concat(options.affirmations ?? []).map(String), ...cone.affirmations])].sort(),
        withdrawals: [...new Set([...[].concat(options.withdrawals ?? []).map(String), ...cone.withdrawals])].sort(),
      };
    }
  }

  const decision = admitUnder(regimeName, {
    agent,
    action,
    target,
    options: admitOptions,
    officeName,
    can: admitOptions.can,
  });
  const admitted = isTruthTop(decision.value);
  const costWitness = options.costWitness ?? null;
  const id = stableId([agent?.name ?? "", action, target.kind ?? "", target.title ?? "", now], "decision");
  return Object.freeze({
    kind: "distribution.governance.decision",
    id,
    actor: agent?.name ?? "",
    office: officeName,
    action,
    targetKind: target.kind ?? "",
    targetTitle: target.title ?? "",
    admitted,
    regime: decision.regime,
    title: decision.title,
    value: decision.value,
    jural: decision.jural ?? "",
    binding: decision.binding ?? true,
    reason: decision.reason,
    policy: decision.policy,
    withdrawals: decision.withdrawals ?? [],
    affirmations: decision.affirmations ?? [],
    costWitness: costWitness ?? {},
    costWitnessKind: costWitness?.kind ?? "",
    created: now,
  });
}

export default governAction;
