import { fetchWeatherApi } from "openmeteo";
import { WeatherApiResponse } from "@openmeteo/sdk/weather-api-response.js";

import nodeGeocoder from "node-geocoder";
import { find } from "geo-tz/now";
import { wmoToMapIconFunc } from "./utils.js";

const geocoder = nodeGeocoder({
  provider: "openstreetmap",
  formatter: null,
});
let latitude: number = Number(0),
  longitude: number = Number(0);

const streetAddress = "48 Darrow Street 08882";
try {
  const locations = await geocoder.geocode(streetAddress);
  console.log(locations);
  // [
  //   {
  //     formattedAddress: '135, Pilkington Avenue, Maney, Sutton Coldfield, Wylde Green, Birmingham, West Midlands Combined Authority, West Midlands, England, B72 1LH, United Kingdom',
  //     latitude: 52.5487921,
  //     longitude: -1.8164308339635031,
  //     country: 'United Kingdom',
  //     countryCode: 'GB',
  //     state: 'England',
  //     county: 'West Midlands Combined Authority',
  //     city: 'Birmingham',
  //     zipcode: 'B72 1LH',
  //     district: 'West Midlands',
  //     streetName: 'Pilkington Avenue',
  //     streetNumber: '135',
  //     neighbourhood: undefined,
  //     extra: {
  //       id: 90394480,
  //       confidence: 0.411,
  //       bbox: [ -1.816513, 52.5487473, -1.8163464, 52.5488481 ]
  //     }
  //   }
  // ]
  if (locations.length === 0) {
    console.error("No geocoding results for " + streetAddress);
    process.exit(0);
  }
  latitude = locations[0].latitude!;
  longitude = locations[0].longitude!;
} catch (err) {
  console.error("Geocoding failed " + streetAddress + ":", err);
  process.exit(0);
}

const tzTimezone = find(latitude, longitude);

console.log("Fetching weather data 1...");

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
  ],
  hourly: "temperature_2m,precipitation,wind_speed_10m",
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
  console.error("Weather API request failed:", err);
  process.exit(0);
}

// Helper function to form time ranges
const range = (start: number, stop: number, step: number) =>
  Array.from({ length: (stop - start) / step }, (_, i) => start + i * step);

// Process first location. Add a for-loop for multiple locations or weather models
const response = responses[0];

// Attributes for timezone and location
const utcOffsetSeconds = response.utcOffsetSeconds();
const timezone = response.timezone();
const timezoneAbbreviation = response.timezoneAbbreviation();
latitude = response.latitude();
longitude = response.longitude();

const current = response.current()!;
const hourly = response.hourly()!;
const daily = response.daily()!;
// Define Int64 variables so they can be processed accordingly
const sunrise = daily.variables(1)!;
const sunset = daily.variables(2)!;

// Note: The order of weather variables in the URL query and the indices below need to match!
const weatherData = {
  current: {
    time: new Date(Number(current.time()) * 1000), // Times are already in requested timezone
    weather_code: current.variables(0)!.value(),
    wind_speed_10m: current.variables(1)!.value(),
    wind_direction_10m: current.variables(2)!.value(),
    temperature_2m: current.variables(3)!.value(),
  },
  hourly: {
    time: range(
      Number(hourly.time()),
      Number(hourly.timeEnd()),
      hourly.interval(),
    ).map((t) => new Date(t * 1000)), // Times are already in requested timezone
    temperature: hourly.variables(0)!.valuesArray()!, // `.valuesArray()` get an array of floats
    precipitation: hourly.variables(1)!.valuesArray()!,
    windSpeed: hourly.variables(2)!.valuesArray()!,
  },
  daily: {
    time: Array.from(
      {
        length:
          (Number(daily.timeEnd()) - Number(daily.time())) / daily.interval(),
      },
      (_, i) => new Date((Number(daily.time()) + i * daily.interval()) * 1000),
    ),
    apparent_temperature_max: daily.variables(0)!.valuesArray(),
    // Map Int64 values to according structure
    sunrise: [...Array(sunrise.valuesInt64Length())].map(
      (_, i) => new Date(Number(sunrise.valuesInt64(i)) * 1000),
    ),
    // Map Int64 values to according structure
    sunset: [...Array(sunset.valuesInt64Length())].map(
      (_, i) => new Date(Number(sunset.valuesInt64(i)) * 1000),
    ),
    weather_code: daily.variables(3)!.valuesArray(),
    temperature_2m_max: daily.variables(4)!.valuesArray()!,
    temperature_2m_min: daily.variables(5)!.valuesArray()!,
    wind_speed_10m_max: daily.variables(6)!.valuesArray()!,
    wind_gusts_10m_max: daily.variables(7)!.valuesArray()!,
  },
};

// `weatherData` now contains a simple structure with arrays for datetime and weather data
console.log(
  "Current weather lat=" +
    latitude +
    ", lon=" +
    longitude +
    " timezone=" +
    timezone +
    " " +
    params.temperature_unit +
    " :",
);

const wcDesc = wmoToMapIconFunc(weatherData.current.weather_code.toString());
console.log(
  weatherData.current.time.toLocaleString("en-US", {
    timeZone: timezone || "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }),
  wcDesc[0],
  Math.round(weatherData.current.temperature_2m),
  "wind speed: " + Math.round(weatherData.current.wind_speed_10m),
  "wind direction: " + Math.round(weatherData.current.wind_direction_10m),
);

for (let i = 0; i < weatherData.daily.time.length; i++) {
  const wcDesc = wmoToMapIconFunc(weatherData.current.weather_code.toString());
  console.log(
    weatherData.daily.time[i].toLocaleString("en-US", {
      timeZone: timezone || "America/New_York",
      // year: "numeric",
      // month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    wcDesc[0],
    Math.round(weatherData.daily.temperature_2m_max[i]),
    Math.round(weatherData.daily.temperature_2m_min[i]),
    Math.round(weatherData.daily.wind_speed_10m_max[i]),
    Math.round(weatherData.daily.wind_gusts_10m_max[i]),
  );

  for (let hour = i * 24; hour < i * 24 + 24; hour++) {
    console.log(
      " \t " +
        weatherData.hourly.time[hour].toLocaleString("en-US", {
          timeZone: timezone || "America/New_York",
          hour: "2-digit",
        }),
      Math.round(weatherData.hourly.temperature[hour]),
      Math.round(weatherData.hourly.precipitation[hour]),
    );
  }
}
