/**
 * Adds two numeric values.
 *
 * @param a First addend.
 * @param b Second addend.
 * @returns Sum of both numbers.
 */
export function add(a: number, b: number): number {
  const obj = { hello: "world" };
  const c = 7;

  return a + b;
}

/**
 * Builds a numeric sequence from start to stop using a fixed interval.
 *
 * @param start Inclusive starting value.
 * @param stop Exclusive ending value.
 * @param step Increment between each value.
 * @returns Array of evenly spaced numeric values.
 */
export function range(start: number, stop: number, step: number): number[] {
  return Array.from(
    { length: (stop - start) / step },
    (_, i) => start + i * step,
  );
}

export interface LocationDisplayInput {
  latitude: number;
  longitude: number;
  formattedAddress?: string;
  streetName?: string;
  streetNumber?: string;
  country?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  inputHasStreetAddress?: boolean;
  boundingBox?: ParsedBoundingBoxInput;
}

export interface LocationDisplayOutput {
  streetLine?: string;
  localityLine: string;
  countryLine?: string;
  coordinatesLine: string;
}

export interface ParsedLatLonInput {
  latitude: number;
  longitude: number;
}

export interface ParsedBoundingBoxInput {
  lowerLeft: ParsedLatLonInput;
  upperRight: ParsedLatLonInput;
  center: ParsedLatLonInput;
}

/**
 * Formats a Date into short 12-hour America/New_York time with AM/PM.
 *
 * @param date Date instance to format.
 * @returns Readable timestamp string suitable for structured logs.
 */
export function newYorkIsoTimestamp(date: Date): string {
  const millis = String(date.getMilliseconds()).padStart(3, "0");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).formatToParts(date);

  const getPart = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const month = getPart("month");
  const day = getPart("day");
  const hour = getPart("hour");
  const minute = getPart("minute");
  const second = getPart("second");
  const dayPeriod = getPart("dayPeriod");

  return `${month}/${day} ${hour}:${minute}:${second}.${millis} ${dayPeriod} ET`;
}

function isUsCountry(country?: string): boolean {
  return !!country && /^usa?$|^united states$/i.test(country.trim());
}

/**
 * Builds a YYYY-MM-DD key for a date in a specific timezone.
 *
 * @param date Date to normalize.
 * @param timeZone IANA timezone identifier.
 * @returns Date key in YYYY-MM-DD format.
 */
export function dateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  return `${year}-${month}-${day}`;
}

/**
 * Builds a YYYY-MM-DD-HH key for a date in a specific timezone.
 *
 * @param date Date to normalize.
 * @param timeZone IANA timezone identifier.
 * @returns Hour key in YYYY-MM-DD-HH format.
 */
export function hourKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  return `${year}-${month}-${day}-${hour}`;
}

/**
 * Converts wind direction in degrees to a 16-point compass direction.
 *
 * @param degrees Wind direction in degrees.
 * @returns Cardinal/ordinal direction label.
 */
export function degreesToCardinal(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  const directions = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  const index = Math.round(normalized / 22.5) % 16;
  return directions[index];
}

/**
 * Parses a latitude/longitude string in decimal degrees.
 *
 * Supported format: `lat, lon` with optional whitespace and +/- signs.
 *
 * @param value Raw user-entered coordinate string.
 * @returns Parsed coordinates when valid and in range; otherwise `null`.
 */
