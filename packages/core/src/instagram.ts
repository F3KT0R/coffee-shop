/**
 * Instagram handles, as pasted by the owner from a chat: "@ana.kafa", "ana.kafa",
 * "https://www.instagram.com/ana.kafa/", "instagram.com/ana.kafa?igsh=..." or "https://ig.me/m/ana.kafa".
 * Instagram usernames are 1-30 characters of letters, digits, "." and "_".
 */
const HANDLE = /^[a-z0-9._]{1,30}$/;

export function normalizeInstagramHandle(input: string): string | null {
  let value = input.trim();
  const fromUrl = value.match(/(?:instagram\.com|ig\.me\/m)\/([^/?#\s]+)/i);
  if (fromUrl) value = fromUrl[1]!;
  value = value.replace(/^@/, '').toLowerCase();
  return HANDLE.test(value) && !/^\.|\.$|\.\./.test(value) ? value : null;
}

/** Opens a direct-message thread with the account (works in the app and on the web). */
export function instagramDmUrl(handle: string): string {
  return `https://ig.me/m/${handle}`;
}
