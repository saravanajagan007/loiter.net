import { PlatformType } from "@prisma/client";
import { SocialProvider } from "./types";
import { XProvider } from "./x-provider";

const providers: Record<PlatformType, SocialProvider> = {
  [PlatformType.X]: new XProvider(),
  // Future providers will be added here
  [PlatformType.LINKEDIN]: null as unknown as SocialProvider,
  [PlatformType.INSTAGRAM]: null as unknown as SocialProvider,
  [PlatformType.THREADS]: null as unknown as SocialProvider,
  [PlatformType.FACEBOOK]: null as unknown as SocialProvider,
  [PlatformType.TIKTOK]: null as unknown as SocialProvider,
  [PlatformType.REDDIT]: null as unknown as SocialProvider,
  [PlatformType.BLUESKY]: null as unknown as SocialProvider,
  [PlatformType.YOUTUBE]: null as unknown as SocialProvider,
};

export const getSocialProvider = (platform: PlatformType): SocialProvider => {
  const provider = providers[platform];
  if (!provider) {
    throw new Error(`Social provider for platform ${platform} not implemented.`);
  }
  return provider;
};
