import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  return new PrismaClient();
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

// We use a proxy or a lazy initializer to prevent the build process from crashing
// when the DATABASE_URL is missing or invalid during the static optimization phase.
const db = new Proxy({} as PrismaClient, {
  get(target, prop, receiver) {
    // If we are accessing a property on the prisma client, initialize it now
    const instance = globalThis.prisma ?? prismaClientSingleton();
    if (process.env.NODE_ENV !== "production") globalThis.prisma = instance;
    
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});

export default db;
