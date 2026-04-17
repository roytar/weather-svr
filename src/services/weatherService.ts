import type { FastifyBaseLogger } from "fastify";
import nodeGeocoder from "node-geocoder";
import { find as tzFind } from "geo-tz/dist/find-now";
import {
  parseBoundingBoxInput,
  parseLatLonInput,
  wmoToOpenWeatherIcon,
} from "../utils/index.js";
import {
  WeatherData,
  GeocodeResult,
  WeatherResponse,
} from "../models/weather.js";

const geocoder = nodeGeocoder({
  provider: "openstreetmap",
  formatter: null,
});

type TemperatureUnit = "fahrenheit" | "celsius";
type UnitSystem = "english" | "metric";

export type WeatherRangeOptions = {
  forecastDays?: number;
  startDate?: string;
  endDate?: string;
  temperatureUnit?: TemperatureUnit;
  unitSystem?: UnitSystem;
  includeMinutely15?: boolean;
  boundingBox?: {
    lowerLeft: { latitude: number; longitude: number };
    upperRight: { latitude: number; longitude: number };
    center: { latitude: number; longitude: number };
  };
};

/**
 * Detects if the input string is only a zip code (US format: 5 or 5+4 digits).
 *
 * @param address The address string to check.
 * @returns True if the address appears to be only a zip code.
 */
function isZipCodeOnly(address: string): boolean {
  const trimmed = address.trim();
  // Match 5-digit zip (12345) or 5+4 zip (12345-6789)
  return /^\d{5}(-\d{4})?$/.test(trimmed);
}

function hasStreetAddressInput(address: string): boolean {
  return /^\d+[A-Za-z0-9\-/]*\s+.+$/.test(address.trim());
}

/**
 * Builds a numeric sequence from start to stop using a fixed interval.
 *
 * @param start Inclusive starting value.
 * @param stop Exclusive ending value.
 * @param step Increment between each value.
 * @returns Array of evenly spaced numeric values.
 */
export class WeatherService {
  private readonly providerPromise: Promise<{
    fetchWeatherData(
      log: FastifyBaseLogger | undefined,
      latitude: number,
      longitude: number,
      options: WeatherRangeOptions,
    ): Promise<WeatherData>;
  }>;

  constructor(private readonly log?: FastifyBaseLogger) {
    const providerName = process.env.WEATHER_PROVIDER?.trim() || "openmeteo";
    const normalizedProviderName = providerName || "openmeteo";

    if (!/^[a-zA-Z0-9_-]+$/.test(normalizedProviderName)) {
      throw new Error(
        `Invalid weather provider name: ${normalizedProviderName}`,
      );
    }

    const providerPath = `./weather-providers/${normalizedProviderName}.js`;
    this.providerPromise = import(providerPath) as Promise<{
      fetchWeatherData(
        log: FastifyBaseLogger | undefined,
        latitude: number,
        longitude: number,
        options: WeatherRangeOptions,
      ): Promise<WeatherData>;
    }>;

    this.log?.info(
      { provider: normalizedProviderName, providerPath },
      "initialized weather provider",
    );
  }

