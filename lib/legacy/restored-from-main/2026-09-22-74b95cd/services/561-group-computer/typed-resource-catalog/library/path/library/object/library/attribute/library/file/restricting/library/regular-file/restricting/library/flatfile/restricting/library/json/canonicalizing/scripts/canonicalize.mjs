// Compatibility path for historical source-tree readers. Canonical JSON is a
// generic JSON-carrier concern and now lives in json-codec-service; EAVT uses
// it rather than maintaining an OS-local copy.
export { canonical as jcs, canonical as canonicalize, canonical as default }
  from "../../../../../../../../../../../../../../../../../../../../../../../../../computer-data-engineering-services-section/services/serialized-computer-data-engineering-services-section/services/json-services-section/src/index.mjs";