export function parseLatLonInput(value: string): ParsedLatLonInput | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const match = normalized.match(
    /^([+-]?\d{1,2}(?:\.\d+)?)\s*,\s*([+-]?\d{1,3}(?:\.\d+)?)$/,
  );

  if (!match) {
    return null;
  }

  const latitude = Number.parseFloat(match[1]);
  const longitude = Number.parseFloat(match[2]);

  if (
    Number.isNaN(latitude) ||
    Number.isNaN(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return { latitude, longitude };
}

function parseCoordinateObject(value: unknown): ParsedLatLonInput | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const latValue =
    "latitude" in value
      ? value.latitude
      : "lat" in value
        ? value.lat
        : undefined;
  const lonValue =
    "longitude" in value
      ? value.longitude
      : "lon" in value
        ? value.lon
        : undefined;

  const latitude = Number.parseFloat(String(latValue));
  const longitude = Number.parseFloat(String(lonValue));

  if (
    Number.isNaN(latitude) ||
    Number.isNaN(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return { latitude, longitude };
}

/**
 * Parses a bounding-box JSON string with `lowerLeft` and `upperRight` coordinates.
 *
 * Example:
 * `{"lowerLeft":{"lat":40.4,"lon":-74.6},"upperRight":{"lat":40.8,"lon":-73.9}}`
 *
 * @param value Raw user-entered bounding-box JSON.
 * @returns Parsed lower-left, upper-right, and center coordinates when valid.
 */
export function parseBoundingBoxInput(
  value: string,
): ParsedBoundingBoxInput | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  try {
    const parsed = JSON.parse(normalized) as {
      lowerLeft?: unknown;
      upperRight?: unknown;
    };

    const lowerLeft = parseCoordinateObject(parsed.lowerLeft);
    const upperRight = parseCoordinateObject(parsed.upperRight);

    if (!lowerLeft || !upperRight) {
      return null;
    }

    if (
      lowerLeft.latitude >= upperRight.latitude ||
      lowerLeft.longitude >= upperRight.longitude
    ) {
      return null;
    }

    return {
      lowerLeft,
      upperRight,
      center: {
        latitude: Number(
          ((lowerLeft.latitude + upperRight.latitude) / 2).toFixed(6),
        ),
        longitude: Number(
          ((lowerLeft.longitude + upperRight.longitude) / 2).toFixed(6),
        ),
      },
    };
  } catch {
    return null;
  }
}

/**
 * Validates the supported address input formats for weather lookups.
 *
 * @param value Address string entered by the user.
 * @returns True when the input matches ZIP-only, city/state, lat/lon, or full-address formats.
 */
export function isAllowedAddressFormat(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return false;

  const zipOnlyPattern = /^\d{5}(?:-\d{4})?$/;
  if (zipOnlyPattern.test(normalized)) return true;

  if (parseLatLonInput(normalized)) return true;
  if (parseBoundingBoxInput(normalized)) return true;

  const cityStatePattern =
    /^[A-Za-z]+(?:[A-Za-z .'-]*[A-Za-z])?,\s*(?:[A-Za-z]{2}|[A-Za-z]+(?:[A-Za-z .'-]*[A-Za-z])?)$/;
  if (cityStatePattern.test(normalized)) return true;

  const fullAddressPattern = /^\d+[A-Za-z0-9\-/]*\s+.+/;
  return fullAddressPattern.test(normalized);
}

/**
 * Returns the shared validation message for unsupported address input.
 *
 * @returns User-facing address validation error message.
 */
export function invalidAddressErrorMessage(): string {
  return "Invalid address format. Allowed formats: ZIP only (e.g., 08873), city and state (e.g., Seattle, WA), latitude/longitude (e.g., 40.7128, -74.0060), or full address (e.g., 48 Darrow Street, Franklin Township, NJ 08873).";
}

/**
 * Validates a date string in YYYY-MM-DD format.
 *
 * @param value Date string to validate.
 * @returns True when the date is a valid ISO calendar date.
 */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsedDate = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().startsWith(value)
  );
}

/**
 * Validates an hour key string in YYYY-MM-DD-HH format.
 *
 * @param value Hour key to validate.
 * @returns True when the key matches the supported hour-key format.
 */
export function isValidHourKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}-\d{2}$/.test(value);
}

/**
 * Formats geocoded location data for header display.
 *
 * Layout:
 * - Number Street
 * - city, state zip
 * - country (only if not USA)
 * - lat, lon
 */
export function formatLocationDisplay(
  input: LocationDisplayInput,
): LocationDisplayOutput {
  const addressParts = (input.formattedAddress ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const streetFromParts = [input.streetNumber?.trim(), input.streetName?.trim()]
    .filter(Boolean)
    .join(" ");

  const defaultStreetLineVisibility =
    input.inputHasStreetAddress ?? Boolean(streetFromParts || addressParts[0]);

  const shouldShowStreetLine = input.boundingBox
    ? false
    : defaultStreetLineVisibility;

  const streetLine = input.boundingBox
    ? "Selected bounding box"
    : shouldShowStreetLine
      ? streetFromParts || addressParts[0]
      : undefined;

  const city = input.city?.trim();
  const state = input.state?.trim();
  const zip = input.zipcode?.trim();

  const localityLine =
    city && state
      ? `${city}, ${state}${zip ? ` ${zip}` : ""}`
      : city && zip
        ? `${city} ${zip}`
        : city
          ? city
          : state && zip
            ? `${state} ${zip}`
            : state
              ? state
              : zip
                ? zip
                : addressParts[1] ||
                  (input.boundingBox ? "Selected map area" : "");

  const countryFromAddress = addressParts[addressParts.length - 1];
  const country = input.boundingBox
    ? input.country?.trim()
    : input.country?.trim() || countryFromAddress;
  const countryLine = country && !isUsCountry(country) ? country : undefined;

  const coordinatesLine = input.boundingBox
    ? `LL ${input.boundingBox.lowerLeft.latitude} ${input.boundingBox.lowerLeft.longitude} · UR ${input.boundingBox.upperRight.latitude} ${input.boundingBox.upperRight.longitude}`
    : `${input.latitude} ${input.longitude}`;

  return {
    streetLine,
    localityLine,
    countryLine,
    coordinatesLine,
  };
}

/**
 * Subtracts one number from another.
 *
 * @param a Minuend.
 * @param b Subtrahend.
 * @returns Difference between a and b.
 */
export function subtract(a: number, b: number): number {
  return a - b;
}

/**
 * Multiplies two numbers.
 *
 * @param a First factor.
 * @param b Second factor.
 * @returns Product of a and b.
 */
export function multiply(a: number, b: number): number {
  return a * b;
}

/**
 * Divides one number by another.
 *
 * @param a Dividend.
 * @param b Divisor.
 * @returns Quotient of a divided by b.
 * @throws Error When b is zero.
 */
export function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error("Cannot divide by zero");
  }
  return a / b;
}