  /**
   * Converts a free-form address, ZIP code, `lat, lon`, or bounding-box input into coordinates and location metadata.
   * If only a zip code is provided, automatically looks up a street address within that zip code.
   *
   * @param address Human-readable address, place name, ZIP code, coordinates, or bounding-box JSON.
   * @returns Normalized geocoding result with coordinates and formatted fields.
   */
  async geocodeAddress(address: string): Promise<GeocodeResult> {
    this.log?.info({ address }, "geocoding address");

    try {
      const wasZipCodeOnly = isZipCodeOnly(address);
      const parsedBoundingBox = parseBoundingBoxInput(address);
      const parsedLatLon =
        parsedBoundingBox?.center ?? parseLatLonInput(address);
      const inputHasStreetAddress =
        !parsedLatLon && !parsedBoundingBox && hasStreetAddressInput(address);

      let location;
      let reverseResults;

      if (parsedBoundingBox) {
        this.log?.info(
          {
            address,
            lowerLeft: parsedBoundingBox.lowerLeft,
            upperRight: parsedBoundingBox.upperRight,
            center: parsedBoundingBox.center,
          },
          "reverse geocoding bounding box center",
        );

        reverseResults = await geocoder.reverse({
          lat: parsedBoundingBox.center.latitude,
          lon: parsedBoundingBox.center.longitude,
        });

        if (!Array.isArray(reverseResults)) {
          throw new Error(
            "Bounding-box reverse geocoding returned invalid response",
          );
        }

        location = reverseResults[0];
        if (!location?.latitude || !location?.longitude) {
          this.log?.warn(
            {
              address,
              reverseResults,
              fallbackLatitude: parsedBoundingBox.center.latitude,
              fallbackLongitude: parsedBoundingBox.center.longitude,
            },
            "bounding box reverse geocode returned no usable location; using center coordinates",
          );
          location = {
            latitude: parsedBoundingBox.center.latitude,
            longitude: parsedBoundingBox.center.longitude,
            formattedAddress: "Selected bounding box",
          };
        }
      } else if (parsedLatLon) {
        this.log?.info(
          { address, ...parsedLatLon },
          "reverse geocoding coordinates",
        );

        reverseResults = await geocoder.reverse({
          lat: parsedLatLon.latitude,
          lon: parsedLatLon.longitude,
        });

        if (!Array.isArray(reverseResults)) {
          throw new Error(
            "Coordinate reverse geocoding returned invalid response",
          );
        }

        location = reverseResults[0];
        if (!location?.latitude || !location?.longitude) {
          this.log?.warn(
            {
              address,
              reverseResults,
              fallbackLatitude: parsedLatLon.latitude,
              fallbackLongitude: parsedLatLon.longitude,
            },
            "coordinate reverse geocode returned no usable location; using input coordinates",
          );
          location = {
            latitude: parsedLatLon.latitude,
            longitude: parsedLatLon.longitude,
            formattedAddress: `${parsedLatLon.latitude}, ${parsedLatLon.longitude}`,
          };
        }
      } else {
        const locations = await geocoder.geocode(address);

        if (!Array.isArray(locations) || locations.length === 0) {
          throw new Error(`No geocoding results for ${address}`);
        }

        location = locations[0];
        if (!location?.latitude || !location?.longitude) {
          this.log?.error(
            { address, locations },
            "geocode lookup returned invalid coordinates",
          );
          throw new Error(
            `Geocode lookup returned invalid coordinates for ${address}`,
          );
        }

        // If input was only a zip code, reverse-geocode the result to find a street address
        if (wasZipCodeOnly && location.latitude && location.longitude) {
          const zipReverseResults = await geocoder.reverse({
            lat: location.latitude,
            lon: location.longitude,
          });

          if (!Array.isArray(zipReverseResults)) {
            this.log?.warn(
              {
                address,
                latitude: location.latitude,
                longitude: location.longitude,
                zipReverseResults,
              },
              "zip-code reverse geocode returned invalid response",
            );
          } else if (zipReverseResults.length > 0) {
            const zipLocation = zipReverseResults[0];
            if (zipLocation?.latitude && zipLocation?.longitude) {
              location = zipLocation;
            } else {
              this.log?.warn(
                {
                  address,
                  zipReverseResults,
                },
                "zip-code reverse geocode returned no usable street address",
              );
            }
          } else {
            this.log?.warn(
              {
                address,
                latitude: location.latitude,
                longitude: location.longitude,
              },
              "zip-code reverse geocode returned no results",
            );
          }
        }
      }

      const geocodeResult = {
        latitude: parsedLatLon?.latitude ?? location.latitude!,
        longitude: parsedLatLon?.longitude ?? location.longitude!,
        formattedAddress: location.formattedAddress,
        streetName: location.streetName,
        streetNumber: location.streetNumber,
        country: location.country,
        city: location.city,
        state: location.state,
        zipcode: location.zipcode,
        wasZipCodeOnly,
        inputHasStreetAddress,
        boundingBox: parsedBoundingBox ?? undefined,
      };

      this.log?.info(
        {
          address,
          latitude: geocodeResult.latitude,
          longitude: geocodeResult.longitude,
        },
        "geocoding complete",
      );

      return geocodeResult;
    } catch (err) {
      this.log?.error({ address, err }, "geocoding failed");
      const errorMessage = err instanceof Error ? err.message : String(err);
      const wrappedError = new Error(
        `Geocoding failed for ${address}: ${errorMessage}`,
      ) as Error & { cause?: unknown };
      wrappedError.cause = err;
      throw wrappedError;
    }
  }

  /**
   * Retrieves weather data from the configured provider for a set of coordinates.
   *
   * @param latitude Latitude coordinate in decimal degrees.
   * @param longitude Longitude coordinate in decimal degrees.
   * @param options Optional forecast-days or explicit date-range controls.
   * @returns Current, hourly, and daily weather data mapped to the app model.
   */
  async getWeatherData(
    latitude: number,
    longitude: number,
    options: WeatherRangeOptions = {},
  ): Promise<WeatherData> {
    this.log?.info({ latitude, longitude, options }, "fetching weather data");

    const provider = await this.providerPromise;
    return provider.fetchWeatherData(this.log, latitude, longitude, options);
  }

