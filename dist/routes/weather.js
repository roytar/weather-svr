import { WeatherService } from "../services/weatherService.js";
import { wmoToOpenWeatherIcon } from "../utils.js";
const weatherService = new WeatherService();
/**
 * Converts wind direction in degrees to a 16-point compass direction.
 *
 * @param degrees Wind direction in degrees.
 * @returns Cardinal/ordinal direction label.
 */
function degreesToCardinal(degrees) {
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
 * Builds a YYYY-MM-DD key for a date in a specific timezone.
 *
 * @param date Date to normalize.
 * @param timeZone IANA timezone identifier.
 * @returns Date key in YYYY-MM-DD format.
 */
function dateKeyInTimeZone(date, timeZone) {
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
function hourKeyInTimeZone(date, timeZone) {
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
 * Registers weather endpoints for JSON, text, and day-view responses.
 *
 * @param fastify Fastify server instance.
 */
export async function weatherRoutes(fastify) {
    // GET /weather/day?address=<address>&date=<YYYY-MM-DD> - Returns one-day weather HTML (date optional, defaults to New York)
    fastify.get("/weather/day", {
        schema: {
            querystring: {
                type: "object",
                properties: {
                    address: { type: "string" },
                    date: { type: "string" },
                },
            },
        },
    }, async (request, reply) => {
        const { address = "New York", date } = request.query;
        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return reply
                .code(400)
                .send({ error: "Invalid date format. Use YYYY-MM-DD" });
        }
        // Validate date is not too far in the future. Open-Meteo forecasts ~15 days ahead.
        if (date) {
            const requestedDate = new Date(date + "T00:00:00Z");
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            const maxFutureDate = new Date(today);
            maxFutureDate.setUTCDate(maxFutureDate.getUTCDate() + 15);
            if (requestedDate > maxFutureDate) {
                const maxDateStr = maxFutureDate.toISOString().split("T")[0];
                return reply.code(400).send({
                    error: `Date ${date} is too far in the future. Maximum available date is ${maxDateStr} (~16 days from today).`,
                });
            }
        }
        try {
            const result = await weatherService.getWeatherForAddress(address, date
                ? {
                    startDate: date,
                    endDate: date,
                }
                : {
                    forecastDays: 1,
                });
            const timezone = Array.isArray(result.timezone)
                ? result.timezone[0]
                : result.timezone;
            const now = new Date();
            const todayKey = dateKeyInTimeZone(now, timezone);
            const nowHourKey = hourKeyInTimeZone(now, timezone);
            const selectedDayKey = date ?? todayKey;
            const selectedDailyIndex = result.weather.daily.time.findIndex((day) => dateKeyInTimeZone(day, timezone) === selectedDayKey);
            const selectedDayIndex = selectedDailyIndex >= 0 ? selectedDailyIndex : 0;
            const todayDailyIndex = result.weather.daily.time.findIndex((day) => dateKeyInTimeZone(day, timezone) === todayKey);
            const selectedDayDate = result.weather.daily.time[selectedDayIndex];
            const currentDayIndex = todayDailyIndex >= 0 ? todayDailyIndex : 0;
            const currentSunrise = result.weather.daily.sunrise[currentDayIndex];
            const currentSunset = result.weather.daily.sunset[currentDayIndex];
            const isCurrentDaytime = currentSunrise && currentSunset
                ? now >= currentSunrise && now <= currentSunset
                : true;
            // Use forecast weather if a specific date is provided and it's not today
            const isViewingForecast = selectedDayKey !== todayKey;
            const isHistoric = selectedDayKey < todayKey;
            const isForecast = selectedDayKey > todayKey;
            const headerIcon = isViewingForecast
                ? wmoToOpenWeatherIcon(result.weather.daily.weather_code?.[selectedDayIndex] ?? 0, true)
                : wmoToOpenWeatherIcon(result.weather.current.weather_code, isCurrentDaytime);
            const locationText = result.location.wasZipCodeOnly
                ? [
                    result.location.city,
                    result.location.state,
                    result.location.zipcode,
                ]
                    .filter(Boolean)
                    .join(", ")
                : result.location.formattedAddress ||
                    [
                        result.location.city,
                        result.location.state,
                        result.location.zipcode,
                        result.location.country,
                    ]
                        .filter(Boolean)
                        .join(", ") ||
                    `${result.location.latitude}, ${result.location.longitude}`;
            // For zip-only searches, keep the input concise (city/state/zip only).
            const expandedAddress = result.location.wasZipCodeOnly
                ? locationText
                : result.location.formattedAddress || locationText;
            const hourlyRows = result.weather.hourly.time
                .map((hourTime, index) => ({
                hourDayKey: dateKeyInTimeZone(hourTime, timezone),
                hourDate: hourTime,
                windDirectionDegrees: Math.round(result.weather.hourly.windDirection[index]),
                hour: hourTime.toLocaleTimeString("en-US", {
                    timeZone: timezone,
                    hour: "2-digit",
                    minute: "2-digit",
                }),
                temperature: Math.round(result.weather.hourly.temperature[index]),
                precipitation: Number(result.weather.hourly.precipitation[index].toFixed(2)),
                rain: Number(result.weather.hourly.rain[index].toFixed(2)),
                snow: Number(result.weather.hourly.snowfall[index].toFixed(2)),
                windSpeed: Math.round(result.weather.hourly.windSpeed[index]),
                windDirectionCardinal: degreesToCardinal(result.weather.hourly.windDirection[index]),
                weatherCode: result.weather.hourly.weatherCode[index] ?? 0,
            }))
                .map((row) => {
                const matchedDailyIndex = result.weather.daily.time.findIndex((day) => dateKeyInTimeZone(day, timezone) === row.hourDayKey);
                const hourSunrise = matchedDailyIndex >= 0
                    ? result.weather.daily.sunrise[matchedDailyIndex]
                    : undefined;
                const hourSunset = matchedDailyIndex >= 0
                    ? result.weather.daily.sunset[matchedDailyIndex]
                    : undefined;
                const isDaytimeHour = hourSunrise && hourSunset
                    ? row.hourDate >= hourSunrise && row.hourDate <= hourSunset
                    : true;
                const hourIcon = wmoToOpenWeatherIcon(row.weatherCode, isDaytimeHour);
                return {
                    ...row,
                    iconCode: hourIcon.iconCode,
                    iconUrl: hourIcon.iconUrl,
                    meteoconUrl: hourIcon.meteoconUrl,
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
            // Build minutely15 sub-rows grouped by hour key — future intervals only
            const minutely15ByHourKey = {};
            const m15 = result.weather.minutely15;
            if (m15?.time) {
                m15.time.forEach((t, i) => {
                    if (t <= now)
                        return;
                    const m15DayKey = dateKeyInTimeZone(t, timezone);
                    if (m15DayKey !== selectedDayKey)
                        return;
                    const hk = hourKeyInTimeZone(t, timezone);
                    if (!minutely15ByHourKey[hk])
                        minutely15ByHourKey[hk] = [];
                    minutely15ByHourKey[hk].push({
                        time: t.toLocaleTimeString("en-US", {
                            timeZone: timezone,
                            hour: "2-digit",
                            minute: "2-digit",
                        }),
                        temperature: Math.round(m15.temperature_2m?.[i] ?? 0),
                        rain: Number((m15.rain?.[i] ?? 0).toFixed(3)),
                        visibility: Math.round(m15.visibility?.[i] ?? 0),
                        sunshine_duration: Math.round(m15.sunshine_duration?.[i] ?? 0),
                    });
                });
            }
            const hourlyRowsWithMinutely = hourlyRows.map((row) => {
                const subRows = minutely15ByHourKey[hourKeyInTimeZone(row.hourDate, timezone)] ??
                    [];
                return {
                    ...row,
                    minutely15: subRows,
                    hasMinutely15: subRows.length > 0,
                };
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
                expandedAddress,
                wasZipCodeOnly: result.location.wasZipCodeOnly || false,
                summary: headerIcon.summary,
                iconCode: headerIcon.iconCode,
                iconUrl: headerIcon.iconUrl,
                meteoconUrl: headerIcon.meteoconUrl,
                timezone,
                isViewingForecast,
                // current conditions (today only)
                currentTime: isViewingForecast
                    ? null
                    : now.toLocaleTimeString("en-US", {
                        timeZone: timezone,
                        hour: "2-digit",
                        minute: "2-digit",
                    }),
                currentTemp: Math.round(result.weather.current.temperature_2m),
                currentWindSpeed: Math.round(result.weather.current.wind_speed_10m),
                currentWindDir: degreesToCardinal(result.weather.current.wind_direction_10m),
                currentWindDeg: Math.round(result.weather.current.wind_direction_10m),
                currentPrecip: Number(result.weather.current.precipitation.toFixed(2)),
                relativeHumidity: Math.round(result.weather.current.relative_humidity_2m),
                // selected-day stats
                highTemp: Math.round(result.weather.daily.temperature_2m_max[selectedDayIndex]),
                lowTemp: Math.round(result.weather.daily.temperature_2m_min[selectedDayIndex]),
                apparentTempMax: Math.round(result.weather.daily.apparent_temperature_max?.[selectedDayIndex] ??
                    0),
                maxWindSpeed: Math.round(result.weather.daily.wind_speed_10m_max[selectedDayIndex]),
                maxGusts: Math.round(result.weather.daily.wind_gusts_10m_max[selectedDayIndex]),
                sunriseTime: result.weather.daily.sunrise[selectedDayIndex]?.toLocaleTimeString("en-US", {
                    timeZone: timezone,
                    hour: "2-digit",
                    minute: "2-digit",
                }),
                sunsetTime: result.weather.daily.sunset[selectedDayIndex]?.toLocaleTimeString("en-US", {
                    timeZone: timezone,
                    hour: "2-digit",
                    minute: "2-digit",
                }),
                hourlyRows: hourlyRowsWithMinutely,
                isHistoric,
                isForecast,
            });
        }
        catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: "Failed to render weather page" });
        }
    });
    // GET / - Redirect root to /weather/day with New York default
    fastify.get("/", async (request, reply) => {
        return reply.redirect("/weather/day?address=New%20York");
    });
}
//# sourceMappingURL=weather.js.map