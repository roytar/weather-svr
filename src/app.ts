import Fastify from "fastify";
import fastifyView from "@fastify/view";
import fastifyStatic from "@fastify/static";
import handlebars from "handlebars";
import path from "node:path";
import { weatherRoutes, healthRoutes } from "./routes/index.js";
import { cors } from "./plugins/index.js";

const app = Fastify({
  logger: true,
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

// Register routes
// http://localhost:3000/weather?address=48%20Darrow%20Street%2008882
app.register(weatherRoutes);
app.register(healthRoutes);

export default app;
