import type { SourceSpan } from "../project/types.js";
import { ComptimeBudget } from "./comptime-budget.js";
import { decodeComptimeScalar, encodeComptimeScalar } from "./constant-bytes.js";
import { semanticTypeSize } from "./semantic-type-relations.js";
import { bindingIdentityKey } from "./semantic-types.js";
import type { BindingId, SemanticType, TypedExpr } from "./semantic-types.js";

/** A scalar result and its still-live logical temporary bytes. */
export interface ScalarValue {
  readonly value: bigint | boolean;
  readonly bytes: number;
}

/** A packed aggregate result and its still-live logical temporary bytes. */
export interface AggregateValue {
  readonly value: readonly number[];
  readonly bytes: number;
}

/** The private values belonging to one compile-time function call. */
export interface ComptimeFrame {
  readonly values: Map<string, bigint | boolean>;
  readonly aggregates: Map<string, number[]>;
  allocatedBytes: number;
}

/** Keep packed bytes distinct from scalar integers at expression joins. */
export function isAggregateValue(value: ScalarValue | AggregateValue): value is AggregateValue {
  return Array.isArray(value.value);
}

/** Interpret fixed aggregate construction, selection, and local mutation. */
export class ComptimeAggregates {
  constructor(
    private readonly budget: ComptimeBudget,
    private readonly constantAggregate: (binding: BindingId) => readonly number[] | null,
    private readonly evaluateScalar: (
      expression: TypedExpr,
      frame: ComptimeFrame,
      root: SourceSpan,
    ) => ScalarValue,
    private readonly evaluateCall: (
      expression: TypedExpr,
      frame: ComptimeFrame,
      root: SourceSpan,
    ) => ScalarValue | AggregateValue,
    private readonly fail: (span: SourceSpan, message: string) => never,
    private readonly convertScalar: (
      value: bigint | boolean,
      type: SemanticType,
    ) => bigint | boolean,
  ) {}

  /** Report whether a checked value occupies a fixed packed aggregate. */
  isAggregate(type: SemanticType): boolean {
    return type.kind === "array" || type.kind === "struct";
  }

  /** Charge semantic byte work independently of the host's copy strategy. */
  chargeBytes(count: number, span: SourceSpan, root: SourceSpan): void {
    for (let index = 0; index < count; index += 1) this.budget.step(span, root);
  }

  /** Materialize a complete value before it can escape its source expression. */
  temporary(
    value: readonly number[],
    type: SemanticType,
    span: SourceSpan,
    root: SourceSpan,
  ): AggregateValue {
    const bytes = semanticTypeSize(type);
    if (value.length !== bytes || value.some((byte) => byte < 0 || byte > 255)) {
      return this.fail(span, "Incomplete compile-time aggregate value");
    }
    this.budget.allocate(bytes, span, root);
    this.chargeBytes(bytes, span, root);
    return { value: [...value], bytes };
  }

