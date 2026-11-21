#!/usr/bin/env bash
# 一键构建：WASM 内核 → 数据表 → 单文件网页版（根目录 index.html / full.html / tutorial.html）
set -e
cd "$(dirname "$0")"

# 1. 扫描内核（需要 clang + wasm32 目标；产物已随仓库提供，可跳过）
if [ ! -f src/wasm/scan2.wasm ]; then
  clang --target=wasm32 -O3 -nostdlib -Wl,--no-entry -Wl,--export-all \
        -o src/wasm/scan2.wasm src/wasm/scan2.c
fi

# 2. 从 Minecraft 26.3 数据包提取附魔/物品表（data/ 已随仓库提供）
python3 src/gen_data.py

# 3. 拼装单文件网页
python3 src/build_all.py

cp src/wiz/wizard.html index.html
cp src/build/app_themed.html full.html
cp src/build/tutorial_themed.html tutorial.html
echo "done: index.html / full.html / tutorial.html"
