import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticOperation, SemanticProgram } from "../semantic/operations.js";
import type { WholeProgram } from "../semantic/whole-program.js";

/**
 * The one active VIC screen relation a program proves at compile time.
 *
 * A program may select a screen with `vicScreenSelect(&SCREEN)` or a constant
 * address. `setSpritePointer` has no screen argument, so it may only derive a
 * base when the whole program names one distinct screen. An unproved or
 * multiple-screen use is a closed failure rather than a silent `$07F8` guess.
 */
export type C64ActiveScreenFact =
  | { readonly kind: "default" }
  | { readonly kind: "constant"; readonly address: number }
  | { readonly kind: "label"; readonly label: string }
  | { readonly kind: "unproved" };

/** One resolved value fact used only while deriving the active screen. */
interface ScreenValueFact {
  readonly constant?: number;
  readonly label?: string;
}

/** Return the stable screen identity for one resolved value fact. */
function screenIdentity(fact: ScreenValueFact): string | null {
  if (fact.constant !== undefined) return `constant:${fact.constant}`;
  if (fact.label !== undefined) return `label:${fact.label}`;
  return null;
}

/** Resolve one value identity inside its owning function. */
function functionValues(
  program: SemanticProgram,
  functionId: string,
): ReadonlyMap<string, ScreenValueFact> {
  const values = new Map<string, ScreenValueFact>();
  const fn = program.functions.find(({ id }) => bindingIdentityKey(id) === functionId);
  if (fn === undefined) return values;
  for (const block of fn.blocks) {
    for (const operation of block.operations) {
      if (operation.kind === "constant") {
        if (typeof operation.value === "bigint") {
          values.set(operation.result, { constant: Number(operation.value & 0xffffn) });
        }
      } else if (operation.kind === "convert") {
        const operand = values.get(operation.operand);
        if (operand?.constant !== undefined) {
          values.set(operation.result, { constant: operand.constant });
        } else if (operand?.label !== undefined) {
          values.set(operation.result, { label: operand.label });
        }
      } else if (operation.kind === "embedded-address") {
        values.set(operation.result, { label: `asset.${operation.asset}` });
      } else if (operation.kind === "place-address" && operation.place.rootType === undefined) {
        values.set(operation.result, {
          label: `global.${bindingIdentityKey(operation.place.root)}`,
        });
      }
    }
  }
  return values;
}

/** Return the screen address argument of one platform operation, when it is one. */
function screenArgument(
  operation: Extract<SemanticOperation, { readonly kind: "platform" }>,
  values: ReadonlyMap<string, ScreenValueFact>,
): ScreenValueFact | null {
  if (operation.capability !== "c64.vic.vicScreenSelect") return null;
  const argument = operation.arguments[0];
  if (argument === undefined) return {};
  return values.get(argument) ?? {};
}

/**
 * Derive the unique active VIC screen relation from a closed semantic program.
 *
 * The scan is deliberately source-level: the field operation itself may be
 * folded into a const initializer before machine lowering. No runtime lookup or
 * public API is introduced.
 */
export function deriveC64ActiveScreen(program: WholeProgram): C64ActiveScreenFact {
  const facts: ScreenValueFact[] = [];
  let unproved = false;
  for (const fn of program.semantic.functions) {
    const values = functionValues(program.semantic, bindingIdentityKey(fn.id));
    for (const block of fn.blocks) {
      for (const operation of block.operations) {
        if (operation.kind !== "platform") continue;
        const fact = screenArgument(operation, values);
        if (fact === null) continue;
        if (screenIdentity(fact) === null) unproved = true;
        else facts.push(fact);
      }
    }
  }
  const identities = new Set(facts.map((fact) => screenIdentity(fact)!));
  if (unproved || identities.size > 1) return Object.freeze({ kind: "unproved" });
  const [fact] = facts;
  if (fact === undefined) return Object.freeze({ kind: "default" });
  if (fact.constant !== undefined) {
    return Object.freeze({ kind: "constant", address: fact.constant });
  }
  return Object.freeze({ kind: "label", label: fact.label! });
}
