import { jwtKeyManager } from "../../../shared/src/utils/JwtKeyManager.js";

(async () => {
  try {
    await jwtKeyManager.rotateKeys("bot");
    console.log("[RotateKeys] Bot keys rotated successfully");
  } catch (err) {
    console.error("[RotateKeys] Failed to rotate bot keys", err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
