import { describe, expect, it } from "vitest";
import { effectFixture } from "../../test-support/size-observer-effects-fixture.js";
import { validateSizeObservers } from "./size-observers.js";

const SOURCE = `module Game;
place(at:$3400) let answers:byte[80]=[;0];
function main():void{
  let sum:byte=0;let count:byte=0;
  for(let ordinal:word=0;ordinal<8;ordinal+=1){
    answers[ordinal+2]=byte(ordinal);sum+=byte(ordinal);count+=1;
  }
  answers[0]=sum;answers[1]=count;
  let output:byte=10;
  for(let column:word=0;column<8;column+=1){
    for(let other:word=column+1;other<8;other+=1){
      answers[output]=byte(column);output+=1;
      answers[output]=byte(other);output+=1;
    }
  }
  answers[66]=output;
}`;

describe("parameterless canonical counter closure", () => {
  it("should close bounded output guards while independently proving narrowed counters", () => {
    const input = effectFixture(SOURCE, "size", true, "low-byte");
    const result = validateSizeObservers(input);
    expect(result, result.kind === "complete" ? undefined : result.reason).toMatchObject({
      kind: "complete",
    });
  });

  it("should derive the nested triangular accumulator bound without runtime guards", () => {
    const input = effectFixture(SOURCE, "size", false, "low-byte");
    const result = validateSizeObservers(input);
    expect(result, result.kind === "complete" ? undefined : result.reason).toMatchObject({
      kind: "complete",
    });
  });

  it.each(["double step", "write outside the loops"] as const)(
    "should reject the accumulator proof when the source has a %s",
    (mutation) => {
      const source =
        mutation === "double step"
          ? SOURCE.replaceAll("output+=1", "output+=2")
          : SOURCE.replace("answers[66]=output;", "output+=1;answers[66]=output;");
      const input = effectFixture(source, "size", false, "low-byte");
      expect(validateSizeObservers(input).kind).toBe("rejected");
    },
  );

  it("should reject an unrecognized enclosing loop around the inner counter", () => {
    const source = `module Game;
place(at:$3400) let answers:byte[80]=[;0];
function main():void{
  let output:byte=10;
  for(let column:word=0;column<8;column+=1){
    for(let repeat:byte=0;repeat<2;repeat+=1){
      for(let other:word=column+1;other<8;other+=1){
        answers[output]=byte(column);output+=1;
        answers[output]=byte(other);output+=1;
      }
    }
  }
  answers[66]=output;
}`;
    const input = effectFixture(source, "size", false, "low-byte");
    expect(validateSizeObservers(input).kind).toBe("rejected");
  });
});
