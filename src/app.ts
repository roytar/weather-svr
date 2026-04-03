import Fastify from "fastify";
import fastifyView from "@fastify/view";
import fastifyStatic from "@fastify/static";
import handlebars from "handlebars";
import path from "node:path";
import { weatherRoutes, healthRoutes } from "./routes/index.js";
import { cors } from "./plugins/index.js";

/**
 * Formats a Date into a local ISO-8601-like timestamp with timezone offset.
 *
 * @param date Date instance to format.
 * @returns Timestamp string suitable for structured logs.
 */
function localIsoTimestamp(date: Date): string {
  const pad = (value: number, size = 2) => String(value).padStart(size, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const millis = pad(date.getMilliseconds(), 3);

  const offsetMinutes = -date.getTimezoneOffset();
  const offsetSign = offsetMinutes >= 0 ? "+" : "-";
  const absOffsetMinutes = Math.abs(offsetMinutes);
  const offsetHoursPart = pad(Math.floor(absOffsetMinutes / 60));
  const offsetMinutesPart = pad(absOffsetMinutes % 60);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${millis}${offsetSign}${offsetHoursPart}:${offsetMinutesPart}`;
}

const app = Fastify({
  logger: {
    timestamp: () => `,"time":"${localIsoTimestamp(new Date())}"`,
  },
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
