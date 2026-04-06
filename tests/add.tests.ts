import { expect, it } from "@jest/globals";
import { add } from "../src/utils/index.js";
// jest.mock("../src/config", () => ({
//   debug: true,
// }));
it("should add two numbers correctly", () => {
  expect(add(2, 3)).toBe(5);
  expect(add(-1, 1)).toBe(0);
  expect(add(0, 0)).toBe(0);
});
