import db from "./db";

const settingsCache: Record<string, string> = {};

export async function getSystemSetting(key: string): Promise<string> {
  if (settingsCache[key] !== undefined) {
    return settingsCache[key];
  }

  try {
    const setting = await db.systemSetting.findUnique({
      where: { key }
    });

    if (setting) {
      settingsCache[key] = setting.value;
      return setting.value;
    }

    // Fallback to process.env and auto-initialize in the database
    const envValue = process.env[key] || "";
    
    if (envValue) {
      await db.systemSetting.upsert({
        where: { key },
        create: { key, value: envValue },
        update: { value: envValue }
      });
      settingsCache[key] = envValue;
      console.log(`[SystemSetting] Initialized key "${key}" in database from .env`);
    }

    return envValue;
  } catch (err) {
    console.error(`[SystemSetting] Error reading setting for key "${key}":`, err);
    return process.env[key] || "";
  }
}

export async function updateSystemSetting(key: string, value: string): Promise<void> {
  await db.systemSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value }
  });
  settingsCache[key] = value;
  console.log(`[SystemSetting] Updated key "${key}" to "${value}"`);
}

export function clearSettingsCache() {
  for (const key in settingsCache) {
    delete settingsCache[key];
  }
}
