import { fetchWeatherApi } from "openmeteo";
import { WeatherApiResponse } from "@openmeteo/sdk/weather-api-response.js";
import { FastifyBaseLogger } from "fastify";
import nodeGeocoder from "node-geocoder";
import { find as tzFind } from "geo-tz/now";
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

type WeatherRangeOptions = {
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
const range = (start: number, stop: number, step: number) =>
  Array.from({ length: (stop - start) / step }, (_, i) => start + i * step);

export class WeatherService {
  constructor(private readonly log?: FastifyBaseLogger) {}

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

        const reverseResults = await geocoder.reverse({
          lat: parsedBoundingBox.center.latitude,
          lon: parsedBoundingBox.center.longitude,
        });

        location = reverseResults[0] ?? {
          latitude: parsedBoundingBox.center.latitude,
          longitude: parsedBoundingBox.center.longitude,
          formattedAddress: "Selected bounding box",
        };
      } else if (parsedLatLon) {
        this.log?.info(
          { address, ...parsedLatLon },
          "reverse geocoding coordinates",
        );

        const reverseResults = await geocoder.reverse({
          lat: parsedLatLon.latitude,
          lon: parsedLatLon.longitude,
        });

        location = reverseResults[0] ?? {
          latitude: parsedLatLon.latitude,
          longitude: parsedLatLon.longitude,
          formattedAddress: `${parsedLatLon.latitude}, ${parsedLatLon.longitude}`,
        };
      } else {
        const locations = await geocoder.geocode(address);

        if (locations.length === 0) {
          throw new Error(`No geocoding results for ${address}`);
        }

        location = locations[0];

        // If input was only a zip code, reverse-geocode the result to find a street address
        if (wasZipCodeOnly && location.latitude && location.longitude) {
          const reverseResults = await geocoder.reverse({
            lat: location.latitude,
            lon: location.longitude,
          });

          if (reverseResults.length > 0) {
            // Use the first street address from reverse geocoding
            location = reverseResults[0];
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
   * Retrieves weather data from Open-Meteo for a set of coordinates.
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

    const tzTimezone = tzFind(latitude, longitude);
    const temperatureUnit =
      options.temperatureUnit === "celsius" ? "celsius" : "fahrenheit";
    const unitSystem = options.unitSystem === "metric" ? "metric" : "english";
    const windSpeedUnit = unitSystem === "metric" ? "kmh" : "mph";
    const precipitationUnit = unitSystem === "metric" ? "mm" : "inch";

    const convertPrecipValue = (value: number): number =>
      unitSystem === "metric" ? Number((value / 10).toFixed(3)) : value;

    const convertPrecipArray = (
      values: Float32Array | null | undefined,
    ): Float32Array =>
      values
        ? Float32Array.from(values, (value) =>
            unitSystem === "metric" ? Number((value / 10).toFixed(3)) : value,
          )
        : new Float32Array();

    const convertNullablePrecipArray = (
      values: Float32Array | null | undefined,
    ): Float32Array | null =>
      values
        ? Float32Array.from(values, (value) =>
            unitSystem === "metric" ? Number((value / 10).toFixed(3)) : value,
          )
        : null;

    const convertVisibilityArray = (
      values: Float32Array | null | undefined,
    ): Float32Array | null =>
      values
        ? Float32Array.from(values, (value) =>
            unitSystem === "metric"
              ? value
              : Number((value * 3.28084).toFixed(1)),
          )
        : null;

    const latitudeValues = options.boundingBox
      ? [
          latitude,
          options.boundingBox.lowerLeft.latitude,
          options.boundingBox.upperRight.latitude,
        ]
      : [latitude];
    const longitudeValues = options.boundingBox
      ? [
          longitude,
          options.boundingBox.lowerLeft.longitude,
          options.boundingBox.upperRight.longitude,
        ]
      : [longitude];

    const params = {
      latitude: latitudeValues,
      longitude: longitudeValues,
      wind_speed_unit: windSpeedUnit,
      temperature_unit: temperatureUnit,
      precipitation_unit: precipitationUnit,
      timezone: tzTimezone,
      current: [
        "weather_code",
        "wind_speed_10m",
        "wind_direction_10m",
        "temperature_2m",
        "relative_humidity_2m",
        "precipitation",
        "rain",
        "showers",
        "snowfall",
      ],
      hourly: [
        "temperature_2m",
        "precipitation",
        "rain",
        "snowfall",
        "wind_speed_10m",
        "wind_direction_10m",
        "weather_code",
        "precipitation_probability",
      ],
      daily: [
        "apparent_temperature_max",
        "sunrise",
        "sunset",
        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min",
        "wind_speed_10m_max",
        "wind_gusts_10m_max",
        "precipitation_probability_max",
      ],
    } as {
      latitude: number[];
      longitude: number[];
      wind_speed_unit: string;
      temperature_unit: string;
      precipitation_unit: string;
      timezone: string | string[];
      current: string[];
      hourly: string[];
      daily: string[];
      minutely_15?: string[];
      start_date?: string;
      end_date?: string;
      forecast_days?: number;
    };

    if (options.includeMinutely15) {
      params.minutely_15 = [
        "temperature_2m",
        "rain",
        "weather_code",
        "visibility",
        "sunshine_duration",
      ];
    }

    if (options.startDate && options.endDate) {
      (
        params as typeof params & { start_date: string; end_date: string }
      ).start_date = options.startDate;
      (
        params as typeof params & { start_date: string; end_date: string }
      ).end_date = options.endDate;
      options.forecastDays = 1;
    } else if (options.forecastDays && options.forecastDays > 0) {
      (params as typeof params & { forecast_days: number }).forecast_days =
        options.forecastDays;
    }

    const url = "https://api.open-meteo.com/v1/forecast";

    let responses: WeatherApiResponse[];
    try {
      responses = await fetchWeatherApi(url, params);
    } catch (err) {
      this.log?.error(
        { latitude, longitude, options, err },
        "weather api request failed",
      );
      const errorMessage = err instanceof Error ? err.message : String(err);
      const wrappedError = new Error(
        `Weather API request failed: ${errorMessage}`,
      ) as Error & { cause?: unknown };
      wrappedError.cause = err;
      throw wrappedError;
    }

    const response = responses[0];
    const timezone = response.timezone();
    this.log?.info(
      {
        latitude,
        longitude,
        boundingBox: options.boundingBox,
        requestedCoordinateCount: responses.length,
        timezone,
        includeMinutely15: Boolean(options.includeMinutely15),
      },
      "weather data fetched",
    );
    const current = response.current()!;
    const hourly = response.hourly()!;
    const daily = response.daily()!;
    const minutely15 = response.minutely15();

    // Define Int64 variables so they can be processed accordingly
    const sunrise = daily.variables(1)!;
    const sunset = daily.variables(2)!;

    // Process weather data
    const weatherData: WeatherData = {
      current: {
        time: new Date(Number(current.time()) * 1000),
        weather_code: current.variables(0)!.value(),
        wind_speed_10m: current.variables(1)!.value(),
        wind_direction_10m: current.variables(2)!.value(),
        temperature_2m: current.variables(3)!.value(),
        relative_humidity_2m: current.variables(4)!.value(),
        precipitation: convertPrecipValue(current.variables(5)!.value()),
        rain: convertPrecipValue(current.variables(6)!.value()),
        showers: convertPrecipValue(current.variables(7)!.value()),
        snowfall: convertPrecipValue(current.variables(8)!.value()),
      },
      hourly: {
        time: range(
          Number(hourly.time()),
          Number(hourly.timeEnd()),
          hourly.interval(),
        ).map((t) => new Date(t * 1000)),
        temperature: hourly.variables(0)!.valuesArray()!,
        precipitation: convertPrecipArray(hourly.variables(1)!.valuesArray()),
        rain: convertPrecipArray(hourly.variables(2)!.valuesArray()),
        snowfall: convertPrecipArray(hourly.variables(3)!.valuesArray()),
        windSpeed: hourly.variables(4)!.valuesArray()!,
        windDirection: hourly.variables(5)!.valuesArray()!,
        weatherCode: hourly.variables(6)!.valuesArray()!,
        precipitation_probability:
          hourly.variables(7)!.valuesArray() || new Float32Array(),
      },
      daily: {
        time: Array.from(
          {
            length:
              (Number(daily.timeEnd()) - Number(daily.time())) /
              daily.interval(),
          },
          (_, i) =>
            new Date((Number(daily.time()) + i * daily.interval()) * 1000),
        ),
        apparent_temperature_max:
          daily.variables(0)!.valuesArray() || new Float32Array(),
        sunrise: [...Array(sunrise.valuesInt64Length())].map(
          (_, i) => new Date(Number(sunrise.valuesInt64(i)) * 1000),
        ),
        sunset: [...Array(sunset.valuesInt64Length())].map(
          (_, i) => new Date(Number(sunset.valuesInt64(i)) * 1000),
        ),
        weather_code: daily.variables(3)!.valuesArray() || new Float32Array(),
        temperature_2m_max: daily.variables(4)!.valuesArray()!,
        temperature_2m_min: daily.variables(5)!.valuesArray()!,
        wind_speed_10m_max: daily.variables(6)!.valuesArray()!,
        wind_gusts_10m_max: daily.variables(7)!.valuesArray()!,
        precipitation_probability_max:
          daily.variables(8)!.valuesArray() || new Float32Array(),
      },
      minutely15: minutely15
        ? {
            time: Array.from(
              {
                length:
                  (Number(minutely15.timeEnd()) - Number(minutely15.time())) /
                  minutely15.interval(),
              },
              (_, i) =>
                new Date(
                  (Number(minutely15.time()) + i * minutely15.interval()) *
                    1000,
                ),
            ),
            temperature_2m: minutely15.variables(0)?.valuesArray() ?? null,
            rain: convertNullablePrecipArray(
              minutely15.variables(1)?.valuesArray(),
            ),
            weather_code: minutely15.variables(2)?.valuesArray() ?? null,
            visibility: convertVisibilityArray(
              minutely15.variables(3)?.valuesArray(),
            ),
            sunshine_duration: minutely15.variables(4)?.valuesArray() ?? null,
          }
        : {
            time: [],
            temperature_2m: null,
            rain: null,
            weather_code: null,
            visibility: null,
            sunshine_duration: null,
          },
    };

    return weatherData;
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
