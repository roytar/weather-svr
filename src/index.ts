import process from "node:process";

try {
  process.loadEnvFile?.();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
    throw error;
  }
}

const { default: app } = await import("./app.js");

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

/**
 * Boots the Fastify server and logs the primary endpoints.
 */
const start = async () => {
  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    app.log.info(`Weather Explorer: http://localhost:${PORT}/`);
    app.log.info(`Health check: http://localhost:${PORT}/health`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
