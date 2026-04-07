import Fastify from "fastify";
import fastifyView from "@fastify/view";
import fastifyStatic from "@fastify/static";
import handlebars from "handlebars";
import path from "node:path";
import { generate as generateShortUuid } from "short-uuid";
import { weatherRoutes, healthRoutes } from "./routes/index.js";
import { cors } from "./plugins/index.js";
import { newYorkIsoTimestamp } from "./utils/index.js";
import rateLimit from "@fastify/rate-limit";
import helmet from "@fastify/helmet";
/**
 * Creates the Fastify application instance and configures structured logging.
 */
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
/**
 * Logs incoming HTTP requests before route handlers run.
 */
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
/**
 * Logs outgoing HTTP responses after each request completes.
 */
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
/**
 * Enables Cross-Origin Resource Sharing for browser-based requests.
 */
app.register(cors);
/**
 * Registers Helmet to set secure HTTP headers for all routes.
 * Allows the external Leaflet/OpenStreetMap assets used by `/weather/map`.
 */
app.register(helmet, {
    global: true,
    referrerPolicy: {
        policy: "strict-origin-when-cross-origin",
    },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            baseUri: ["'self'"],
            scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            imgSrc: [
                "'self'",
                "data:",
                "blob:",
                "https://tile.openstreetmap.org",
                "https://*.tile.openstreetmap.org",
                "https://cdn.jsdelivr.net",
            ],
            fontSrc: ["'self'", "data:", "https://cdn.jsdelivr.net"],
            connectSrc: ["'self'"],
        },
    },
});
/**
 * Registers the Handlebars view engine used by the HTML pages.
 */
app.register(fastifyView, {
    engine: {
        handlebars,
    },
    root: path.join(process.cwd(), "views"),
});
/**
 * Serves static assets such as icons, JavaScript, and the favicon.
 */
app.register(fastifyStatic, {
    root: path.join(process.cwd(), "public"),
    prefix: "/assets/",
});
/**
 * Applies a global rate limit of 100 requests per minute to all routes.
 */
await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
});
/**
 * Serves the SVG favicon directly for modern browsers.
 */
app.get("/favicon.svg", async (_request, reply) => {
    return reply.type("image/svg+xml").sendFile("favicon.svg");
});
/**
 * Serves the same favicon for `/favicon.ico` requests for compatibility.
 */
app.get("/favicon.ico", async (_request, reply) => {
    return reply.type("image/svg+xml").sendFile("favicon.svg");
});
/**
 * Registers the weather feature routes, including HTML and API endpoints.
 */
app.register(weatherRoutes(app.log));
/**
 * Registers the health-check endpoint used for service monitoring.
 */
app.register(healthRoutes);
export default app;
//# sourceMappingURL=app.js.map