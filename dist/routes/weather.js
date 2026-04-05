import { WeatherService } from "../services/weatherService.js";
import { formatLocationDisplay, wmoToOpenWeatherIcon } from "../utils.js";
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
function isAllowedAddressFormat(value) {
    const normalized = value.trim();
    if (!normalized)
        return false;
    const zipOnlyPattern = /^\d{5}(?:-\d{4})?$/;
    if (zipOnlyPattern.test(normalized))
        return true;
    const cityStatePattern = /^[A-Za-z]+(?:[A-Za-z .'-]*[A-Za-z])?,\s*(?:[A-Za-z]{2}|[A-Za-z]+(?:[A-Za-z .'-]*[A-Za-z])?)$/;
    if (cityStatePattern.test(normalized))
        return true;
    const fullAddressPattern = /^\d+[A-Za-z0-9\-/]*\s+.+/;
    return fullAddressPattern.test(normalized);
}
function invalidAddressErrorMessage() {
    return "Invalid address format. Allowed formats: ZIP only (e.g., 08873), city and state (e.g., Seattle, WA), or full address (e.g., 48 Darrow Street, Franklin Township, NJ 08873).";
}
/*
{"level":50,"time":"04/04 6:01:18.570 PM ET","pid":50,"hostname":"srv-d781503uibrs73cvgvig-hibernate-66dfd8f957-mbvlg",
"err":{"type":"Error",
"message":"Weather API request failed: Daily API request limit exceeded. Please try again tomorrow.: Daily API request limit exceeded. Please try again tomorrow.",
"stack":"Error: Weather API request failed: Daily API request limit exceeded. Please try again tomorrow.
\n    at WeatherService.getWeatherData (file:///opt/render/project/src/dist/services/weatherService.js:147:34)\n
  at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n
 at async WeatherService.getWeatherForAddress (file:///opt/render/project/src/dist/services/weatherService.js:278:29)\n
  at async Object.<anonymous> (file:///opt/render/project/src/dist/routes/weather.js:113:28)\ncaused by: Error: Daily API request limit exceeded.
 Please try again tomorrow.\n    at /opt/render/project/src/node_modules/openmeteo/lib/index.js:34:23\n    at Generator.next (<anonymous>)\n
 at fulfilled (/opt/render/project/src/node_modules/openmeteo/lib/index.js:5:58)\n
 at process.processTicksAndRejections (node:internal/process/task_queues:105:5)"},
 "msg":"Weather API request failed: Daily API request limit exceeded. Please try again tomorrow."}
*/
/**
 * Registers weather endpoints for JSON, text, and day-view responses.
 *
 * @param fastify Fastify server instance.
 */
