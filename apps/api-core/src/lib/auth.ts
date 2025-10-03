import bcrypt from "bcrypt";
import { prisma } from "./prisma.js";

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createUser(email: string, password: string, role: "ADMIN" | "MANAGER" | "CASHIER" = "CASHIER", storeId?: string) {
  const passwordHash = await hashPassword(password);

  return prisma.user.create({
    data: {
      email,
      passwordHash,
      role,
      storeId,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      role: true,
      storeId: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export async function validateUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.isActive) {
    return null;
  }

  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    storeId: user.storeId,
  };
}