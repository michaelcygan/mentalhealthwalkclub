#!/usr/bin/env node
/**
 * One-shot script to build the ambient loop banner.
 * - Downloads the 4 source clips (CDN .asset.json pointers).
 * - Re-encodes each to 1280x720, ~1.2 Mbps, 30fps, no audio.
 * - Concatenates with 0.8s xfade dissolves, including a wrap dissolve
 *   from scene 4 back to scene 1 so the loop is seamless.
 * - Outputs loop.mp4, loop.webm, loop-poster.jpg in public/videos/ambient/.
 *
 * Idempotent. Run with: node scripts/build-ambient-loop.mjs
 */
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const AMBIENT_DIR = resolve(ROOT, "public/videos/ambient");
const TMP = resolve(ROOT, ".tmp/ambient");
mkdirSync(TMP, { recursive: true });

const SCENE_ORDER = ["suburban-il-2", "rural-co-2", "nyc-2", "coastal-pnw"];
const SCENE_DURATION = 10;
const XFADE = 0.8;

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function sh(cmd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

async function main() {
  // 1. Resolve and download each source clip.
  const localPaths = [];
  for (const slug of SCENE_ORDER) {
    const ptrPath = resolve(AMBIENT_DIR, `${slug}.mp4.asset.json`);
    const ptr = JSON.parse(readFileSync(ptrPath, "utf8"));
    const cdnUrl = ptr.url.startsWith("http") ? ptr.url : `https://id-preview--98b64404-6fc6-4b86-809a-ea60cfd93f8d.lovable.app${ptr.url}`;
    const local = resolve(TMP, `${slug}.src.mp4`);
    if (!existsSync(local)) {
      console.log(`Downloading ${slug} from ${cdnUrl}`);
      const buf = await fetchBuffer(cdnUrl);
      writeFileSync(local, buf);
      console.log(`  → ${(buf.length / 1024 / 1024).toFixed(1)} MB`);
    } else {
      console.log(`Using cached ${slug}`);
    }
    localPaths.push(local);
  }

  // 2. Re-encode each scene to 720p, 30fps, ~1.2Mbps, no audio.
  const enc = [];
  for (let i = 0; i < SCENE_ORDER.length; i++) {
    const out = resolve(TMP, `${i}.enc.mp4`);
    sh([
      `ffmpeg -y -i "${localPaths[i]}"`,
      `-vf "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=30,setsar=1"`,
      `-an -c:v libx264 -preset medium -b:v 1200k -maxrate 1500k -bufsize 2400k -pix_fmt yuv420p`,
      `-movflags +faststart`,
      `"${out}"`,
    ].join(" "));
    enc.push(out);
  }

  // 3. Build xfade chain. We want a seamless loop, so we duplicate scene 0 at
  //    the end and crossfade into it, then trim the trailing copy out.
  //    Total length = N * D - (N) * XFADE  (with N transitions, including wrap).
  const N = enc.length;
  const D = SCENE_DURATION;
  // Build ffmpeg filter for chained xfade.
  // Inputs: 0..N-1 + repeat of 0 at index N
  const inputs = [...enc, enc[0]].map((p) => `-i "${p}"`).join(" ");
  // xfade timing: each next clip enters at (currentChainEnd - XFADE).
  // chainEnd_k after xfade k = chainEnd_{k-1} + D - XFADE
  let filter = "";
  let prev = "0:v";
  let chainEnd = D; // duration of [0]
  for (let k = 1; k <= N; k++) {
    const offset = chainEnd - XFADE;
    const out = (k === N) ? "vout" : `v${k}`;
    filter += `[${prev}][${k}:v]xfade=transition=fade:duration=${XFADE}:offset=${offset}[${out}];`;
    prev = out;
    chainEnd = chainEnd + D - XFADE;
  }
  // Trim final XFADE seconds off the tail (the wrap-into-clip0 reveal).
  // But xfade output ends right at chainEnd because last input is D long.
  // We want final length = chainEnd - XFADE so the loop wraps cleanly.
  const totalDur = chainEnd - XFADE;
  filter = filter.replace("[vout]", "[vfull]") + `[vfull]trim=duration=${totalDur},setpts=PTS-STARTPTS[vfinal]`;

  const loopMp4 = resolve(AMBIENT_DIR, "loop.mp4");
  sh([
    `ffmpeg -y ${inputs}`,
    `-filter_complex "${filter}"`,
    `-map "[vfinal]" -an`,
    `-c:v libx264 -preset slow -b:v 1300k -maxrate 1700k -bufsize 3400k -pix_fmt yuv420p`,
    `-movflags +faststart`,
    `"${loopMp4}"`,
  ].join(" "));

  // 4. WebM (VP9).
  const loopWebm = resolve(AMBIENT_DIR, "loop.webm");
  sh([
    `ffmpeg -y -i "${loopMp4}"`,
    `-c:v libvpx-vp9 -b:v 900k -row-mt 1 -deadline good -cpu-used 4`,
    `-an "${loopWebm}"`,
  ].join(" "));

  // 5. Poster.
  const poster = resolve(AMBIENT_DIR, "loop-poster.jpg");
  sh(`ffmpeg -y -i "${loopMp4}" -frames:v 1 -q:v 4 "${poster}"`);

  console.log("\nDone.");
  for (const f of [loopMp4, loopWebm, poster]) {
    const sz = statSync(f).size;
    console.log(`  ${f}  →  ${(sz / 1024 / 1024).toFixed(2)} MB`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
