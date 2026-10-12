#!/usr/bin/env node
import { foldFileTouchMarket, projectFileTouchMarket } from "../src/file-touch-market.mjs";
import { runJavascriptNodeOperation } from "../../../../../../../../../../computer-code-engineering-services-section/services/javascript-engineering-services-section/services/javascript-node-services-section/src/operation.mjs";

export function marketFileTouch(document) {
  return projectFileTouchMarket(
    foldFileTouchMarket(document.entries, { generatedAt: document.generatedAt }),
    document,
  );
}

if (import.meta.main) {
  const result = await runJavascriptNodeOperation({ name: "market-file-touch", description: "marketFileTouch — the market-file-touch operation.", operation: marketFileTouch }, { arguments: process.argv.slice(2), standardInput: process.stdin, standardOutput: process.stdout });
  process.exitCode = result.exitCode;
}
