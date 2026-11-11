import { expect } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import looksSame from "@tscircuit/image-utils/looks-same";
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg";
import {
  appendBitmapLegend,
  encodeRgbaPng,
  renderBitmapShortDebug,
} from "lib/index";
import { decode } from "fast-png";
import { createAlphabetTextSvg } from "lib/png";
import { renderSvgToPng } from "lib/svg-to-png";
import type {
  BitmapShort,
  BitmapShortDebugRender,
  FindBitmapShortsOptions,
} from "lib/index";
import type { AnyCircuitElement } from "circuit-json";

const getSnapshotPath = (
  testPath: string,
  snapshotSuffix: string,
  extension: "png" | "svg",
) => {
  const normalizedTestPath = testPath.replace(/\.test\.tsx?$/, "");
  const snapshotDir = join(dirname(normalizedTestPath), "__snapshots__");

  return {
    snapshotDir,
    snapshotPath: join(
      snapshotDir,
      `${basename(normalizedTestPath)}-${snapshotSuffix}.snap.${extension}`,
    ),
  };
};

export const writeOrCompareSvgSnapshot = async (
  testPath: string,
  svg: string,
  snapshotSuffix = "short-debug",
) => {
  const { snapshotDir, snapshotPath } = getSnapshotPath(
    testPath,
    snapshotSuffix,
    "svg",
  );

  mkdirSync(snapshotDir, { recursive: true });

  if (!existsSync(snapshotPath) || Bun.env.BUN_UPDATE_SNAPSHOTS) {
    writeFileSync(snapshotPath, svg);
    return;
  }

  const result = await looksSame(
    renderSvgToPng(readFileSync(snapshotPath, "utf8")),
    renderSvgToPng(svg),
    {
      strict: true,
      ignoreAntialiasing: false,
      ignoreCaret: false,
    },
  );
  expect(result.equal).toBe(true);
};

export const writeOrCompareCircuitJsonSvgSnapshot = async (
  testPath: string,
  circuitJson: AnyCircuitElement[],
  options?: Parameters<typeof convertCircuitJsonToPcbSvg>[1],
): Promise<void> =>
  writeOrCompareSvgSnapshot(
    testPath,
    convertCircuitJsonToPcbSvg(circuitJson, options),
    "pcb",
  );

export const writeOrCompareBinarySnapshot = (
  testPath: string,
  snapshotSuffix: string,
  bytes: Uint8Array,
): Promise<void> | void => {
  const { snapshotDir, snapshotPath } = getSnapshotPath(
    testPath,
    snapshotSuffix,
    "png",
  );

  mkdirSync(snapshotDir, { recursive: true });

  if (!existsSync(snapshotPath) || Bun.env.BUN_UPDATE_SNAPSHOTS) {
    writeFileSync(snapshotPath, bytes);
    return;
  }

  return looksSame(readFileSync(snapshotPath), bytes, {
    strict: true,
    ignoreAntialiasing: false,
    ignoreCaret: false,
  }).then((result) => {
    expect(result.equal).toBe(true);
  });
};

type ShortSnapshotCaption = {
  title: string;
  geometry: string;
  expectedShorts: number;
};

export const writeOrCompareBitmapSnapshot = async (
  testPath: string,
  snapshotSuffix: string,
  circuitJson: AnyCircuitElement[],
  options: FindBitmapShortsOptions,
  caption?: ShortSnapshotCaption,
): Promise<BitmapShort[]> => {
  const debugRender = await renderBitmapShortDebug(circuitJson, options);

  return writeOrCompareBitmapDebugSnapshot(
    testPath,
    snapshotSuffix,
    debugRender,
    caption,
  );
};

export const writeOrCompareBitmapDebugSnapshot = async (
  testPath: string,
  snapshotSuffix: string,
  debugRender: BitmapShortDebugRender,
  caption?: ShortSnapshotCaption,
): Promise<BitmapShort[]> => {
  let image = appendBitmapLegend(debugRender);
  if (caption) {
    const height = 86;
    const lines = [
      createAlphabetTextSvg({
        text: caption.title,
        x: 12,
        top: 9,
        size: 21,
        maxWidth: image.width - 24,
      }),
      createAlphabetTextSvg({
        text: caption.geometry,
        x: 12,
        top: 39,
        size: 15,
        maxWidth: image.width - 24,
      }),
      createAlphabetTextSvg({
        text: `Shorts expected ${caption.expectedShorts} / detected ${debugRender.shorts.length}`,
        x: 12,
        top: 61,
        size: 15,
        maxWidth: image.width - 24,
      }),
    ];
    const header = decode(
      renderSvgToPng(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${image.width}" height="${height}"><rect width="100%" height="100%" fill="white"/>${lines.join("")}</svg>`,
      ),
    );
    if (header.channels !== 4 || header.depth !== 8) {
      throw new Error("Expected an RGBA snapshot caption");
    }
    const rgba = new Uint8Array(header.data.length + image.rgba.length);
    rgba.set(header.data);
    rgba.set(image.rgba, header.data.length);
    image = { ...image, height: image.height + height, rgba };
  }
  await writeOrCompareBinarySnapshot(
    testPath,
    snapshotSuffix,
    encodeRgbaPng(image),
  );

  return debugRender.shorts;
};
