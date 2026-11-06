// 打一个能装到手机上的 APK：node tools/build-apk.mjs
// 输出：dist/taskcard.apk（下次装到手机用 adb install 或直接传文件）
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SDK = process.env.ANDROID_SDK_ROOT || 'D:\\Android\\Sdk';
const GRADLE = join(ROOT, 'tools', 'gradle', 'gradle-8.10.2', 'bin', 'gradle.bat');
const JAVA_HOME = process.env.JAVA_HOME || 'C:\\Program Files\\Java\\jdk-22';
const APK = join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const OUT_DIR = join(ROOT, 'dist');
const OUT = join(OUT_DIR, 'taskcard.apk');

if (!existsSync(GRADLE)) {
  console.error('没找到 Gradle。先跑一次 tools/install-android.mjs，并把 gradle 解压到 tools/gradle/。');
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
execSync(`"${GRADLE}" -p "${join(ROOT, 'android')}" assembleDebug --no-daemon`, {
  stdio: 'inherit',
  env: { ...process.env, JAVA_HOME, GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || 'D:\gradle-home' },
});

mkdirSync(OUT_DIR, { recursive: true });
copyFileSync(APK, OUT);
console.log(`[apk] 好了：${OUT}（${(statSync(OUT).size / 1024).toFixed(0)} KB）`);
console.log('[apk] 装到手机：adb install -r dist/taskcard.apk');
