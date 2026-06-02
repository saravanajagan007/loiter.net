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
    body.media = {
      photo: mediaUrls[0],
      thumbnail: mediaUrls[0],
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
