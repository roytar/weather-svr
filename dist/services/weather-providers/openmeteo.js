/**
 * Open-Meteo provider adapter.
 *
 * This module is provider-specific and is responsible only for:
 *   1. Translating app-level location and forecast options into Open-Meteo API
 *      request parameters.
 *   2. Calling the Open-Meteo API.
 *   3. Mapping the Open-Meteo response into the app's normalized WeatherData model.
 *
 * It does not perform geocoding, UI formatting, or business logic outside the
 * provider response translation boundary.
 *
 * Exports:
 *   - fetchWeatherData: the only public entry point for retrieving normalized
 *     weather payloads from Open-Meteo.
 */
import { fetchWeatherApi } from "openmeteo";
import { range } from "../../utils/index.js";
const API_URL = "https://api.open-meteo.com/v1/forecast";
const METERS_TO_FEET = 3.28084;
/**
 * Converts Open-Meteo precipitation values to the application unit system.
 *
 * @param unitSystem Unit system selected by the user.
 * @param value Raw precipitation value from Open-Meteo.
 * @returns Converted precipitation value for the app model.
 */
const convertPrecipValue = (unitSystem, value) => unitSystem === "metric" ? Number((value / 10).toFixed(3)) : value;
/**
 * Converts an Open-Meteo precipitation array to the app unit system.
 *
 * @param unitSystem Unit system selected by the user.
 * @param values Raw precipitation values from Open-Meteo.
 * @returns Converted precipitation array, or an empty array when missing.
 */
const convertPrecipArray = (unitSystem, values) => values
    ? Float32Array.from(values, (value) => unitSystem === "metric" ? Number((value / 10).toFixed(3)) : value)
    : new Float32Array();
/**
 * Converts an optional Open-Meteo precipitation array to the app unit system.
 *
 * @param unitSystem Unit system selected by the user.
 * @param values Raw precipitation values from Open-Meteo or null/undefined.
 * @returns Converted precipitation array or null when unavailable.
 */
const convertNullablePrecipArray = (unitSystem, values) => values
    ? Float32Array.from(values, (value) => unitSystem === "metric" ? Number((value / 10).toFixed(3)) : value)
    : null;
/**
 * Converts an Open-Meteo visibility array to the app unit system.
 *
 * @param unitSystem Unit system selected by the user.
 * @param values Raw visibility values from Open-Meteo.
 * @returns Converted visibility array or null when unavailable.
 */
const convertVisibilityArray = (unitSystem, values) => values
    ? Float32Array.from(values, (value) => unitSystem === "metric"
        ? value
        : Number((value * METERS_TO_FEET).toFixed(1)))
    : null;
/**
 * Fetch weather data from Open-Meteo and normalize it for the app.
 *
 * Inputs:
 *   - log: Optional Fastify logger used for request tracing and error reporting.
 *   - latitude: Decimal latitude coordinate for the requested location.
 *   - longitude: Decimal longitude coordinate for the requested location.
 *   - options: WeatherRangeOptions controlling:
 *       * temperatureUnit: "celsius" | "fahrenheit"
 *       * unitSystem: "metric" | "english"
 *       * includeMinutely15: whether to request 15-minute minutely data
 *       * boundingBox: optional latitude/longitude box to request multiple
 *         coordinates when the UI displays an area.
 *       * startDate/endDate or forecastDays to constrain the forecast range.
 *
 * Output:
 *   - Promise<WeatherData>: normalized weather payload containing:
 *       * current: current weather metrics at the requested location
 *       * hourly: arrays aligned by timestamp for hourly time series
 *       * daily: arrays aligned by date for daily summary values
 *       * minutely15: optional 15-minute arrays aligned by timestamp when
 *         `includeMinutely15` is enabled.
 *
 * Timezone handling:
 *   - The Open-Meteo response timezone is read from the provider response and
 *     can be used by the caller to interpret the returned timestamps.
 *   - Returned `Date` objects are built from the source timestamps, and the
 *     caller is responsible for displaying them in the desired timezone.
 *
 * The returned arrays are aligned by index, so `hourly.time[i]` corresponds
 * to the same point in time as `hourly.temperature[i]`, `hourly.rain[i]`,
 * and `hourly.precipitation_probability[i]`.
 *
 * All numeric values are converted into the app's expected units before
 * returning.
 */