export async function weatherRoutes(fastify) {
    // GET /weather/day?address=<address>&date=<YYYY-MM-DD> - Returns one-day weather HTML for a selected location
    fastify.get("/weather/day", {
        schema: {
            querystring: {
                type: "object",
                properties: {
                    address: { type: "string" },
                    date: { type: "string" },
                    temperatureUnit: { type: "string" },
                    unitSystem: { type: "string" },
                },
            },
        },
    }, async (request, reply) => {
        const { address, date, temperatureUnit: rawTemperatureUnit, unitSystem: rawUnitSystem, } = request.query;
        const normalizedAddress = address?.trim();
        const normalizedDate = date?.trim() || undefined;
        const temperatureUnit = rawTemperatureUnit === "celsius" ? "celsius" : "fahrenheit";
        const unitSystem = rawUnitSystem === "metric" ? "metric" : "english";
        if (!normalizedAddress) {
            return reply.redirect("/");
        }
        if (!isAllowedAddressFormat(normalizedAddress)) {
            return reply.code(400).send({
                error: invalidAddressErrorMessage(),
            });
        }
        if (normalizedDate && !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
            return reply
                .code(400)
                .send({ error: "Invalid date format. Use YYYY-MM-DD" });
        }
        // Validate date is not too far in the future. Open-Meteo forecasts ~15 days ahead.
        if (normalizedDate) {
            const requestedDate = new Date(normalizedDate + "T00:00:00Z");
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            const maxFutureDate = new Date(today);
            maxFutureDate.setUTCDate(maxFutureDate.getUTCDate() + 15);
            if (requestedDate > maxFutureDate) {
                const maxDateStr = maxFutureDate.toISOString().split("T")[0];
                return reply.code(400).send({
                    error: `Date ${normalizedDate} is too far in the future. Maximum available date is ${maxDateStr} (~15 days from today).`,
                });
            }
        }
        try {
            const result = await weatherService.getWeatherForAddress(normalizedAddress, normalizedDate
                ? {
                    startDate: normalizedDate,
                    endDate: normalizedDate,
                    temperatureUnit,
                    unitSystem,
                }
                : {
                    forecastDays: 1,
                    temperatureUnit,
                    unitSystem,
                });
            const timezone = Array.isArray(result.timezone)
                ? result.timezone[0]
                : result.timezone;
            const now = new Date();
            const todayKey = dateKeyInTimeZone(now, timezone);
            const nowHourKey = hourKeyInTimeZone(now, timezone);
            const selectedDayKey = normalizedDate ?? todayKey;
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
            const currentDateParts = new Intl.DateTimeFormat("en-US", {
                timeZone: timezone,
                month: "numeric",
                day: "numeric",
            }).formatToParts(now);
            const currentMonth = Number(currentDateParts.find((part) => part.type === "month")?.value ?? 0);
            const currentDayOfMonth = Number(currentDateParts.find((part) => part.type === "day")?.value ?? 0);
            const showSnowfall = currentMonth === 12 ||
                currentMonth === 1 ||
                currentMonth === 2 ||
                (currentMonth === 3 && currentDayOfMonth <= 15);
            const headerIcon = isViewingForecast
                ? wmoToOpenWeatherIcon(result.weather.daily.weather_code?.[selectedDayIndex] ?? 0, true)
                : wmoToOpenWeatherIcon(result.weather.current.weather_code, isCurrentDaytime);
            const { streetLine, localityLine, countryLine, coordinatesLine } = formatLocationDisplay(result.location);
            const temperatureUnitLabel = temperatureUnit === "celsius" ? "C" : "F";
            const windSpeedUnitLabel = unitSystem === "metric" ? "km/h" : "mph";
            const precipitationUnitLabel = unitSystem === "metric" ? "cm" : "in";
            const visibilityUnitLabel = unitSystem === "metric" ? "m" : "ft";
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
                precipitationProbability: Math.round(result.weather.hourly.precipitation_probability[index] ?? 0),
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
                streetLine,
                localityLine,
                countryLine,
                coordinatesLine,
                summary: headerIcon.summary,
                iconCode: headerIcon.iconCode,
                iconUrl: headerIcon.iconUrl,
                meteoconUrl: headerIcon.meteoconUrl,
                timezone,
                isViewingForecast,
                temperatureUnitLabel,
                windSpeedUnitLabel,
                precipitationUnitLabel,
                visibilityUnitLabel,
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
                precipitationProbabilityMax: Math.round(result.weather.daily.precipitation_probability_max?.[selectedDayIndex] ?? 0),
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
                showSnowfall,
            });
        }
        catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: "Failed to render weather page" });
        }
    });
    // GET / - Landing page for Weather Explorer
    fastify.get("/", async (_request, reply) => {
        const today = new Date();
        const maxDate = new Date(today);
        maxDate.setDate(maxDate.getDate() + 15);
        return reply.view("landing.hbs", {
            todayDate: today.toISOString().split("T")[0],
            maxDate: maxDate.toISOString().split("T")[0],
        });
    });
}
//# sourceMappingURL=weather.js.map