  /** Build, copy, or select a packed aggregate using ordinary source evaluation order. */
  evaluate(expression: TypedExpr, frame: ComptimeFrame, root: SourceSpan): AggregateValue {
    this.budget.step(expression.span, root);
    if (expression.embedded !== undefined) return { value: expression.embedded.bytes, bytes: 0 };
    if (expression.encodedBytes !== undefined) {
      return this.temporary(expression.encodedBytes, expression.type, expression.span, root);
    }
    if (
      (expression.kind === "name" || expression.qualifiedModule !== undefined) &&
      expression.binding !== null
    ) {
      const key = bindingIdentityKey(expression.binding);
      const value = frame.aggregates.get(key) ?? this.constantAggregate(expression.binding);
      if (value !== null && value !== undefined) return { value, bytes: 0 };
    }
    if (expression.kind === "array-literal" && expression.type.kind === "array") {
      const type = expression.type;
      const bytes = Array<number>(type.size).fill(-1);
      this.budget.allocate(type.size, expression.span, root);
      const itemBytes = semanticTypeSize(type.element);
      const elements = expression.elements ?? [];
      for (const [index, element] of elements.entries()) {
        const evaluated = this.isAggregate(type.element)
          ? this.evaluate(element, frame, root)
          : this.evaluateScalar(element, frame, root);
        const encoded = isAggregateValue(evaluated)
          ? evaluated.value
          : encodeComptimeScalar(evaluated.value, type.element);
        this.chargeBytes(itemBytes, element.span, root);
        for (let offset = 0; offset < itemBytes; offset += 1) {
          bytes[index * itemBytes + offset] = encoded[offset]!;
        }
        this.budget.release(evaluated.bytes);
      }
      if (elements.length < type.length) {
        const fill = expression.fill;
        if (fill !== null && fill !== undefined) {
          const evaluated = this.isAggregate(type.element)
            ? this.evaluate(fill, frame, root)
            : this.evaluateScalar(fill, frame, root);
          const encoded = isAggregateValue(evaluated)
            ? evaluated.value
            : encodeComptimeScalar(evaluated.value, type.element);
          for (let index = elements.length; index < type.length; index += 1) {
            this.chargeBytes(itemBytes, fill.span, root);
            for (let offset = 0; offset < itemBytes; offset += 1) {
              bytes[index * itemBytes + offset] = encoded[offset]!;
            }
          }
          this.budget.release(evaluated.bytes);
        }
      }
      return { value: bytes, bytes: type.size };
    }
    if (expression.kind === "struct-literal" && expression.type.kind === "struct") {
      const type = expression.type;
      const bytes = Array<number>(type.size).fill(0);
      this.budget.allocate(type.size, expression.span, root);
      for (const entry of expression.fields ?? []) {
        const field = type.fields.find(({ name }) => name === entry.name);
        if (field === undefined) {
          return this.fail(expression.span, "Incomplete compile-time struct initializer");
        }
        const source = entry.value;
        const evaluated = this.isAggregate(field.type)
          ? this.evaluate(source, frame, root)
          : this.evaluateScalar(source, frame, root);
        const encoded = isAggregateValue(evaluated)
          ? evaluated.value
          : encodeComptimeScalar(evaluated.value, field.type);
        this.chargeBytes(semanticTypeSize(field.type), source.span, root);
        for (let offset = 0; offset < encoded.length; offset += 1) {
          bytes[field.offset + offset] = encoded[offset]!;
        }
        this.budget.release(evaluated.bytes);
      }
      return { value: bytes, bytes: type.size };
    }
    if (
      expression.kind === "conditional" &&
      expression.condition !== undefined &&
      expression.whenTrue !== undefined &&
      expression.whenFalse !== undefined
    ) {
      const condition = this.evaluateScalar(expression.condition, frame, root);
      this.budget.release(condition.bytes);
      const selected = condition.value ? expression.whenTrue : expression.whenFalse;
      const evaluated = this.evaluate(selected, frame, root);
      const result = this.temporary(evaluated.value, expression.type, expression.span, root);
      this.budget.release(evaluated.bytes);
      return result;
    }
    if (
      (expression.kind === "member" || expression.kind === "index") &&
      expression.object !== undefined
    ) {
      const object = expression.object;
      const aggregate = this.evaluate(object, frame, root);
      let indexBytes = 0;
      try {
        let offset: number;
        if (expression.kind === "member" && object.type.kind === "struct") {
          const field = object.type.fields.find(({ name }) => name === expression.member);
          if (field === undefined) return this.fail(expression.span, "Unknown compile-time field");
          offset = field.offset;
        } else if (expression.kind === "index" && object.type.kind === "array") {
          if (expression.index === undefined)
            return this.fail(expression.span, "Missing array index");
          const index = this.evaluateScalar(expression.index, frame, root);
          indexBytes = index.bytes;
          if (
            typeof index.value !== "bigint" ||
            index.value < 0n ||
            index.value >= BigInt(object.type.length)
          ) {
            return this.fail(expression.index.span, "Compile-time array index is out of bounds");
          }
          offset = Number(index.value) * semanticTypeSize(object.type.element);
        } else {
          return this.fail(expression.span, "Unsupported compile-time aggregate selection");
        }
        const size = semanticTypeSize(expression.type);
        return this.temporary(
          aggregate.value.slice(offset, offset + size),
          expression.type,
          expression.span,
          root,
        );
      } finally {
        this.budget.release(aggregate.bytes + indexBytes);
      }
    }
    if (
      expression.kind === "assignment" &&
      expression.operator === "=" &&
      expression.target?.binding !== null &&
      expression.target?.binding !== undefined &&
      typeof expression.value === "object" &&
      expression.value !== null &&
      "kind" in expression.value
    ) {
      const place = this.localPlace(expression.target, frame, root);
      try {
        const source = this.evaluate(expression.value, frame, root);
        const result = this.temporary(source.value, expression.type, expression.span, root);
        this.chargeBytes(source.value.length, expression.target.span, root);
        for (let index = 0; index < source.value.length; index += 1) {
          place.data[place.offset + index] = source.value[index]!;
        }
        this.budget.release(source.bytes);
        return result;
      } finally {
        this.budget.release(place.indexBytes);
      }
    }
    if (expression.kind === "call") {
      const result = this.evaluateCall(expression, frame, root);
      if (isAggregateValue(result)) return result;
    }
    return this.fail(expression.span, "This aggregate cannot be evaluated at compile time");
  }

