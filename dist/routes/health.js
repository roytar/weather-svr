/**
 * Registers the health-check route.
 *
 * @param fastify Fastify server instance.
 */
export async function healthRoutes(fastify) {
    fastify.get("/health", async (request, reply) => {
        return { status: "ok", timestamp: new Date().toISOString() };
    });
}
//# sourceMappingURL=health.js.map