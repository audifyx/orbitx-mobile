import Svg, { Polyline } from "react-native-svg";

export default function Sparkline({
  data,
  width = 96,
  height = 32,
  positive,
}: {
  data: number[];
  width?: number;
  height?: number;
  positive: boolean;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data
    .map((v, i) => `${((i / (data.length - 1)) * width).toFixed(1)},${(height - 3 - ((v - min) / span) * (height - 6)).toFixed(1)}`)
    .join(" ");
  const color = positive ? "#00c853" : "#ff5252";
  return (
    <Svg width={width} height={height}>
      <Polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
