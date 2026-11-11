import { expect, test } from "bun:test";
import { findBitmapShorts } from "lib/index";
import { writeOrCompareBitmapSnapshot } from "tests/fixtures/bitmap-snapshot";
import { getTestFixture } from "tests/fixtures/get-test-fixture";

async function boardWithVia(x: number, y: number) {
  const { circuit } = getTestFixture();
  circuit.add(
    <board width={4} height={4} layers={6} routingDisabled>
      <chip
        name="J1"
        footprint={
          <footprint>
            <smtpad
              portHints={["pin1"]}
              shape="rotated_rect"
              width={2.2}
              height={0.24}
              ccwRotation={45}
              cornerRadius={0.06}
              layer="top"
            />
          </footprint>
        }
      />
      <via
        name="V1"
        pcbX={x}
        pcbY={y}
        fromLayer="top"
        toLayer="bottom"
        outerDiameter={0.3}
        holeDiameter={0.15}
      />
    </board>,
  );
  await circuit.renderUntilSettled();
  return circuit.getCircuitJson();
}

const options = { layer: "top" as const, width: 320, height: 320 };

test("Gerber misses a via on the pad's 45-degree centerline", async () => {
  const board = await boardWithVia(0.65, 0.65);
  expect(
    await findBitmapShorts(board, { ...options, mode: "pcb" }),
  ).toHaveLength(1);
  const shorts = await writeOrCompareBitmapSnapshot(
    import.meta.path,
    "gerber-bitmap",
    board,
    { ...options, mode: "gerber" },
    {
      title: "Gerber repro - missed short",
      geometry: "Via touches the 45 degree pad",
      expectedShorts: 1,
    },
  );
  expect(shorts).toHaveLength(0);
});

test("Gerber reports a short after moving the via off the pad", async () => {
  const board = await boardWithVia(0.85, 0);
  expect(
    await findBitmapShorts(board, { ...options, mode: "pcb" }),
  ).toHaveLength(0);
  const shorts = await writeOrCompareBitmapSnapshot(
    import.meta.path,
    "clear-gerber-bitmap",
    board,
    { ...options, mode: "gerber" },
    {
      title: "Gerber repro - false short",
      geometry: "Via clears the 45 degree pad",
      expectedShorts: 0,
    },
  );
  expect(shorts).toHaveLength(1);
});
