// eavt-worker — the Node worker for LAGOON's (this package's) node-worker (WO-6): a stdio loop
// dispatching {id, verb, args} JSON frames to real functions the owning packages already publish
// (the EAVT section's generic verbs, systemd-unit-inventory-observation-service, the inference
// work market, and FeltOS's Flatfile world operations), replying {id, ok, value} or
// {id, ok: false, error}. Invents and ports nothing.
//
// This worker's generic EAVT verbs (assert-row/append/read/entities/fold-trace/relate/
// relate-from/encode-cbor/decode-cbor/row-id/dedupe/fold/settle/section/supersede/constitute/
// verify-address) are not this package's own: they are @red-cup-engineering/eavt's own
// scripts/serve-eavt-over-stdio.mjs, composed in here so this one process still exposes every
// verb a Guile caller needs, under one shared type catalog. Only the verbs below — deployment's
// own concern (inference procurement, FeltOS resource inspection, systemd observation, and the
// world look/go/say LAGOON's Guile drives) — are defined in this file.
//
// Run: `node scripts/eavt-worker.mjs` (stdio only, no argv).

import { readFileSync } from "node:fs";
import {
  ROW_SCHEMA,
  REFUSAL_SCHEMA,
  genericEavtVerbs,
  GENERIC_EAVT_EFFECTS,
  buildEavtStdioWorker,
  runStdioWorker,
} from "@red-cup-engineering/eavt/serve-eavt-over-stdio";
import { observeUnitInventory } from "@red-cup-engineering/systemd-unit-inventory-observation-service";
import { INFERENCE_WORK_OPERATION } from "@red-cup-engineering/inference-dispatch-service/carriers";
import { dispatchInference } from "@red-cup-engineering/inference-dispatch-service/inference-dispatch";
import {
  inspectFlatfileResourceInputSchema,
  inspectFlatfileResourceOutputSchema,
  inspectFlatfileResourceWithProviders,
} from "@red-cup-engineering/flatfile-resource-graph-service/inspection";
import * as lagoonWorld from "@red-cup-engineering/flatfile-resource-graph-service/lagoon-world";

const FELTOS_INSPECT_RESOURCE_SPEC = Object.freeze({
  args: inspectFlatfileResourceInputSchema,
  returns: inspectFlatfileResourceOutputSchema,
  refusal: REFUSAL_SCHEMA,
});

// Unit observation is an explicit process authority: normal workers receive
// the published systemd observer, while tests may supply a complete fixture.
// The fixture is selected before the process observer is reachable, so an
// unavailable user D-Bus cannot turn a unit-contract test into a host probe.
function unitInventoryAuthority() {
  const fixturePath = process.env.LAGOON_TEST_UNIT_INVENTORY_FIXTURE;
  if (fixturePath === undefined) return Object.freeze({ observe: observeUnitInventory });
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  if (fixture === null || typeof fixture !== "object"
      || typeof fixture.host !== "string"
      || !Array.isArray(fixture.units)
      || !Array.isArray(fixture.timers)) {
    throw new TypeError("LAGOON_TEST_UNIT_INVENTORY_FIXTURE must name a unit inventory with host, units, and timers");
  }
  return Object.freeze({
    observe(host) {
      if (host !== fixture.host) throw new RangeError(`unit inventory fixture is for '${fixture.host}', not '${host}'`);
      return fixture;
    },
  });
}

const UNIT_INVENTORY_AUTHORITY = unitInventoryAuthority();

