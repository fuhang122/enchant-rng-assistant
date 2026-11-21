#!/bin/bash
# 手工打 APK（无 gradle）。用法：./build_apk.sh <versionCode> <versionName>
set -e
VC=${1:-18}; VN=${2:-2.7}
cd /root/workspace/apk
AJ=/usr/lib/android-sdk/platforms/android-23/android.jar
D8=/opt/bt34/android-14/d8
rm -rf gen res.zip base.apk classes dexout withdex.apk 附魔台RNG助手.apk.idsig
mkdir -p gen classes dexout

/usr/bin/aapt2 compile --dir res -o res.zip
/usr/bin/aapt2 link -o base.apk -I "$AJ" --manifest AndroidManifest.xml -R res.zip \
  --java gen -A assets --min-sdk-version 21 --target-sdk-version 30 \
  --version-code "$VC" --version-name "$VN"

javac -source 8 -target 8 -bootclasspath "$AJ" -d classes $(find java gen -name '*.java') 2>&1 | grep -v "^注:" || true
"$D8" --lib "$AJ" --min-api 21 --output dexout $(find classes -name '*.class')

python3 - <<'PY'
import zipfile
z = zipfile.ZipFile('base.apk', 'a', zipfile.ZIP_DEFLATED)
z.write('dexout/classes.dex', 'classes.dex')
z.close()
PY

/usr/bin/zipalign -f -p 4 base.apk withdex.apk
/usr/bin/apksigner sign --ks ks.jks --ks-pass pass:dsh123456 --key-pass pass:dsh123456 \
  --out 附魔台RNG助手.apk withdex.apk
/usr/bin/apksigner verify --print-certs 附魔台RNG助手.apk | head -3
ls -l 附魔台RNG助手.apk
