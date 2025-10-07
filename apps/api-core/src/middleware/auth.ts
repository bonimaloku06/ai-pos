import { FastifyRequest, FastifyReply } from "fastify";

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: "Unauthorized" });
  }
}

export function authorize(allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const user = request.user as any;

      if (!allowedRoles.includes(user.role)) {
        return reply.status(403).send({ error: "Forbidden" });
      }
    } catch (err) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  };
}