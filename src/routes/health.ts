import { FastifyInstance } from "fastify";

/**
 * Registers the health-check route.
 *
 * @param fastify Fastify server instance.
 */
export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get("/health", async (request, reply) => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });
}