  /**
   * Formats weather data as a text report suitable for CLI-style output.
   *
   * @param location Geocoded location used for header metadata.
   * @param weatherData Structured weather payload to render.
   * @param timezone IANA timezone used when formatting date and time values.
   * @returns Multi-line weather summary string.
   */
  formatWeatherOutput(
    location: GeocodeResult,
    weatherData: WeatherData,
    timezone: string,
  ): string {
    let output = `Current weather lat=${location.latitude}, lon=${location.longitude} timezone=${timezone} fahrenheit:\n`;

    const currentDateKey = weatherData.current.time.toLocaleDateString(
      "en-CA",
      {
        timeZone: timezone || "America/New_York",
      },
    );
    const currentDayIndex = weatherData.daily.time.findIndex(
      (day) =>
        day.toLocaleDateString("en-CA", {
          timeZone: timezone || "America/New_York",
        }) === currentDateKey,
    );
    const sunrise =
      currentDayIndex >= 0
        ? weatherData.daily.sunrise[currentDayIndex]
        : undefined;
    const sunset =
      currentDayIndex >= 0
        ? weatherData.daily.sunset[currentDayIndex]
        : undefined;
    const isDaytime =
      sunrise && sunset
        ? weatherData.current.time >= sunrise &&
          weatherData.current.time <= sunset
        : true;

    const currentIcon = wmoToOpenWeatherIcon(
      weatherData.current.weather_code,
      isDaytime,
    );
    output += `${weatherData.current.time.toLocaleString("en-US", {
      timeZone: timezone || "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })} ${currentIcon.summary} icon: ${currentIcon.iconCode} ${currentIcon.iconUrl} ${Math.round(weatherData.current.temperature_2m)} wind speed: ${Math.round(weatherData.current.wind_speed_10m)} wind direction: ${Math.round(weatherData.current.wind_direction_10m)}\n`;

    for (let i = 0; i < weatherData.daily.time.length; i++) {
      const dailyIcon = wmoToOpenWeatherIcon(
        weatherData.daily.weather_code?.[i] ?? 0,
        true,
      );
      output += `${weatherData.daily.time[i].toLocaleString("en-US", {
        timeZone: timezone || "America/New_York",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })} ${dailyIcon.summary} icon: ${dailyIcon.iconCode} ${dailyIcon.iconUrl} ${Math.round(weatherData.daily.temperature_2m_max[i])} ${Math.round(weatherData.daily.temperature_2m_min[i])} ${Math.round(weatherData.daily.wind_speed_10m_max[i])} ${Math.round(weatherData.daily.wind_gusts_10m_max[i])} precip%: ${Math.round(weatherData.daily.precipitation_probability_max[i] ?? 0)}\n`;

      // Add hourly data for the full 24-hour day.
      for (
        let hour = i * 24;
        hour < Math.min(i * 24 + 24, weatherData.hourly.time.length);
        hour++
      ) {
        output += `  ${weatherData.hourly.time[hour].toLocaleString("en-US", {
          timeZone: timezone || "America/New_York",
          hour: "2-digit",
        })} ${Math.round(weatherData.hourly.temperature[hour])} ${Math.round(weatherData.hourly.precipitation[hour])} precip%: ${Math.round(weatherData.hourly.precipitation_probability[hour] ?? 0)}\n`;
      }
    }

    return output;
  }

  /**
   * Resolves a free-form address and returns weather data for that location.
   *
   * @param address Human-readable location input (e.g., city, state, zip).
   * @param options Optional date range or forecast window controls.
   * @returns Weather payload including resolved location and timezone metadata.
   */
  async getWeatherForAddress(
    address: string,
    options: WeatherRangeOptions = {},
  ): Promise<WeatherResponse> {
    this.log?.info({ address, options }, "resolving weather for address");

    const location = await this.geocodeAddress(address);
    const weatherData = await this.getWeatherData(
      location.latitude,
      location.longitude,
      {
        ...options,
        boundingBox: location.boundingBox,
      },
    );

    // Get timezone from the weather response
    const tzTimezone = tzFind(location.latitude, location.longitude);

    this.log?.info(
      {
        address,
        latitude: location.latitude,
        longitude: location.longitude,
        timezone: tzTimezone,
      },
      "resolved weather for address",
    );

    return {
      location,
      timezone: tzTimezone,
      weather: weatherData,
    };
  }
}
