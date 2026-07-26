const RADIAN = Math.PI / 180;

export interface PieLabelEntry {
  name: string;
  value: number;
  percentage: number;
}

/**
 * Gives every slice at least `minPercent`% of the pie's visual weight, so
 * tiny slices are still visible, WITHOUT changing the real `percentage` used
 * for labels/tooltips/legend — only the rendered wedge size is adjusted.
 * Larger slices are proportionally compressed to make room, but keep their
 * relative size versus each other.
 *
 * Pass the result as `data` with `dataKey="displayValue"` on <Pie>, while
 * still reading `.value`/`.percentage` (unchanged) everywhere else (labels,
 * Tooltip via `props.payload`, legend).
 */
export function withMinDisplayShare<T extends { percentage: number }>(
  entries: T[],
  minPercent: number
): (T & { displayValue: number })[] {
  return entries.map((entry) => ({
    ...entry,
    displayValue: Math.max(entry.percentage, minPercent),
  }));
}

/**
 * Renders a pie slice label with a "bent"/elbow connector line (radial
 * segment out to the pie edge, then a horizontal segment to the label) —
 * Recharts' standard "Customized Label" pattern — instead of a straight line
 * radiating from the pie center, which collides badly once several slices'
 * angles are close together. Pass with `labelLine={false}` since this draws
 * its own connector.
 */
export function renderElbowPieLabel(
  entries: PieLabelEntry[],
  formatValue: (value: number) => string
) {
  return (props: any) => {
    const { cx, cy, midAngle, outerRadius, index } = props;
    const entry = entries[index];
    if (!entry) return null;

    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const sx = cx + outerRadius * cos;
    const sy = cy + outerRadius * sin;
    const mx = cx + (outerRadius + 18) * cos;
    const my = cy + (outerRadius + 18) * sin;
    const side = cos >= 0 ? 1 : -1;
    const ex = mx + side * 14;
    const ey = my;
    const textAnchor = side >= 0 ? "start" : "end";
    const textX = ex + side * 4;

    return (
      <g>
        <path
          d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
          stroke="#94a3b8"
          strokeWidth={1}
          fill="none"
        />
        <circle cx={sx} cy={sy} r={2} fill="#94a3b8" stroke="none" />
        <text
          x={textX}
          y={ey - 6}
          textAnchor={textAnchor}
          dominantBaseline="central"
          fontSize={12}
          className="fill-zinc-700 dark:fill-zinc-300"
        >
          {entry.name}
        </text>
        <text
          x={textX}
          y={ey + 7}
          textAnchor={textAnchor}
          dominantBaseline="central"
          fontSize={11}
          fontWeight={700}
          className="fill-zinc-500 dark:fill-zinc-400"
        >
          {`${entry.percentage.toFixed(2)}% · ${formatValue(entry.value)}`}
        </text>
      </g>
    );
  };
}
