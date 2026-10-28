import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const profile = JSON.parse(
  readFileSync(new URL("../eas.json", import.meta.url)),
).build.staging;
assert.equal(profile.env.RELEASE_CHANNEL, "staging");
assert.equal(
  profile.env.EXPO_PUBLIC_BFF_API_URL,
  "http://api.192.168.21.122.nip.io:8080",
);
const env = { ...process.env, ...profile.env, EXPO_NO_DOTENV: "1" };
delete env.SENTRY_AUTH_TOKEN;
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} failed`);
}

// Preserve generated native state and the existing local debug signing key.
run(
  "pnpm",
  [
    "exec",
    "expo",
    "prebuild",
    "--platform",
    "android",
    "--no-install",
    "--no-clean",
  ],
  root,
);
const manifest = readFileSync(
  new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url),
  "utf8",
);
assert.match(manifest, /android:usesCleartextTraffic="true"/);
assert.match(
  manifest,
  /android:name="expo\.modules\.updates\.ENABLED" android:value="false"/,
);
run("./gradlew", profile.android.gradleCommand.split(" "), `${root}/android`);
