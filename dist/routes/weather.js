import { WeatherService } from "../services/weatherService.js";
import { dateKeyInTimeZone, degreesToCardinal, formatLocationDisplay, hourKeyInTimeZone, invalidAddressErrorMessage, isAllowedAddressFormat, isValidHourKey, isValidIsoDate, wmoToOpenWeatherIcon, } from "../utils/index.js";
const MAX_FORECAST_LOOKAHEAD_DAYS = 15;
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
 * @param log Fastify logger instance from the app.
 * @returns Fastify plugin that registers weather routes.
 */
export function weatherRoutes(log) {
    const weatherService = new WeatherService(log);
    return async function registerWeatherRoutes(fastify) {
        // GET /weather/text?address=<address> - Returns formatted plain-text weather output
        fastify.get("/weather/text", {
            schema: {
                querystring: {
                    type: "object",
                    properties: {
                        address: { type: "string" },
                    },
                    required: ["address"],
                },
            },
        }, async (request, reply) => {
            const { address } = request.query;
            const normalizedAddress = address?.trim();
            log.info({
                address: normalizedAddress,
            }, "processing /weather/text request");
            if (!normalizedAddress) {
                return reply.code(400).send({ error: "Address is required" });
            }
            if (!isAllowedAddressFormat(normalizedAddress)) {
                return reply.code(400).send({
                    error: invalidAddressErrorMessage(),
                });
            }
            try {
                const result = await weatherService.getWeatherForAddress(normalizedAddress);
                const formattedOutput = weatherService.formatWeatherOutput(result.location, result.weather, Array.isArray(result.timezone)
                    ? result.timezone[0]
                    : result.timezone);
                return reply.type("text/plain").send(formattedOutput);
            }
            catch (error) {
                const errorMessage = error instanceof Error && error.message
                    ? error.message
                    : "Failed to fetch weather data";
                log.error({
                    address: normalizedAddress,
                    error,
                }, "failed to fetch weather text output");
                return reply.code(502).send({ error: errorMessage });
            }
        });
        // GET /weather/minutely?address=<address>&date=<YYYY-MM-DD>&hourKey=<YYYY-MM-DD-HH>
        // Returns lazy-loaded 15-minute detail rows for a selected hour.
        fastify.get("/weather/minutely", {
            schema: {
                querystring: {
                    type: "object",
                    properties: {
                        address: { type: "string" },
                        date: { type: "string" },
                        hourKey: { type: "string" },
                        temperatureUnit: { type: "string" },
                        unitSystem: { type: "string" },
                    },
                    required: ["address", "date", "hourKey"],
                },
            },
        }, async (request, reply) => {
            const { address, date, hourKey, temperatureUnit: rawTemperatureUnit, unitSystem: rawUnitSystem, } = request.query;
            const normalizedAddress = address?.trim();
            const normalizedDate = date?.trim();
            const normalizedHourKey = hourKey?.trim();
            const temperatureUnit = rawTemperatureUnit === "celsius" ? "celsius" : "fahrenheit";
            const unitSystem = rawUnitSystem === "metric" ? "metric" : "english";
            if (!normalizedAddress) {
                return reply.code(400).send({ error: "Address is required" });
            }
            if (!isAllowedAddressFormat(normalizedAddress)) {
                return reply.code(400).send({
                    error: invalidAddressErrorMessage(),
                });
            }
            if (!normalizedDate || !isValidIsoDate(normalizedDate)) {
                return reply
                    .code(400)
                    .send({ error: "Invalid date format. Use YYYY-MM-DD" });
            }
            if (!normalizedHourKey || !isValidHourKey(normalizedHourKey)) {
                return reply.code(400).send({
                    error: "Invalid hour key format. Use YYYY-MM-DD-HH.",
                });
            }
            if (!normalizedHourKey.startsWith(`${normalizedDate}-`)) {
                return reply.code(400).send({
                    error: "Hour key must belong to the selected date.",
                });
            }
            try {
                const result = await weatherService.getWeatherForAddress(normalizedAddress, {
                    startDate: normalizedDate,
                    endDate: normalizedDate,
                    temperatureUnit,
                    unitSystem,
                    includeMinutely15: true,
                });
                const timezone = Array.isArray(result.timezone)
                    ? result.timezone[0]
                    : result.timezone;
                const now = new Date();
                const rows = [];
                result.weather.minutely15.time.forEach((timestamp, index) => {
                    if (timestamp <= now) {
                        return;
                    }
                    if (dateKeyInTimeZone(timestamp, timezone) !== normalizedDate) {
                        return;
                    }
                    if (hourKeyInTimeZone(timestamp, timezone) !== normalizedHourKey) {
                        return;
                    }
                    rows.push({
                        time: timestamp.toLocaleTimeString("en-US", {
                            timeZone: timezone,
                            hour: "2-digit",
                            minute: "2-digit",
                        }),
                        temperature: Math.round(result.weather.minutely15.temperature_2m?.[index] ?? 0),
                        rain: Number((result.weather.minutely15.rain?.[index] ?? 0).toFixed(3)),
                        visibility: Math.round(result.weather.minutely15.visibility?.[index] ?? 0),
                        sunshine_duration: Math.round(result.weather.minutely15.sunshine_duration?.[index] ?? 0),
                    });
                });
                return reply.send({ rows });
            }
            catch (error) {
                const errorMessage = error instanceof Error && error.message
                    ? error.message
                    : "Failed to load 15-minute weather data";
                log.error({
                    address: normalizedAddress,
                    date: normalizedDate,
                    hourKey: normalizedHourKey,
                    temperatureUnit,
                    unitSystem,
                    error,
                }, "failed to load 15-minute weather details");
                return reply.code(502).send({
                    error: errorMessage,
                });
            }
        });
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
            if (normalizedDate && !isValidIsoDate(normalizedDate)) {
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
                maxFutureDate.setUTCDate(maxFutureDate.getUTCDate() + MAX_FORECAST_LOOKAHEAD_DAYS);
                if (requestedDate > maxFutureDate) {
                    const maxDateStr = maxFutureDate.toISOString().split("T")[0];
                    return reply.code(400).send({
                        error: `Date ${normalizedDate} is too far in the future. Maximum available date is ${maxDateStr} (~${MAX_FORECAST_LOOKAHEAD_DAYS} days from today).`,
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
                    hourKey: hourKeyInTimeZone(hourTime, timezone),
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
                    const hasMinutely15 = selectedDayKey >= todayKey && row.hourKey >= nowHourKey;
                    return {
                        ...row,
                        iconCode: hourIcon.iconCode,
                        iconUrl: hourIcon.iconUrl,
                        meteoconUrl: hourIcon.meteoconUrl,
                        iconSummary: hourIcon.summary,
                        hasMinutely15,
                        minutelyUrl: hasMinutely15
                            ? `/weather/minutely?${new URLSearchParams({
                                address: normalizedAddress,
                                date: selectedDayKey,
                                hourKey: row.hourKey,
                                temperatureUnit,
                                unitSystem,
                            }).toString()}`
                            : undefined,
                    };
                })
                    .filter((row) => {
                    const rowDayKey = dateKeyInTimeZone(row.hourDate, timezone);
                    const sameDay = rowDayKey === selectedDayKey;
                    const remainingHours = row.hourKey >= nowHourKey;
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
                    apparentTempMax: Math.round(result.weather.daily.apparent_temperature_max?.[selectedDayIndex] ?? 0),
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
                    hourlyRows,
                    isHistoric,
                    isForecast,
                    showSnowfall,
                });
            }
            catch (error) {
                const errorMessage = error instanceof Error && error.message
                    ? error.message
                    : "Failed to render weather page";
                log.error({
                    address: normalizedAddress,
                    date: normalizedDate,
                    temperatureUnit,
                    unitSystem,
                    error,
                }, "failed to render weather page");
                const today = new Date();
                today.setUTCHours(0, 0, 0, 0);
                const maxFutureDate = new Date(today);
                maxFutureDate.setUTCDate(maxFutureDate.getUTCDate() + MAX_FORECAST_LOOKAHEAD_DAYS);
                return reply.code(502).view("landing.hbs", {
                    todayDate: normalizedDate ?? today.toISOString().split("T")[0],
                    maxDate: maxFutureDate.toISOString().split("T")[0],
                    address: normalizedAddress,
                    errorMessage,
                    isCelsius: temperatureUnit === "celsius",
                    isMetric: unitSystem === "metric",
                });
            }
        });
        // GET /weather/range - Landing page and multi-day weather range results
        fastify.get("/weather/range", {
            schema: {
                querystring: {
                    type: "object",
                    properties: {
                        address: { type: "string" },
                        startDate: { type: "string" },
                        endDate: { type: "string" },
                        temperatureUnit: { type: "string" },
                        unitSystem: { type: "string" },
                    },
                },
            },
        }, async (request, reply) => {
            const { address, startDate, endDate, temperatureUnit: rawTemperatureUnit, unitSystem: rawUnitSystem, } = request.query;
            const normalizedAddress = address?.trim();
            const normalizedStartDate = startDate?.trim() || "";
            const normalizedEndDate = endDate?.trim() || "";
            const temperatureUnit = rawTemperatureUnit === "celsius" ? "celsius" : "fahrenheit";
            const unitSystem = rawUnitSystem === "metric" ? "metric" : "english";
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            const maxFutureDate = new Date(today);
            maxFutureDate.setUTCDate(maxFutureDate.getUTCDate() + MAX_FORECAST_LOOKAHEAD_DAYS);
            const defaultEndDate = new Date(today);
            defaultEndDate.setUTCDate(defaultEndDate.getUTCDate() + 4);
            if (defaultEndDate > maxFutureDate) {
                defaultEndDate.setTime(maxFutureDate.getTime());
            }
            const todayDate = today.toISOString().split("T")[0];
            const maxDate = maxFutureDate.toISOString().split("T")[0];
            if (!normalizedAddress && !normalizedStartDate && !normalizedEndDate) {
                return reply.view("weather-range-landing.hbs", {
                    todayDate,
                    defaultStartDate: todayDate,
                    defaultEndDate: defaultEndDate.toISOString().split("T")[0],
                    maxDate,
                });
            }
            if (!normalizedAddress) {
                return reply.code(400).send({ error: "Address is required" });
            }
            if (!isAllowedAddressFormat(normalizedAddress)) {
                return reply.code(400).send({
                    error: invalidAddressErrorMessage(),
                });
            }
            if (!normalizedStartDate || !normalizedEndDate) {
                return reply.code(400).send({
                    error: "Both a start date and end date are required.",
                });
            }
            if (!isValidIsoDate(normalizedStartDate) ||
                !isValidIsoDate(normalizedEndDate)) {
                return reply.code(400).send({
                    error: "Invalid date format. Use YYYY-MM-DD for both dates.",
                });
            }
            const requestedStartDate = new Date(`${normalizedStartDate}T00:00:00Z`);
            const requestedEndDate = new Date(`${normalizedEndDate}T00:00:00Z`);
            if (requestedEndDate < requestedStartDate) {
                return reply.code(400).send({
                    error: "End date must be on or after the start date.",
                });
            }
            if (requestedStartDate > maxFutureDate ||
                requestedEndDate > maxFutureDate) {
                return reply.code(400).send({
                    error: `Date range is too far in the future. Maximum available date is ${maxDate} (~${MAX_FORECAST_LOOKAHEAD_DAYS} days from today).`,
                });
            }
            try {
                const result = await weatherService.getWeatherForAddress(normalizedAddress, {
                    startDate: normalizedStartDate,
                    endDate: normalizedEndDate,
                    temperatureUnit,
                    unitSystem,
                });
                const timezone = Array.isArray(result.timezone)
                    ? result.timezone[0]
                    : result.timezone;
                if (result.weather.daily.time.length === 0) {
                    return reply.code(404).send({
                        error: "No daily weather data was returned for that date range.",
                    });
                }
                const now = new Date();
                const todayKey = dateKeyInTimeZone(now, timezone);
                const currentDayIndex = result.weather.daily.time.findIndex((day) => dateKeyInTimeZone(day, timezone) === todayKey);
                const headerDayIndex = currentDayIndex >= 0 ? currentDayIndex : 0;
                const headerSunrise = result.weather.daily.sunrise[headerDayIndex];
                const headerSunset = result.weather.daily.sunset[headerDayIndex];
                const isCurrentDaytime = headerSunrise && headerSunset
                    ? now >= headerSunrise && now <= headerSunset
                    : true;
                const headerIcon = wmoToOpenWeatherIcon(result.weather.current.weather_code, isCurrentDaytime);
                const { streetLine, localityLine, countryLine, coordinatesLine } = formatLocationDisplay(result.location);
                const temperatureUnitLabel = temperatureUnit === "celsius" ? "C" : "F";
                const windSpeedUnitLabel = unitSystem === "metric" ? "km/h" : "mph";
                const precipitationUnitLabel = unitSystem === "metric" ? "cm" : "in";
                const visibilityUnitLabel = unitSystem === "metric" ? "m" : "ft";
                const nowHourKey = hourKeyInTimeZone(now, timezone);
                const rangeStartLabel = result.weather.daily.time[0].toLocaleDateString("en-US", {
                    timeZone: timezone,
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                });
                const rangeEndLabel = result.weather.daily.time[result.weather.daily.time.length - 1].toLocaleDateString("en-US", {
                    timeZone: timezone,
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                });
                const allHourlyRows = result.weather.hourly.time
                    .map((hourTime, hourIndex) => ({
                    hourDayKey: dateKeyInTimeZone(hourTime, timezone),
                    hourKey: hourKeyInTimeZone(hourTime, timezone),
                    hourDate: hourTime,
                    windDirectionDegrees: Math.round(result.weather.hourly.windDirection[hourIndex]),
                    hour: hourTime.toLocaleTimeString("en-US", {
                        timeZone: timezone,
                        hour: "2-digit",
                        minute: "2-digit",
                    }),
                    temperature: Math.round(result.weather.hourly.temperature[hourIndex]),
                    precipitation: Number(result.weather.hourly.precipitation[hourIndex].toFixed(2)),
                    precipitationProbability: Math.round(result.weather.hourly.precipitation_probability[hourIndex] ?? 0),
                    rain: Number(result.weather.hourly.rain[hourIndex].toFixed(2)),
                    snow: Number(result.weather.hourly.snowfall[hourIndex].toFixed(2)),
                    windSpeed: Math.round(result.weather.hourly.windSpeed[hourIndex]),
                    windDirectionCardinal: degreesToCardinal(result.weather.hourly.windDirection[hourIndex]),
                    weatherCode: result.weather.hourly.weatherCode[hourIndex] ?? 0,
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
                        meteoconUrl: hourIcon.meteoconUrl,
                        iconSummary: hourIcon.summary,
                    };
                });
                const dailyRows = result.weather.daily.time.map((day, index) => {
                    const rowKey = dateKeyInTimeZone(day, timezone);
                    const rowIcon = wmoToOpenWeatherIcon(result.weather.daily.weather_code?.[index] ?? 0, true);
                    const dateParts = new Intl.DateTimeFormat("en-US", {
                        timeZone: timezone,
                        month: "numeric",
                        day: "numeric",
                    }).formatToParts(day);
                    const month = Number(dateParts.find((part) => part.type === "month")?.value ?? 0);
                    const dayOfMonth = Number(dateParts.find((part) => part.type === "day")?.value ?? 0);
                    const showSnowfall = month === 12 ||
                        month === 1 ||
                        month === 2 ||
                        (month === 3 && dayOfMonth <= 15);
                    const showCurrentConditions = rowKey === todayKey;
                    const hourlyRows = allHourlyRows
                        .filter((row) => {
                        const sameDay = row.hourDayKey === rowKey;
                        const remainingHours = rowKey !== todayKey || row.hourKey >= nowHourKey;
                        return sameDay && remainingHours;
                    })
                        .map((row, hourIndex) => {
                        const hasMinutely15 = rowKey >= todayKey && row.hourKey >= nowHourKey;
                        return {
                            ...row,
                            hasMinutely15,
                            detailToggleId: `range-${index}-${hourIndex}`,
                            minutelyUrl: hasMinutely15
                                ? `/weather/minutely?${new URLSearchParams({
                                    address: normalizedAddress,
                                    date: rowKey,
                                    hourKey: row.hourKey,
                                    temperatureUnit,
                                    unitSystem,
                                }).toString()}`
                                : undefined,
                        };
                    });
                    return {
                        dayLabel: day.toLocaleDateString("en-US", {
                            timeZone: timezone,
                            weekday: "long",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                        }),
                        dayKey: rowKey,
                        badge: rowKey === todayKey
                            ? "Today"
                            : rowKey < todayKey
                                ? "Historic"
                                : "Forecast",
                        summary: rowIcon.summary,
                        iconCode: rowIcon.iconCode,
                        meteoconUrl: rowIcon.meteoconUrl,
                        highTemp: Math.round(result.weather.daily.temperature_2m_max[index]),
                        lowTemp: Math.round(result.weather.daily.temperature_2m_min[index]),
                        apparentTempMax: Math.round(result.weather.daily.apparent_temperature_max?.[index] ?? 0),
                        precipitationProbabilityMax: Math.round(result.weather.daily.precipitation_probability_max?.[index] ??
                            0),
                        maxWindSpeed: Math.round(result.weather.daily.wind_speed_10m_max[index]),
                        maxGusts: Math.round(result.weather.daily.wind_gusts_10m_max[index]),
                        sunriseTime: result.weather.daily.sunrise[index]?.toLocaleTimeString("en-US", {
                            timeZone: timezone,
                            hour: "2-digit",
                            minute: "2-digit",
                        }),
                        sunsetTime: result.weather.daily.sunset[index]?.toLocaleTimeString("en-US", {
                            timeZone: timezone,
                            hour: "2-digit",
                            minute: "2-digit",
                        }),
                        showCurrentConditions,
                        currentTime: showCurrentConditions
                            ? now.toLocaleTimeString("en-US", {
                                timeZone: timezone,
                                hour: "2-digit",
                                minute: "2-digit",
                            })
                            : null,
                        currentTemp: Math.round(result.weather.current.temperature_2m),
                        currentWindSpeed: Math.round(result.weather.current.wind_speed_10m),
                        currentWindDir: degreesToCardinal(result.weather.current.wind_direction_10m),
                        currentWindDeg: Math.round(result.weather.current.wind_direction_10m),
                        currentPrecip: Number(result.weather.current.precipitation.toFixed(2)),
                        relativeHumidity: Math.round(result.weather.current.relative_humidity_2m),
                        showSnowfall,
                        hourlyRows,
                        dayUrl: `/weather/day?${new URLSearchParams({
                            address: normalizedAddress,
                            date: rowKey,
                            temperatureUnit,
                            unitSystem,
                        }).toString()}`,
                    };
                });
                return reply.view("weather-range.hbs", {
                    dayDate: now.toLocaleDateString("en-US", {
                        timeZone: timezone,
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                    }),
                    rangeLabel: rangeStartLabel === rangeEndLabel
                        ? rangeStartLabel
                        : `${rangeStartLabel} – ${rangeEndLabel}`,
                    streetLine,
                    localityLine,
                    countryLine,
                    coordinatesLine,
                    summary: headerIcon.summary,
                    iconCode: headerIcon.iconCode,
                    meteoconUrl: headerIcon.meteoconUrl,
                    timezone,
                    currentTime: now.toLocaleTimeString("en-US", {
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
                    highTemp: Math.round(result.weather.daily.temperature_2m_max[headerDayIndex]),
                    lowTemp: Math.round(result.weather.daily.temperature_2m_min[headerDayIndex]),
                    apparentTempMax: Math.round(result.weather.daily.apparent_temperature_max?.[headerDayIndex] ??
                        0),
                    maxWindSpeed: Math.round(result.weather.daily.wind_speed_10m_max[headerDayIndex]),
                    maxGusts: Math.round(result.weather.daily.wind_gusts_10m_max[headerDayIndex]),
                    precipitationProbabilityMax: Math.round(result.weather.daily.precipitation_probability_max?.[headerDayIndex] ?? 0),
                    sunriseTime: result.weather.daily.sunrise[headerDayIndex]?.toLocaleTimeString("en-US", {
                        timeZone: timezone,
                        hour: "2-digit",
                        minute: "2-digit",
                    }),
                    sunsetTime: result.weather.daily.sunset[headerDayIndex]?.toLocaleTimeString("en-US", {
                        timeZone: timezone,
                        hour: "2-digit",
                        minute: "2-digit",
                    }),
                    temperatureUnitLabel,
                    windSpeedUnitLabel,
                    precipitationUnitLabel,
                    visibilityUnitLabel,
                    dailyRows,
                });
            }
            catch (error) {
                const errorMessage = error instanceof Error && error.message
                    ? error.message
                    : "Failed to render weather range page";
                log.error({
                    address: normalizedAddress,
                    startDate: normalizedStartDate,
                    endDate: normalizedEndDate,
                    temperatureUnit,
                    unitSystem,
                    error,
                }, "failed to render weather range page");
                return reply.code(502).view("weather-range-landing.hbs", {
                    todayDate,
                    defaultStartDate: normalizedStartDate ?? todayDate,
                    defaultEndDate: normalizedEndDate ?? defaultEndDate.toISOString().split("T")[0],
                    maxDate,
                    address: normalizedAddress,
                    errorMessage,
                    isCelsius: temperatureUnit === "celsius",
                    isMetric: unitSystem === "metric",
                });
            }
        });
        // GET / - Default to the weather range landing page
        fastify.get("/", async (_request, reply) => {
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            const maxDate = new Date(today);
            maxDate.setUTCDate(maxDate.getUTCDate() + MAX_FORECAST_LOOKAHEAD_DAYS);
            const defaultEndDate = new Date(today);
            defaultEndDate.setUTCDate(defaultEndDate.getUTCDate() + 4);
            if (defaultEndDate > maxDate) {
                defaultEndDate.setTime(maxDate.getTime());
            }
            return reply.view("weather-range-landing.hbs", {
                todayDate: today.toISOString().split("T")[0],
                defaultStartDate: today.toISOString().split("T")[0],
                defaultEndDate: defaultEndDate.toISOString().split("T")[0],
                maxDate: maxDate.toISOString().split("T")[0],
            });
        });
    };
}
//# sourceMappingURL=weather.js.map