import Fastify from "fastify";
import fastifyView from "@fastify/view";
import fastifyStatic from "@fastify/static";
import handlebars from "handlebars";
import path from "node:path";
import { generate as generateShortUuid } from "short-uuid";
import { weatherRoutes, healthRoutes } from "./routes/index.js";
import { cors } from "./plugins/index.js";
/**
 * Formats a Date into short 12-hour America/New_York time with AM/PM.
 *
 * @param date Date instance to format.
 * @returns Readable timestamp string suitable for structured logs.
 */
function newYorkIsoTimestamp(date) {
    const millis = String(date.getMilliseconds()).padStart(3, "0");
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        month: "2-digit",
        day: "2-digit",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    }).formatToParts(date);
    const getPart = (type) => parts.find((part) => part.type === type)?.value ?? "";
    const month = getPart("month");
    const day = getPart("day");
    const hour = getPart("hour");
    const minute = getPart("minute");
    const second = getPart("second");
    const dayPeriod = getPart("dayPeriod");
    return `${month}/${day} ${hour}:${minute}:${second}.${millis} ${dayPeriod} ET`;
}
const app = Fastify({
    logger: {
        timestamp: () => `,"time":"${newYorkIsoTimestamp(new Date())}"`,
    },
    genReqId: () => generateShortUuid(),
    // Use the custom hook below for request logs so static asset GETs can be skipped.
    disableRequestLogging: true,
});
function shouldSkipHttpLog(url) {
    return (url.startsWith("/assets/weather-icons/") ||
        url.startsWith("/assets/") ||
        url === "/favicon.ico" ||
        url === "/favicon.svg");
}
app.addHook("preHandler", async (request) => {
    const requestUrl = request.raw.url ?? request.url;
    const route = request.routeOptions.url ?? request.url;
    if (shouldSkipHttpLog(requestUrl)) {
        return;
    }
    request.log.info({
        method: request.method,
        route,
        url: requestUrl,
        params: request.params,
        query: request.query,
    }, "http request");
});
app.addHook("onResponse", async (request, reply) => {
    const requestUrl = request.raw.url ?? request.url;
    const route = request.routeOptions.url ?? request.url;
    if (shouldSkipHttpLog(requestUrl)) {
        return;
    }
    request.log.info({
        method: request.method,
        route,
        url: requestUrl,
        statusCode: reply.statusCode,
        responseTimeMs: reply.elapsedTime,
    }, "http response");
});
// Register plugins
app.register(cors);
app.register(fastifyView, {
    engine: {
        handlebars,
    },
    root: path.join(process.cwd(), "views"),
});
app.register(fastifyStatic, {
    root: path.join(process.cwd(), "public"),
    prefix: "/assets/",
});
// Serve favicon as SVG and keep /favicon.ico for browser compatibility.
app.get("/favicon.svg", async (_request, reply) => {
    return reply.type("image/svg+xml").sendFile("favicon.svg");
});
app.get("/favicon.ico", async (_request, reply) => {
    return reply.type("image/svg+xml").sendFile("favicon.svg");
});
// Register routes
// http://localhost:3000/weather?address=48%20Darrow%20Street%2008882
app.register(weatherRoutes);
app.register(healthRoutes);
export default app;
//# sourceMappingURL=app.js.map