// 打一个能装到手机上的 APK：node tools/build-apk.mjs
// 输出：dist/taskcard.apk（下次装到手机用 adb install 或直接传文件）
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SDK = process.env.ANDROID_SDK_ROOT || 'D:/Application/Android/Sdk';
const GRADLE = process.env.GRADLE_BIN || 'D:/Application/gradle/gradle-8.10.2/bin/gradle.bat';
const JAVA_HOME = process.env.JAVA_HOME || 'C:\\Program Files\\Java\\jdk-22';
const RELEASE = process.argv.includes('--release');
const APK = join(
  ROOT,
  'android',
  'app',
  'build',
  'outputs',
  'apk',
  RELEASE ? 'release' : 'debug',
  RELEASE ? 'app-release.apk' : 'app-debug.apk',
);
const OUT_DIR = join(ROOT, 'dist');
const VER = (() => {
  try {
    const g = readFileSync(join(ROOT, 'android', 'app', 'build.gradle.kts'), 'utf8');
    const m = g.match(/versionName\s*=\s*"([^"]+)"/);
    return m ? m[1] : 'dev';
  } catch {
    return 'dev';
  }
})();
const OUT = join(OUT_DIR, RELEASE ? `taskcard-${VER}-release.apk` : 'taskcard.apk');

if (!existsSync(GRADLE)) {
  console.error('没找到 Gradle。解压到 D:/Application/gradle/，或用 GRADLE_BIN 指向 gradle.bat。');
  process.exit(1);
}
if (!existsSync(join(SDK, 'platforms'))) {
  console.error(`Android SDK 不完整：${SDK}。先跑 node tools/install-android.mjs`);
  process.exit(1);
}
if (!existsSync(join(ROOT, 'android', 'local.properties'))) {
  console.error('缺 android/local.properties，里面要有 sdk.dir=...');
  process.exit(1);
}

console.log('[apk] 编译中…');
execSync(`"${GRADLE}" -p "${join(ROOT, 'android')}" ${RELEASE ? 'assembleRelease' : 'assembleDebug'} --no-daemon`, {
  stdio: 'inherit',
  env: { ...process.env, JAVA_HOME, GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || 'D:/Application/gradle/home' },
});

mkdirSync(OUT_DIR, { recursive: true });
copyFileSync(APK, OUT);
console.log(`[apk] 好了：${OUT}（${(statSync(OUT).size / 1024).toFixed(0)} KB）`);
console.log(`[apk] 装到手机：adb install -r "${OUT}"`);
