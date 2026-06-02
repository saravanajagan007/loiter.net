import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const prismaClientSingleton = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not defined");
  }
  
  try {
    const parsed = new URL(connectionString);
    const host = parsed.hostname;
    const port = parsed.port ? parseInt(parsed.port, 10) : 3306;
    const user = decodeURIComponent(parsed.username);
    const password = decodeURIComponent(parsed.password);
    const database = parsed.pathname.substring(1); // remove leading '/'
    
    const queryOptions: Record<string, any> = {};
    parsed.searchParams.forEach((val, key) => {
      if (val === "true") queryOptions[key] = true;
      else if (val === "false") queryOptions[key] = false;
      else if (!isNaN(Number(val))) queryOptions[key] = Number(val);
      else queryOptions[key] = val;
    });

    const poolConfig = {
      host,
      port,
      user,
      password,
      database,
      connectTimeout: 10000, // 10s connection timeout (default is 1s in Prisma adapter)
      acquireTimeout: 20000, // 20s acquire timeout (default is 10s)
      ...queryOptions
    };

    const adapter = new PrismaMariaDb(poolConfig);
    return new PrismaClient({ adapter });
  } catch (err) {
    console.error("[PrismaDB] Error parsing DATABASE_URL, falling back to connection string:", err);
    const adapter = new PrismaMariaDb(connectionString);
    return new PrismaClient({ adapter });
  }
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

let cachedPrisma: ReturnType<typeof prismaClientSingleton> | undefined;

// We use a proxy or a lazy initializer to prevent the build process from crashing
// when the DATABASE_URL is missing or invalid during the static optimization phase.
const db = new Proxy({} as PrismaClient, {
  get(target, prop, receiver) {
    if (!cachedPrisma) {
      cachedPrisma = globalThis.prisma ?? prismaClientSingleton();
      if (process.env.NODE_ENV !== "production") {
        globalThis.prisma = cachedPrisma;
      }
    }
    
    const value = Reflect.get(cachedPrisma, prop, receiver);
    return typeof value === 'function' ? value.bind(cachedPrisma) : value;
  }
});

export default db;
