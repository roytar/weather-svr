export interface WeatherData {
  current: {
    time: Date;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    temperature_2m: number;
    relative_humidity_2m: number;
    precipitation: number;
    rain: number;
    showers: number;
    snowfall: number;
  };
  hourly: {
    time: Date[];
    temperature: Float32Array;
    precipitation: Float32Array;
    rain: Float32Array;
    snowfall: Float32Array;
    windSpeed: Float32Array;
    windDirection: Float32Array;
    weatherCode: Float32Array;
    precipitation_probability: Float32Array;
  };
  daily: {
    time: Date[];
    apparent_temperature_max: Float32Array | null;
    sunrise: Date[];
    sunset: Date[];
    weather_code: Float32Array | null;
    temperature_2m_max: Float32Array;
    temperature_2m_min: Float32Array;
    wind_speed_10m_max: Float32Array;
    wind_gusts_10m_max: Float32Array;
    precipitation_probability_max: Float32Array;
  };
  minutely15: {
    time: Date[];
    temperature_2m: Float32Array | null;
    rain: Float32Array | null;
    weather_code: Float32Array | null;
    visibility: Float32Array | null;
    sunshine_duration: Float32Array | null;
  };
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress?: string;
  streetName?: string;
  streetNumber?: string;
  country?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  wasZipCodeOnly?: boolean;
  inputHasStreetAddress?: boolean;
}

export interface WeatherResponse {
  location: GeocodeResult;
  timezone: string | string[];
  weather: WeatherData;
}