  /** Decode one scalar from a selected fixed aggregate. */
  readScalar(expression: TypedExpr, frame: ComptimeFrame, root: SourceSpan): ScalarValue {
    const object = expression.object;
    if (object === undefined) return this.fail(expression.span, "Missing aggregate object");
    const aggregate = this.evaluate(object, frame, root);
    let indexBytes = 0;
    try {
      let offset: number;
      if (expression.kind === "member" && object.type.kind === "struct") {
        const field = object.type.fields.find(({ name }) => name === expression.member);
        if (field === undefined) return this.fail(expression.span, "Unknown compile-time field");
        offset = field.offset;
      } else if (expression.kind === "index" && object.type.kind === "array") {
        if (expression.index === undefined)
          return this.fail(expression.span, "Missing array index");
        const index = this.evaluateScalar(expression.index, frame, root);
        indexBytes = index.bytes;
        if (
          typeof index.value !== "bigint" ||
          index.value < 0n ||
          index.value >= BigInt(object.type.length)
        ) {
          return this.fail(expression.index.span, "Compile-time array index is out of bounds");
        }
        offset = Number(index.value) * semanticTypeSize(object.type.element);
      } else {
        return this.fail(expression.span, "Unsupported compile-time aggregate selection");
      }
      const size = semanticTypeSize(expression.type);
      if (aggregate.value.slice(offset, offset + size).some((byte) => byte < 0 || byte > 255)) {
        return this.fail(
          expression.span,
          "Compile-time read of an uninitialized aggregate element",
        );
      }
      const value = decodeComptimeScalar(aggregate.value, offset, expression.type);
      const bytes = semanticTypeSize(expression.type);
      this.budget.allocate(bytes, expression.span, root);
      return { value, bytes };
    } finally {
      this.budget.release(aggregate.bytes + indexBytes);
    }
  }

  /** Write a scalar through a local aggregate place, including nested fields or indices. */
  assignScalar(
    expression: TypedExpr,
    valueNode: TypedExpr,
    frame: ComptimeFrame,
    root: SourceSpan,
  ): ScalarValue {
    const target = expression.target;
    if (target === undefined) return this.fail(expression.span, "Missing aggregate target");
    const place = this.localPlace(target, frame, root);
    try {
      const rhs = this.evaluateScalar(valueNode, frame, root);
      try {
        const converted = this.convertScalar(rhs.value, target.type);
        const encoded = encodeComptimeScalar(converted, target.type);
        const bytes = semanticTypeSize(expression.type);
        this.budget.allocate(bytes, expression.span, root);
        const result = { value: converted, bytes };
        this.chargeBytes(encoded.length, target.span, root);
        for (let index = 0; index < encoded.length; index += 1) {
          place.data[place.offset + index] = encoded[index]!;
        }
        return result;
      } finally {
        this.budget.release(rhs.bytes);
      }
    } finally {
      this.budget.release(place.indexBytes);
    }
  }

  /** Resolve a local place once, evaluating nested indices from outside inward. */
  private localPlace(
    target: TypedExpr,
    frame: ComptimeFrame,
    root: SourceSpan,
  ): { readonly data: number[]; readonly offset: number; readonly indexBytes: number } {
    const path: TypedExpr[] = [];
    let object: TypedExpr = target;
    while ((object.kind === "member" || object.kind === "index") && object.object !== undefined) {
      path.unshift(object);
      object = object.object;
    }
    if (object.binding === null) return this.fail(target.span, "Missing local aggregate");
    const data = frame.aggregates.get(bindingIdentityKey(object.binding));
    if (data === undefined) {
      return this.fail(target.span, "Compile-time assignment cannot write runtime storage");
    }
    let offset = 0;
    let indexBytes = 0;
    this.budget.step(object.span, root);
    for (const part of path) {
      this.budget.step(part.span, root);
      const parent = part.object;
      if (part.kind === "member" && parent?.type.kind === "struct") {
        const field = parent.type.fields.find(({ name }) => name === part.member);
        if (field === undefined) return this.fail(part.span, "Unknown compile-time field");
        offset += field.offset;
      } else if (part.kind === "index" && parent?.type.kind === "array") {
        if (part.index === undefined) return this.fail(part.span, "Missing array index");
        const index = this.evaluateScalar(part.index, frame, root);
        indexBytes += index.bytes;
        if (
          typeof index.value !== "bigint" ||
          index.value < 0n ||
          index.value >= BigInt(parent.type.length)
        ) {
          return this.fail(part.index.span, "Compile-time array index is out of bounds");
        }
        offset += Number(index.value) * semanticTypeSize(parent.type.element);
      } else {
        return this.fail(part.span, "Unsupported compile-time aggregate assignment");
      }
    }
    return { data, offset, indexBytes };
  }
}
