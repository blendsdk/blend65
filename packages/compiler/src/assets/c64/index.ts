import type { AssetHandler } from "../asset-handler.js";
import { charpadHandler } from "./charpad.js";
import { koalaHandler } from "./koala.js";
import { psidHandler } from "./psid.js";
import { spritepadHandler } from "./spritepad.js";

/**
 * Closed native handler inventory for the C64 profile family.
 *
 * The map is read-only by contract and populated only by handlers whose format
 * contract is implemented and whose tests pass. An extension which is reserved
 * but absent from this map fails closed instead of falling back to raw bytes.
 */
export const C64_ASSET_HANDLERS: ReadonlyMap<string, AssetHandler> = new Map<string, AssetHandler>([
  ["charpad", charpadHandler],
  ["koala", koalaHandler],
  ["psid", psidHandler],
  ["spritepad", spritepadHandler],
]);