// WMO Weather interpretation codes (WW) decoder
// Provides a short description, long description, openweathermap icon,
// and WMO World Weather icon ID (https://worldweather.wmo.int/en/wxicons.html).
const wmoToMapIcon: { [key: string]: [string, string, string, string] } = {
  "0": ["Clear", "Clear sky.", "01", "24"],
  "1": ["MainlyClear", "Mainly clear sky.", "02", "21"],
  "2": ["PartlyCloudy", "Partly cloudy sky.", "02", "22"],
  "3": ["Overcast", "Overcast sky.", "03", "20"],
  "45": ["Fog", "Foggy.", "50", "16"],
  "48": ["Fog", "Depositing rime fog.", "50", "16"],
  "51": ["Drizzle", "Light drizzle.", "10", "15"],
  "53": ["Drizzle", "Moderate drizzle.", "09", "15"],
  "55": ["Drizzle", "Dense drizzle.", "09", "14"],
  "56": ["FreezingDrizzle", "Light freezing drizzle.", "09", "13"],
  "57": ["FreezingDrizzle", "Dense freezing drizzle.", "09", "13"],
  "61": ["Rain", "Slight rain.", "10", "15"],
  "63": ["Rain", "Moderate rain.", "09", "14"],
  "65": ["Rain", "Heavy rain.", "09", "14"],
  "66": ["FreezingRain", "Light freezing rain.", "09", "13"],
  "67": ["FreezingRain", "Heavy freezing rain.", "09", "13"],
  "71": ["Snow", "Slight snow fall.", "13", "7"],
  "73": ["Snow", "Moderate snow fall.", "13", "6"],
  "75": ["Snow", "Heavy snow fall.", "13", "6"],
  "77": ["Snow", "Snow grains falling.", "13", "6"],
  "80": ["Rain", "Slight rain showers.", "10", "12"],
  "81": ["Rain", "Moderate rain showers.", "09", "10"],
  "82": ["Rain", "Violent rain showers.", "09", "9"],
  "85": ["Snow", "Slight snow showers.", "13", "5"],
  "86": ["Snow", "Heavy snow showers.", "13", "5"],
  "95": ["Thunderstorm", "Thunderstorm.", "11", "2"],
  "96": ["Thunderstorm", "Thunderstorm with slight hail.", "11", "3"],
  "99": ["Thunderstorm", "Thunderstorm with heavy hail.", "11", "3"],
};

/**
 * Maps a WMO weather code to short name, summary, icon code, and WMO icon id.
 *
 * @param wmoCode WMO weather condition code as a string.
 * @returns Tuple containing weather label, description, icon code, and WMO icon id.
 */
export function wmoToMapIconFunc(
  wmoCode: string,
): [string, string, string, string] {
  return (
    wmoToMapIcon[wmoCode] || ["Unknown", "Unknown weather code.", "na", "23"]
  );
}

/**
 * Creates the asset URL for an OpenWeather-style icon code.
 *
 * @param iconCode Base icon code (e.g., 01, 02, 10).
 * @param isDay True for day variant, false for night variant.
 * @returns Relative path to the weather icon asset.
 */
export function openWeatherIconUrl(iconCode: string, isDay: boolean): string {
  const suffix = isDay ? "d" : "n";
  return `/assets/weather-icons/${iconCode}${suffix}@2x.svg`;
}

/**
 * Returns a high-resolution icon URL for display (uses local @2x assets).
 *
 * @param iconCode OWM base icon code (e.g., 01, 10).
 * @param isDay True for daytime variant.
 * @returns URL of the high-res local icon PNG.
 */
export function meteoconUrl(iconCode: string, isDay: boolean): string {
  return openWeatherIconUrl(iconCode, isDay);
}

/**
 * Converts a WMO weather code into display-friendly summary and icon details.
 *
 * @param wmoCode Weather code as number or string.
 * @param isDay True when icon should use daytime variant.
 * @returns Weather summary with resolved icon code and URL.
 */
export function wmoToOpenWeatherIcon(
  wmoCode: string | number,
  isDay: boolean,
): { summary: string; iconCode: string; iconUrl: string; meteoconUrl: string } {
  const weatherInfo = wmoToMapIconFunc(
    String(Math.round(Number(wmoCode) || 0)),
  );
  const summary = weatherInfo[1];
  const iconCode = weatherInfo[2] === "na" ? "03" : weatherInfo[2];

  return {
    summary,
    iconCode,
    iconUrl: openWeatherIconUrl(iconCode, isDay),
    meteoconUrl: meteoconUrl(iconCode, isDay),
  };
}