export async function fetchWeatherData(log, latitude, longitude, options = {}) {
    log?.info({ latitude, longitude, options }, "fetching weather data from Open-Meteo");
    const temperatureUnit = options.temperatureUnit === "celsius" ? "celsius" : "fahrenheit";
    const unitSystem = options.unitSystem === "metric" ? "metric" : "english";
    const windSpeedUnit = unitSystem === "metric" ? "kmh" : "mph";
    const precipitationUnit = unitSystem === "metric" ? "mm" : "inch";
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
        timezone: "auto",
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
    const todayDate = new Date().toISOString().split("T")[0];
    const adjustedStartDate = options.startDate?.trim() || undefined;
    const adjustedEndDate = options.endDate?.trim() || undefined;
    if (adjustedStartDate || adjustedEndDate) {
        params.start_date = adjustedStartDate ?? todayDate;
        params.end_date = adjustedEndDate ?? todayDate;
    }
    else if (options.forecastDays && options.forecastDays > 0) {
        params.forecast_days =
            options.forecastDays;
    }
    let responses;
    try {
        responses = await fetchWeatherApi(API_URL, params);
    }
    catch (err) {
        log?.error({ latitude, longitude, options, err }, "open-meteo weather api request failed");
        const errorMessage = err instanceof Error ? err.message : String(err);
        const wrappedError = new Error(`Weather API request failed: ${errorMessage}`);
        wrappedError.cause = err;
        throw wrappedError;
    }
    if (!Array.isArray(responses) || responses.length === 0) {
        throw new Error("Open-Meteo returned no weather responses");
    }
    const response = responses[0];
    const timezone = response.timezone();
    log?.info({
        latitude,
        longitude,
        boundingBox: options.boundingBox,
        requestedCoordinateCount: responses.length,
        timezone,
        includeMinutely15: Boolean(options.includeMinutely15),
    }, "Open-Meteo weather data fetched");
    const current = response.current();
    const hourly = response.hourly();
    const daily = response.daily();
    const minutely15 = response.minutely15();
    const sunrise = daily.variables(1);
    const sunset = daily.variables(2);
    const weatherData = {
        current: {
            time: new Date(Number(current.time()) * 1000),
            weather_code: current.variables(0).value(),
            wind_speed_10m: current.variables(1).value(),
            wind_direction_10m: current.variables(2).value(),
            temperature_2m: current.variables(3).value(),
            relative_humidity_2m: current.variables(4).value(),
            precipitation: convertPrecipValue(unitSystem, current.variables(5).value()),
            rain: convertPrecipValue(unitSystem, current.variables(6).value()),
            showers: convertPrecipValue(unitSystem, current.variables(7).value()),
            snowfall: convertPrecipValue(unitSystem, current.variables(8).value()),
        },
        hourly: {
            time: range(Number(hourly.time()), Number(hourly.timeEnd()), hourly.interval()).map((t) => new Date(t * 1000)),
            temperature: hourly.variables(0).valuesArray(),
            precipitation: convertPrecipArray(unitSystem, hourly.variables(1).valuesArray()),
            rain: convertPrecipArray(unitSystem, hourly.variables(2).valuesArray()),
            snowfall: convertPrecipArray(unitSystem, hourly.variables(3).valuesArray()),
            windSpeed: hourly.variables(4).valuesArray(),
            windDirection: hourly.variables(5).valuesArray(),
            weatherCode: hourly.variables(6).valuesArray(),
            precipitation_probability: hourly.variables(7).valuesArray() || new Float32Array(),
        },
        daily: {
            time: Array.from({
                length: (Number(daily.timeEnd()) - Number(daily.time())) / daily.interval(),
            }, (_, i) => new Date((Number(daily.time()) + i * daily.interval()) * 1000)),
            apparent_temperature_max: daily.variables(0).valuesArray() || new Float32Array(),
            sunrise: [...Array(sunrise.valuesInt64Length())].map((_, i) => new Date(Number(sunrise.valuesInt64(i)) * 1000)),
            sunset: [...Array(sunset.valuesInt64Length())].map((_, i) => new Date(Number(sunset.valuesInt64(i)) * 1000)),
            weather_code: daily.variables(3).valuesArray() || new Float32Array(),
            temperature_2m_max: daily.variables(4).valuesArray(),
            temperature_2m_min: daily.variables(5).valuesArray(),
            wind_speed_10m_max: daily.variables(6).valuesArray(),
            wind_gusts_10m_max: daily.variables(7).valuesArray(),
            precipitation_probability_max: daily.variables(8).valuesArray() || new Float32Array(),
        },
        minutely15: minutely15
            ? {
                time: Array.from({
                    length: (Number(minutely15.timeEnd()) - Number(minutely15.time())) /
                        minutely15.interval(),
                }, (_, i) => new Date((Number(minutely15.time()) + i * minutely15.interval()) * 1000)),
                temperature_2m: minutely15.variables(0)?.valuesArray() ?? null,
                rain: convertNullablePrecipArray(unitSystem, minutely15.variables(1)?.valuesArray()),
                weather_code: minutely15.variables(2)?.valuesArray() ?? null,
                visibility: convertVisibilityArray(unitSystem, minutely15.variables(3)?.valuesArray()),
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
//# sourceMappingURL=openmeteo.js.map