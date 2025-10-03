import { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";
import { validateUser, createUser } from "../lib/auth.js";
import { authenticate } from "../middleware/auth.js";

export const authRoutes: FastifyPluginAsync = async (server) => {
  server.post("/login", async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    if (!email || !password) {
      return reply.status(400).send({ error: "Email and password are required" });
    }

    const user = await validateUser(email, password);

    if (!user) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    const accessToken = server.jwt.sign(
      { id: user.id, email: user.email, role: user.role, storeId: user.storeId },
      { expiresIn: "15m" }
    );

    const refreshToken = server.jwt.sign(
      { id: user.id, type: "refresh" },
      { expiresIn: "7d" }
    );

    // Store refresh token in database
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return {
      accessToken,
      refreshToken,
      user,
    };
  });

  server.post("/register", async (request, reply) => {
    const { email, password, role, storeId } = request.body as {
      email: string;
      password: string;
      role?: "ADMIN" | "MANAGER" | "CASHIER";
      storeId?: string;
    };

    if (!email || !password) {
      return reply.status(400).send({ error: "Email and password are required" });
    }

    if (password.length < 8) {
      return reply.status(400).send({ error: "Password must be at least 8 characters" });
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({ error: "User already exists" });
    }

    const user = await createUser(email, password, role, storeId);

    return { user };
  });

  server.post("/refresh", async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };

    if (!refreshToken) {
      return reply.status(400).send({ error: "Refresh token is required" });
    }

    try {
      const decoded = server.jwt.verify(refreshToken) as { id: string; type: string };

      if (decoded.type !== "refresh") {
        return reply.status(401).send({ error: "Invalid token type" });
      }

      // Check if token exists in database and is not expired
      const storedToken = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true },
      });

      if (!storedToken || storedToken.expiresAt < new Date()) {
        return reply.status(401).send({ error: "Invalid or expired refresh token" });
      }

      const user = storedToken.user;

      const newAccessToken = server.jwt.sign(
        { id: user.id, email: user.email, role: user.role, storeId: user.storeId },
        { expiresIn: "15m" }
      );

      return {
        accessToken: newAccessToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          storeId: user.storeId,
        },
      };
    } catch (err) {
      return reply.status(401).send({ error: "Invalid refresh token" });
    }
  });

  server.get("/me", { preHandler: authenticate }, async (request, reply) => {
    const userPayload = request.user as { id: string };

    const user = await prisma.user.findUnique({
      where: { id: userPayload.id },
      select: {
        id: true,
        email: true,
        role: true,
        storeId: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }

    return { user };
  });
};