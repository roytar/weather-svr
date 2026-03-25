import { fetchWeatherApi } from "openmeteo";
import { WeatherApiResponse } from "@openmeteo/sdk/weather-api-response.js";
import nodeGeocoder from "node-geocoder";
import { find } from "geo-tz/now";
import { wmoToOpenWeatherIcon } from "../utils.js";
import {
  WeatherData,
  GeocodeResult,
  WeatherResponse,
} from "../models/weather.js";

const geocoder = nodeGeocoder({
  provider: "openstreetmap",
  formatter: null,
});

// Helper function to form time ranges
const range = (start: number, stop: number, step: number) =>
  Array.from({ length: (stop - start) / step }, (_, i) => start + i * step);

export class WeatherService {
  async geocodeAddress(address: string): Promise<GeocodeResult> {
    try {
      const locations = await geocoder.geocode(address);

      if (locations.length === 0) {
        throw new Error(`No geocoding results for ${address}`);
      }

      const location = locations[0];
      return {
        latitude: location.latitude!,
        longitude: location.longitude!,
        formattedAddress: location.formattedAddress,
        country: location.country,
        city: location.city,
        state: location.state,
        zipcode: location.zipcode,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const wrappedError = new Error(
        `Geocoding failed for ${address}: ${errorMessage}`,
      ) as Error & { cause?: unknown };
      wrappedError.cause = err;
      throw wrappedError;
    }
  }

  async getWeatherData(
    latitude: number,
    longitude: number,
  ): Promise<WeatherData> {
    const tzTimezone = find(latitude, longitude);

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
    };

    const url = "https://api.open-meteo.com/v1/forecast";

    let responses: WeatherApiResponse[];
    try {
      responses = await fetchWeatherApi(url, params);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const wrappedError = new Error(
        `Weather API request failed: ${errorMessage}`,
      ) as Error & { cause?: unknown };
      wrappedError.cause = err;
      throw wrappedError;
    }

    const response = responses[0];
    const timezone = response.timezone();
    const current = response.current()!;
    const hourly = response.hourly()!;
    const daily = response.daily()!;

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
      },
      hourly: {
        time: range(
          Number(hourly.time()),
          Number(hourly.timeEnd()),
          hourly.interval(),
        ).map((t) => new Date(t * 1000)),
        temperature: hourly.variables(0)!.valuesArray()!,
        precipitation: hourly.variables(1)!.valuesArray()!,
        rain: hourly.variables(2)!.valuesArray()!,
        snowfall: hourly.variables(3)!.valuesArray()!,
        windSpeed: hourly.variables(4)!.valuesArray()!,
        windDirection: hourly.variables(5)!.valuesArray()!,
        weatherCode: hourly.variables(6)!.valuesArray()!,
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
      },
    };

    return weatherData;
  }

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
      })} ${dailyIcon.summary} icon: ${dailyIcon.iconCode} ${dailyIcon.iconUrl} ${Math.round(weatherData.daily.temperature_2m_max[i])} ${Math.round(weatherData.daily.temperature_2m_min[i])} ${Math.round(weatherData.daily.wind_speed_10m_max[i])} ${Math.round(weatherData.daily.wind_gusts_10m_max[i])}\n`;

      // Add hourly data for first few hours of each day
      for (
        let hour = i * 24;
        hour < Math.min(i * 24 + 6, weatherData.hourly.time.length);
        hour++
      ) {
        output += `  ${weatherData.hourly.time[hour].toLocaleString("en-US", {
          timeZone: timezone || "America/New_York",
          hour: "2-digit",
        })} ${Math.round(weatherData.hourly.temperature[hour])} ${Math.round(weatherData.hourly.precipitation[hour])}\n`;
      }
    }

    return output;
  }

  async getWeatherForAddress(address: string): Promise<WeatherResponse> {
    const location = await this.geocodeAddress(address);
    const weatherData = await this.getWeatherData(
      location.latitude,
      location.longitude,
    );

    // Get timezone from the weather response
    const tzTimezone = find(location.latitude, location.longitude);

    return {
      location,
      timezone: tzTimezone,
      weather: weatherData,
    };
  }
}
