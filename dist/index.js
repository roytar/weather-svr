import app from "./app.js";
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
/**
 * Boots the Fastify server and logs the primary endpoints.
 */
const start = async () => {
    try {
        await app.listen({ port: PORT, host: "0.0.0.0" });
        app.log.info(`Weather server listening on http://localhost:${PORT}`);
        app.log.info(`Health check: http://localhost:${PORT}/health`);
        app.log.info(`Weather API: http://localhost:${PORT}/weather?address=New%20York`);
        app.log.info(`Weather text: http://localhost:${PORT}/weather/text?address=New%20York`);
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};
start();
//# sourceMappingURL=index.js.map