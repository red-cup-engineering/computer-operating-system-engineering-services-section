export interface SoftwareInventoryOptions {
  root: string;
  rootBinding?: { source: string | null; owner: string | null; classification: "owned-source" | "off-tree-owned" | "vendor" | "cache" | "release" | "archive" | "recovery" | "unclassified" };
  excludes?: string[];
  digestFiles?: boolean;
  gitmodulesText?: string;
  gitlinksText?: string;
  systemdInventory?: { host: string; units: unknown[]; timers: unknown[] };
  systemdInventories?: Array<{ host: string; units: unknown[]; timers: unknown[] }>;
  systemdSourceBinding?: { source: string; owner: string | null; classification: "owned-source" | "off-tree-owned" | "vendor" | "cache" | "release" | "archive" | "recovery" | "unclassified"; aliases?: string[] };
  systemdHost?: string;
}

export declare function normalizeSystemdInventory(inventory: { host: string; units: unknown[]; timers: unknown[] }): Readonly<object>;
export declare const SOFTWARE_INVENTORY_OPTIONS_SCHEMA: Readonly<object>;
export declare const SOFTWARE_INVENTORY_SCHEMA: Readonly<object>;
export declare function renderSoftwareInventoryDot(graph: { nodes: object[]; edges: object[] }): string;
export declare function commitSoftwareInventory(inventory: object): Readonly<{ commitment: object; addressedBundle: object }>;
export declare function inventorySoftware(options: SoftwareInventoryOptions): Promise<Readonly<object>>;
export declare function softwareInventoryJson(inventory: object): object;
export declare function validateSoftwareInventoryJson(inventory: object): Readonly<{ ok: boolean; errors: readonly object[] }>;
