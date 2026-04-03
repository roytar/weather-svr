import { fetchWeatherApi } from "openmeteo";
import nodeGeocoder from "node-geocoder";
import { find as tzFind } from "geo-tz/now";
import { wmoToOpenWeatherIcon } from "../utils.js";
const geocoder = nodeGeocoder({
    provider: "openstreetmap",
    formatter: null,
});
/**
 * Detects if the input string is only a zip code (US format: 5 or 5+4 digits).
 *
 * @param address The address string to check.
 * @returns True if the address appears to be only a zip code.
 */
function isZipCodeOnly(address) {
    const trimmed = address.trim();
    // Match 5-digit zip (12345) or 5+4 zip (12345-6789)
    return /^\d{5}(-\d{4})?$/.test(trimmed);
}
/**
 * Builds a numeric sequence from start to stop using a fixed interval.
 *
 * @param start Inclusive starting value.
 * @param stop Exclusive ending value.
 * @param step Increment between each value.
 * @returns Array of evenly spaced numeric values.
 */
const range = (start, stop, step) => Array.from({ length: (stop - start) / step }, (_, i) => start + i * step);
export class WeatherService {
    /**
     * Converts a free-form address (or zip code) into latitude/longitude and location metadata.
     * If only a zip code is provided, automatically looks up a street address within that zip code.
     *
     * @param address Human-readable address, place name, or zip code.
     * @returns Normalized geocoding result with coordinates and formatted fields.
     */
    async geocodeAddress(address) {
        try {
            const locations = await geocoder.geocode(address);
            if (locations.length === 0) {
                throw new Error(`No geocoding results for ${address}`);
            }
            let location = locations[0];
            const wasZipCodeOnly = isZipCodeOnly(address);
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
            return {
                latitude: location.latitude,
                longitude: location.longitude,
                formattedAddress: location.formattedAddress,
                country: location.country,
                city: location.city,
                state: location.state,
                zipcode: location.zipcode,
                wasZipCodeOnly,
            };
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            const wrappedError = new Error(`Geocoding failed for ${address}: ${errorMessage}`);
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
    async getWeatherData(latitude, longitude, options = {}) {
        const tzTimezone = tzFind(latitude, longitude);
        const params = {
            latitude: [latitude],
            longitude: [longitude],
            wind_speed_unit: "mph",
            temperature_unit: "fahrenheit",
            precipitation_unit: "inch",
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
            ],
            minutely_15: [
                "temperature_2m",
                "rain",
                "weather_code",
                "visibility",
                "sunshine_duration",
            ],
        };
        if (options.startDate && options.endDate) {
            params.start_date = options.startDate;
            params.end_date = options.endDate;
            options.forecastDays = 1;
        }
        else if (options.forecastDays && options.forecastDays > 0) {
            params.forecast_days =
                options.forecastDays;
        }
        const url = "https://api.open-meteo.com/v1/forecast";
        let responses;
        try {
            responses = await fetchWeatherApi(url, params);
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            const wrappedError = new Error(`Weather API request failed: ${errorMessage}`);
            wrappedError.cause = err;
            throw wrappedError;
        }
        const response = responses[0];
        const timezone = response.timezone();
        const current = response.current();
        const hourly = response.hourly();
        const daily = response.daily();
        const minutely15 = response.minutely15();
        // Define Int64 variables so they can be processed accordingly
        const sunrise = daily.variables(1);
        const sunset = daily.variables(2);
        // Process weather data
        const weatherData = {
            current: {
                time: new Date(Number(current.time()) * 1000),
                weather_code: current.variables(0).value(),
                wind_speed_10m: current.variables(1).value(),
                wind_direction_10m: current.variables(2).value(),
                temperature_2m: current.variables(3).value(),
                relative_humidity_2m: current.variables(4).value(),
                precipitation: current.variables(5).value(),
                rain: current.variables(6).value(),
                showers: current.variables(7).value(),
                snowfall: current.variables(8).value(),
            },
            hourly: {
                time: range(Number(hourly.time()), Number(hourly.timeEnd()), hourly.interval()).map((t) => new Date(t * 1000)),
                temperature: hourly.variables(0).valuesArray(),
                precipitation: hourly.variables(1).valuesArray(),
                rain: hourly.variables(2).valuesArray(),
                snowfall: hourly.variables(3).valuesArray(),
                windSpeed: hourly.variables(4).valuesArray(),
                windDirection: hourly.variables(5).valuesArray(),
                weatherCode: hourly.variables(6).valuesArray(),
            },
            daily: {
                time: Array.from({
                    length: (Number(daily.timeEnd()) - Number(daily.time())) /
                        daily.interval(),
                }, (_, i) => new Date((Number(daily.time()) + i * daily.interval()) * 1000)),
                apparent_temperature_max: daily.variables(0).valuesArray() || new Float32Array(),
                sunrise: [...Array(sunrise.valuesInt64Length())].map((_, i) => new Date(Number(sunrise.valuesInt64(i)) * 1000)),
                sunset: [...Array(sunset.valuesInt64Length())].map((_, i) => new Date(Number(sunset.valuesInt64(i)) * 1000)),
                weather_code: daily.variables(3).valuesArray() || new Float32Array(),
                temperature_2m_max: daily.variables(4).valuesArray(),
                temperature_2m_min: daily.variables(5).valuesArray(),
                wind_speed_10m_max: daily.variables(6).valuesArray(),
                wind_gusts_10m_max: daily.variables(7).valuesArray(),
            },
            minutely15: {
                time: Array.from({
                    length: (Number(minutely15.timeEnd()) - Number(minutely15.time())) /
                        minutely15.interval(),
                }, (_, i) => new Date((Number(minutely15.time()) + i * minutely15.interval()) * 1000)),
                temperature_2m: minutely15.variables(0).valuesArray(),
                rain: minutely15.variables(1).valuesArray(),
                weather_code: minutely15.variables(2).valuesArray(),
                visibility: minutely15.variables(3).valuesArray(),
                sunshine_duration: minutely15.variables(4).valuesArray(),
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
    formatWeatherOutput(location, weatherData, timezone) {
        let output = `Current weather lat=${location.latitude}, lon=${location.longitude} timezone=${timezone} fahrenheit:\n`;
        const currentDateKey = weatherData.current.time.toLocaleDateString("en-CA", {
            timeZone: timezone || "America/New_York",
        });
        const currentDayIndex = weatherData.daily.time.findIndex((day) => day.toLocaleDateString("en-CA", {
            timeZone: timezone || "America/New_York",
        }) === currentDateKey);
        const sunrise = currentDayIndex >= 0
            ? weatherData.daily.sunrise[currentDayIndex]
            : undefined;
        const sunset = currentDayIndex >= 0
            ? weatherData.daily.sunset[currentDayIndex]
            : undefined;
        const isDaytime = sunrise && sunset
            ? weatherData.current.time >= sunrise &&
                weatherData.current.time <= sunset
            : true;
        const currentIcon = wmoToOpenWeatherIcon(weatherData.current.weather_code, isDaytime);
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
            const dailyIcon = wmoToOpenWeatherIcon(weatherData.daily.weather_code?.[i] ?? 0, true);
            output += `${weatherData.daily.time[i].toLocaleString("en-US", {
                timeZone: timezone || "America/New_York",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
            })} ${dailyIcon.summary} icon: ${dailyIcon.iconCode} ${dailyIcon.iconUrl} ${Math.round(weatherData.daily.temperature_2m_max[i])} ${Math.round(weatherData.daily.temperature_2m_min[i])} ${Math.round(weatherData.daily.wind_speed_10m_max[i])} ${Math.round(weatherData.daily.wind_gusts_10m_max[i])}\n`;
            // Add hourly data for first few hours of each day
            for (let hour = i * 24; hour < Math.min(i * 24 + 6, weatherData.hourly.time.length); hour++) {
                output += `  ${weatherData.hourly.time[hour].toLocaleString("en-US", {
                    timeZone: timezone || "America/New_York",
                    hour: "2-digit",
                })} ${Math.round(weatherData.hourly.temperature[hour])} ${Math.round(weatherData.hourly.precipitation[hour])}\n`;
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
    async getWeatherForAddress(address, options = {}) {
        const location = await this.geocodeAddress(address);
        const weatherData = await this.getWeatherData(location.latitude, location.longitude, options);
        // Get timezone from the weather response
        const tzTimezone = tzFind(location.latitude, location.longitude);
        return {
            location,
            timezone: tzTimezone,
            weather: weatherData,
        };
    }
}
//# sourceMappingURL=weatherService.js.map