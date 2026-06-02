export async function publishViaBuffer(
  accessToken: string,
  profileId: string,
  content: string,
  mediaUrls?: string[]
): Promise<string> {
  const url = "https://api.bufferapp.com/1/updates/create.json";

  const body: any = {
    text: content,
    profile_ids: [profileId],
    now: true,
    shorten: false,
  };

  if (mediaUrls && mediaUrls.length > 0) {
    let mediaUrl = mediaUrls[0];
    const picIndex = mediaUrl.indexOf("/pic/");
    if (picIndex !== -1) {
      const pathPart = mediaUrl.substring(picIndex + 5);
      try {
        mediaUrl = `https://pbs.twimg.com/${decodeURIComponent(pathPart)}`;
      } catch {
        mediaUrl = `https://pbs.twimg.com/${pathPart.replace(/%2F/g, "/")}`;
      }
    }
    body.media = {
      picture: mediaUrl,
      thumbnail: mediaUrl,
    };
  }

  console.log(`[BufferProvider] Sending post to Buffer profile ${profileId}...`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Buffer API returned status ${res.status}: ${errorText}`);
  }

  const data = await res.json();
  if (data.updates && data.updates.length > 0) {
    console.log(`[BufferProvider] Post created successfully on Buffer. Update ID: ${data.updates[0].id}`);
    return data.updates[0].id;
  }
  
  console.log(`[BufferProvider] Post created successfully on Buffer. Response ID: ${data.id || "unknown"}`);
  return data.id || "buffer-update";
}
