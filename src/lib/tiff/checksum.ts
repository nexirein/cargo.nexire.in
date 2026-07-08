export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Cast needed because lib.dom's BufferSource now requires an
  // ArrayBuffer-backed view specifically; our inputs are always plain
  // ArrayBuffers at runtime (never SharedArrayBuffer), so this is safe.
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
