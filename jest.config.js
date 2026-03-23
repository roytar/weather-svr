module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
  },
  testRegex: "((\\.|/)(test|spec|tests))\\.(ts|tsx)$",

  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
};
