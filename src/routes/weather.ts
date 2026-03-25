import { FastifyInstance } from "fastify";
import { WeatherService } from "../services/weatherService.js";
import { wmoToOpenWeatherIcon } from "../utils.js";

const weatherService = new WeatherService();

function degreesToCardinal(degrees: number): string {
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

function dateKeyInTimeZone(date: Date, timeZone: string): string {
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

function hourKeyInTimeZone(date: Date, timeZone: string): string {
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

export async function weatherRoutes(fastify: FastifyInstance) {
  // GET /weather?address=<address>
  fastify.get(
    "/weather",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            address: { type: "string" },
          },
          required: ["address"],
        },
      },
    },
    async (request, reply) => {
      const { address } = request.query as { address: string };

      try {
        const result = await weatherService.getWeatherForAddress(address);
        const timezone = Array.isArray(result.timezone)
          ? result.timezone[0]
          : result.timezone;
        const now = new Date();
        const todayKey = dateKeyInTimeZone(now, timezone);
        const dailyIndex = result.weather.daily.time.findIndex(
          (day) => dateKeyInTimeZone(day, timezone) === todayKey,
        );
        const selectedDayIndex = dailyIndex >= 0 ? dailyIndex : 0;
        const sunrise = result.weather.daily.sunrise[selectedDayIndex];
        const sunset = result.weather.daily.sunset[selectedDayIndex];
        const isDaytimeNow =
          sunrise && sunset ? now >= sunrise && now <= sunset : true;
        const currentIcon = wmoToOpenWeatherIcon(
          result.weather.current.weather_code,
          isDaytimeNow,
        );

        const dailyIcons = result.weather.daily.time.map((dayDate, index) => {
          const dayKey = dateKeyInTimeZone(dayDate, timezone);
          const isToday = dayKey === todayKey;
          const daySunrise = result.weather.daily.sunrise[index];
          const daySunset = result.weather.daily.sunset[index];
          const isDaytime =
            isToday && daySunrise && daySunset
              ? now >= daySunrise && now <= daySunset
              : true;
          const icon = wmoToOpenWeatherIcon(
            result.weather.daily.weather_code?.[index] ?? 0,
            isDaytime,
          );

          return {
            time: dayDate,
            ...icon,
          };
        });

        const hourlyTimes = result.weather.hourly.time.slice(0, 24);
        const hourlyIcons = hourlyTimes.map((hourDate, index) => {
          const hourDayKey = dateKeyInTimeZone(hourDate, timezone);
          const matchedDailyIndex = result.weather.daily.time.findIndex(
            (day) => dateKeyInTimeZone(day, timezone) === hourDayKey,
          );
          const hourSunrise =
            matchedDailyIndex >= 0
              ? result.weather.daily.sunrise[matchedDailyIndex]
              : undefined;
          const hourSunset =
            matchedDailyIndex >= 0
              ? result.weather.daily.sunset[matchedDailyIndex]
              : undefined;
          const isDaytimeHour =
            hourSunrise && hourSunset
              ? hourDate >= hourSunrise && hourDate <= hourSunset
              : true;
          const icon = wmoToOpenWeatherIcon(
            result.weather.hourly.weatherCode[index] ?? 0,
            isDaytimeHour,
          );

          return {
            time: hourDate,
            ...icon,
          };
        });

        // For API response, return JSON
        return {
          location: result.location,
          timezone,
          current: {
            ...result.weather.current,
            ...currentIcon,
          },
          daily: result.weather.daily,
          dailyIcons,
          hourlyIcons,
          // Include first 24 hours of hourly data
          hourly: {
            time: hourlyTimes,
            temperature: Array.from(
              result.weather.hourly.temperature.slice(0, 24),
            ),
            precipitation: Array.from(
              result.weather.hourly.precipitation.slice(0, 24),
            ),
          },
        };
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to fetch weather data" });
      }
    },
  );

  // GET /weather/text?address=<address> - Returns formatted text output
  fastify.get(
    "/weather/text",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            address: { type: "string" },
          },
          required: ["address"],
        },
      },
    },
    async (request, reply) => {
      const { address } = request.query as { address: string };

      try {
        const result = await weatherService.getWeatherForAddress(address);
        const formattedOutput = weatherService.formatWeatherOutput(
          result.location,
          result.weather,
          Array.isArray(result.timezone) ? result.timezone[0] : result.timezone,
        );

        return reply.type("text/plain").send(formattedOutput);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to fetch weather data" });
      }
    },
  );

  // GET /weather/day?address=<address> - Returns one-day weather HTML
  fastify.get(
    "/weather/day",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            address: { type: "string" },
          },
          required: ["address"],
        },
      },
    },
    async (request, reply) => {
      const { address } = request.query as { address: string };

      try {
        const result = await weatherService.getWeatherForAddress(address);
        const timezone = Array.isArray(result.timezone)
          ? result.timezone[0]
          : result.timezone;

        const now = new Date();
        const todayKey = dateKeyInTimeZone(now, timezone);
        const nowHourKey = hourKeyInTimeZone(now, timezone);
        const dailyIndex = result.weather.daily.time.findIndex(
          (day) => dateKeyInTimeZone(day, timezone) === todayKey,
        );
        const selectedDayIndex = dailyIndex >= 0 ? dailyIndex : 0;

        const selectedDayDate = result.weather.daily.time[selectedDayIndex];
        const selectedDayKey = dateKeyInTimeZone(selectedDayDate, timezone);
        const currentDayIndex = dailyIndex >= 0 ? dailyIndex : 0;
        const currentSunrise = result.weather.daily.sunrise[currentDayIndex];
        const currentSunset = result.weather.daily.sunset[currentDayIndex];
        const isCurrentDaytime =
          currentSunrise && currentSunset
            ? now >= currentSunrise && now <= currentSunset
            : true;
        const currentIcon = wmoToOpenWeatherIcon(
          result.weather.current.weather_code,
          isCurrentDaytime,
        );
        const locationText =
          result.location.formattedAddress ||
          [
            result.location.city,
            result.location.state,
            result.location.zipcode,
            result.location.country,
          ]
            .filter(Boolean)
            .join(", ") ||
          `${result.location.latitude}, ${result.location.longitude}`;

        const hourlyRows = result.weather.hourly.time
          .map((hourTime, index) => ({
            hourDayKey: dateKeyInTimeZone(hourTime, timezone),
            hourDate: hourTime,
            windDirectionDegrees: Math.round(
              result.weather.hourly.windDirection[index],
            ),
            hour: hourTime.toLocaleTimeString("en-US", {
              timeZone: timezone,
              hour: "2-digit",
              minute: "2-digit",
            }),
            temperature: Math.round(result.weather.hourly.temperature[index]),
            precipitation: Number(
              result.weather.hourly.precipitation[index].toFixed(2),
            ),
            rain: Number(result.weather.hourly.rain[index].toFixed(2)),
            snow: Number(result.weather.hourly.snowfall[index].toFixed(2)),
            windSpeed: Math.round(result.weather.hourly.windSpeed[index]),
            windDirectionCardinal: degreesToCardinal(
              result.weather.hourly.windDirection[index],
            ),
            weatherCode: result.weather.hourly.weatherCode[index] ?? 0,
          }))
          .map((row) => {
            const matchedDailyIndex = result.weather.daily.time.findIndex(
              (day) => dateKeyInTimeZone(day, timezone) === row.hourDayKey,
            );
            const hourSunrise =
              matchedDailyIndex >= 0
                ? result.weather.daily.sunrise[matchedDailyIndex]
                : undefined;
            const hourSunset =
              matchedDailyIndex >= 0
                ? result.weather.daily.sunset[matchedDailyIndex]
                : undefined;
            const isDaytimeHour =
              hourSunrise && hourSunset
                ? row.hourDate >= hourSunrise && row.hourDate <= hourSunset
                : true;
            const hourIcon = wmoToOpenWeatherIcon(
              row.weatherCode,
              isDaytimeHour,
            );

            return {
              ...row,
              iconCode: hourIcon.iconCode,
              iconUrl: hourIcon.iconUrl,
              iconSummary: hourIcon.summary,
            };
          })
          .filter((row) => {
            const rowDayKey = dateKeyInTimeZone(row.hourDate, timezone);
            const sameDay = rowDayKey === selectedDayKey;
            const rowHourKey = hourKeyInTimeZone(row.hourDate, timezone);
            const remainingHours = rowHourKey >= nowHourKey;
            return sameDay && (selectedDayKey !== todayKey || remainingHours);
          });

        return reply.view("weather-day.hbs", {
          dayDate: selectedDayDate.toLocaleDateString("en-US", {
            timeZone: timezone,
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          location: locationText,
          summary: currentIcon.summary,
          iconCode: currentIcon.iconCode,
          iconUrl: currentIcon.iconUrl,
          relativeHumidity: Math.round(
            result.weather.current.relative_humidity_2m,
          ),
          timezone,
          hourlyRows,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to render weather page" });
      }
    },
  );
}