// LAGOON's own deployment-specific verbs: procurement, FeltOS resource inspection, systemd
// observation, and the world look/go/say LAGOON's Guile drives. Every generic EAVT verb (read,
// append, fold, relate, supersede, identity, ...) comes from the EAVT section's own worker table,
// spread in below — LAGOON transports them, it does not own them.
const DEPLOYMENT_VERBS = {
  // The existing work system supplies its complete operation and declarations.
  // Procurement authority must be granted by the worker's process owner.
  "contract-inference-work": {
    operation: INFERENCE_WORK_OPERATION,
    handler: dispatchInference,
    spec: { args: INFERENCE_WORK_OPERATION.domain.schema, returns: INFERENCE_WORK_OPERATION.codomain.schema, refusal: REFUSAL_SCHEMA },
  },

  // FeltOS owns Node-MUD flatfile inspection; LAGOON only transports the admitted
  // request across its Guile process boundary.
  "inspect-resource": {
    handler: inspectFlatfileResourceWithProviders,
    spec: FELTOS_INSPECT_RESOURCE_SPEC,
  },

  // Unit/timer inventory through the process authority: production uses a
  // read-only systemd --user observer; tests supply an explicit fixture.
  "observe-unit-inventory": {
    handler: ({ host }) => UNIT_INVENTORY_AUTHORITY.observe(host ?? "local"),
    spec: {
      args: { type: "object", properties: { host: { type: "string" } }, required: [] },
      returns: {
        type: "object",
        properties: { host: { type: "string" }, units: { type: "array" }, timers: { type: "array" } },
        required: ["host", "units", "timers"],
      },
      refusal: REFUSAL_SCHEMA,
    },
  },

  // compose a place + its located-in things + their folded fibers off an on-disk trace (see
  // FeltOS's Flatfile world owner).
  "look": {
    handler: ({ path, place }) => lagoonWorld.lookWorld(path, place),
    spec: {
      args: {
        type: "object",
        properties: { path: { type: "string" }, place: { type: "string" } },
        required: ["path", "place"],
      },
      returns: {
        type: "object",
        properties: {
          address: {},
          placeAttributes: {},
          things: { type: "array" },
          recentDuties: { type: "array" },
        },
        required: ["address", "placeAttributes", "things"],
      },
      refusal: REFUSAL_SCHEMA,
    },
  },

  // move an already-constituted actor to a named place through FeltOS's Flatfile world owner.
  "go": {
    handler: ({ path, actor, place, t }) => lagoonWorld.moveInWorld(path, actor, place, t),
    spec: {
      args: {
        type: "object",
        properties: {
          path: { type: "string" },
          actor: { type: "string" },
          place: { type: "string" },
          t: { type: "number" },
        },
        required: ["path", "actor", "place", "t"],
      },
      returns: {
        type: "object",
        properties: { address: { type: "string" }, actor: { type: "string" }, place: { type: "string" } },
        required: ["address", "actor", "place"],
      },
      refusal: REFUSAL_SCHEMA,
    },
  },

  // constitute+append an utterance attributed to its speaker and place through FeltOS's Flatfile world owner.
  "say": {
    handler: ({ path, speaker, place, text, t }) => lagoonWorld.speakInWorld(path, speaker, place, text, t),
    spec: {
      args: {
        type: "object",
        properties: {
          path: { type: "string" },
          speaker: { type: "string" },
          place: { type: "string" },
          text: { type: "string" },
          t: { type: "number" },
        },
        required: ["path", "speaker", "place", "text", "t"],
      },
      returns: {
        type: "object",
        properties: { address: { type: "string" }, place: { type: "string" }, genesisRow: ROW_SCHEMA },
        required: ["address", "place", "genesisRow"],
      },
      refusal: REFUSAL_SCHEMA,
    },
  },
};

// This table declares the deployment verbs' effect boundaries; merged with the generic EAVT
// worker's own effects map below.
const DEPLOYMENT_EFFECTS = {
  "inspect-resource": ["filesystem:read"],
  look: ["filesystem:read"],
  go: ["filesystem:read", "filesystem:write"],
  say: ["filesystem:write"],
  "observe-unit-inventory": ["process:execute"],
};

const VERBS = { ...genericEavtVerbs(REFUSAL_SCHEMA), ...DEPLOYMENT_VERBS };
const EFFECTS = { ...GENERIC_EAVT_EFFECTS, ...DEPLOYMENT_EFFECTS };

const allowedEffects = process.env.LAGOON_ALLOWED_EFFECTS === undefined ? undefined : JSON.parse(process.env.LAGOON_ALLOWED_EFFECTS);
const stripSpecArgsVerb = process.env.LAGOON_TEST_STRIP_SPEC_ARGS_VERB || null;
const worker = buildEavtStdioWorker(VERBS, EFFECTS, { platformId: "lagoon/worker", allowedEffects, stripSpecArgsVerb });
runStdioWorker(worker);
