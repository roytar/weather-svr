import { describe, expect, it } from "@jest/globals";
import { formatLocationDisplay } from "../src/utils/index.js";

describe("formatLocationDisplay", () => {
  it("prefers explicit street number and name fields", () => {
    expect(
      formatLocationDisplay({
        latitude: 40.713,
        longitude: -74.006,
        formattedAddress: "48, New York, NY 10007, USA",
        streetNumber: "48",
        streetName: "Broadway",
        city: "New York",
        state: "NY",
        zipcode: "10007",
        country: "USA",
      }),
    ).toEqual({
      streetLine: "48 Broadway",
      localityLine: "New York, NY 10007",
      countryLine: undefined,
      coordinatesLine: "40.713 -74.006",
    });
  });

  it("formats a US address as street, city/state/zip, and coordinates", () => {
    expect(
      formatLocationDisplay({
        latitude: 40.5368,
        longitude: -74.4858,
        formattedAddress: "48 Darrow Street, Franklin Township, NJ 08873, USA",
        city: "Franklin Township",
        state: "NJ",
        zipcode: "08873",
        country: "USA",
      }),
    ).toEqual({
      streetLine: "48 Darrow Street",
      localityLine: "Franklin Township, NJ 08873",
      countryLine: undefined,
      coordinatesLine: "40.5368 -74.4858",
    });
  });

  it("includes the country line for non-US addresses", () => {
    expect(
      formatLocationDisplay({
        latitude: 51.5238,
        longitude: -0.1586,
        formattedAddress: "221B Baker Street, London NW1 6XE, UK",
        city: "London",
        zipcode: "NW1 6XE",
        country: "United Kingdom",
      }),
    ).toEqual({
      streetLine: "221B Baker Street",
      localityLine: "London NW1 6XE",
      countryLine: "United Kingdom",
      coordinatesLine: "51.5238 -0.1586",
    });
  });

  it("omits the street line when the user did not enter a street address", () => {
    expect(
      formatLocationDisplay({
        latitude: 47.6062,
        longitude: -122.3321,
        formattedAddress: "Seattle, Washington, USA",
        city: "Seattle",
        state: "Washington",
        country: "USA",
        inputHasStreetAddress: false,
      }),
    ).toEqual({
      streetLine: undefined,
      localityLine: "Seattle, Washington",
      countryLine: undefined,
      coordinatesLine: "47.6062 -122.3321",
    });
  });
});
