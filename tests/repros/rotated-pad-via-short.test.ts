import { expect, test } from "bun:test";
import type { AnyCircuitElement, PcbVia } from "circuit-json";
import { findBitmapShorts } from "lib/index";
import { writeOrCompareBitmapSnapshot } from "tests/fixtures/bitmap-snapshot";

test("checks a rotated rounded pad against foreign via copper on a six-layer board", async () => {
  const board: AnyCircuitElement = {
    type: "pcb_board",
    pcb_board_id: "board",
    center: { x: 0, y: 0 },
    width: 4,
    height: 4,
    num_layers: 6,
    thickness: 1.6,
    material: "fr4",
  };
  const pad: AnyCircuitElement = {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pad_A",
    pcb_component_id: "component_A",
    shape: "rotated_rect",
    layer: "top",
    x: 0,
    y: 0,
    width: 2.2,
    height: 0.24,
    ccw_rotation: 45,
    corner_radius: 0.06,
    is_covered_with_solder_mask: false,
  };
  const via: PcbVia = {
    type: "pcb_via",
    pcb_via_id: "via_B",
    x: 0.65,
    y: 0.65,
    outer_diameter: 0.3,
    hole_diameter: 0.15,
    layers: ["top", "inner1", "inner2", "inner3", "inner4", "bottom"],
  };
  // The first via is on the pad's long axis. The second clears its copper.
  const touching = [board, pad, via];
  const clear = [board, pad, { ...via, x: 0.85, y: 0 }];
  const options = { layer: "top" as const, width: 320, height: 320 };
  expect(
    await findBitmapShorts(touching, { ...options, mode: "pcb" }),
  ).toHaveLength(1);
  expect(
    await findBitmapShorts(clear, { ...options, mode: "pcb" }),
  ).toHaveLength(0);
  const gerber = await writeOrCompareBitmapSnapshot(
    import.meta.path,
    "gerber-bitmap",
    touching,
    { ...options, mode: "gerber" },
  );
  expect(gerber).toHaveLength(0);
  expect(
    await findBitmapShorts(clear, { ...options, mode: "gerber" }),
  ).toHaveLength(1);
});
