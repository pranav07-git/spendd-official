import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

type IconProps = { size?: number; color?: string };

export function ArrowLeftIcon({ size = 24, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 12H4M10 6l-6 6 6 6" stroke={color} strokeWidth={2} strokeLinecap="square" />
    </Svg>
  );
}

export function ArrowRightIcon({ size = 24, color = colors.background }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12h16M14 6l6 6-6 6" stroke={color} strokeWidth={2} strokeLinecap="square" />
    </Svg>
  );
}

export function AccountIcon({ size = 24, color = '#8A8A8A' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z"
      />
    </Svg>
  );
}

export function BackspaceIcon({ size = 24, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 5h13v14H8l-6-7 6-7z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M11.5 9.5l5 5M16.5 9.5l-5 5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function FileUploadIcon({ size = 28 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M14 2H6.5A1.5 1.5 0 0 0 5 3.5v17A1.5 1.5 0 0 0 6.5 22h11a1.5 1.5 0 0 0 1.5-1.5V7z" fill={colors.text} />
      <Path d="M14 2v5h5" fill="#CFCFCF" />
      <Path d="M12 18v-6.5M9.25 14.25 12 11.5l2.75 2.75" stroke={colors.background} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function FileCheckIcon({ size = 28 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M14 2H6.5A1.5 1.5 0 0 0 5 3.5v17A1.5 1.5 0 0 0 6.5 22h11a1.5 1.5 0 0 0 1.5-1.5V7z" fill={colors.text} />
      <Path d="M14 2v5h5" fill="#CFCFCF" />
      <Path d="M8.75 15l2.25 2.25 4.25-4.5" stroke={colors.background} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CheckboxCheckedIcon({ size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Rect x={1} y={1} width={18} height={18} rx={2} fill={colors.text} />
      <Path d="M5.5 10.2l3 3 6-6.4" stroke={colors.background} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CheckboxEmptyIcon({ size = 20, color = '#6A6A6A' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Rect x={1.5} y={1.5} width={17} height={17} rx={1} stroke={color} strokeWidth={1.5} fill="none" />
    </Svg>
  );
}

export function CrossIcon({ size = 16, color = '#5A5A5A' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path d="M2 2l12 12M14 2L2 14" stroke={color} strokeWidth={1.2} />
    </Svg>
  );
}

export function CircleCrossIcon({ size = 20, color = colors.danger }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9.5} stroke={color} strokeWidth={1.6} />
      <Path d="M8.75 8.75l6.5 6.5M15.25 8.75l-6.5 6.5" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function LockIcon({ size = 24, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4.5} y={10.5} width={15} height={11} rx={1} stroke={color} strokeWidth={1.6} />
      <Path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" stroke={color} strokeWidth={1.6} />
      <Circle cx={12} cy={16} r={1.4} fill={color} />
    </Svg>
  );
}

export function ChartIcon({ size = 24, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3.5} y={3.5} width={17} height={17} stroke={color} strokeWidth={1.6} />
      <Path d="M8 17v-3M11 17v-5M14 17V9M17 17v-6" stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}

export function TrashCrossIcon({ size = 24, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5.5h16M9 3h6" stroke={color} strokeWidth={1.6} />
      <Path d="M6 5.5V21h12V5.5" stroke={color} strokeWidth={1.6} />
      <Path d="M9.5 10.5l5 5M14.5 10.5l-5 5" stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}

// Path data adapted from Lucide's "fingerprint" icon (ISC licence).
export function FingerprintIcon({ size = 24, color = colors.text, strokeWidth = 1.5 }: IconProps & { strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {[
        'M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4',
        'M14 13.12c0 2.38 0 6.38-1 8.88',
        'M17.29 21.02c.12-.6.43-2.3.5-3.02',
        'M2 12a10 10 0 0 1 18-6',
        'M2 16h.01',
        'M21.8 16c.2-2 .131-5.354 0-6',
        'M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2',
        'M8.65 22c.21-.66.45-1.32.57-2',
        'M9 6.8a6 6 0 0 1 9 5.2v2',
      ].map(d => (
        <Path key={d} d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

type StrokeIconProps = IconProps & { strokeWidth?: number };

function StrokeIcon({ size = 24, color = colors.text, strokeWidth = 1.6, paths }: StrokeIconProps & { paths: string[] }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {paths.map(d => (
        <Path key={d} d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

export const BellIcon = (p: StrokeIconProps) => (
  <StrokeIcon {...p} paths={['M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z', 'M10 21h4']} />
);

export const WalletIcon = (p: StrokeIconProps) => (
  <StrokeIcon {...p} paths={['M4 6h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4z', 'M4 6V5a1 1 0 0 1 1-1h11', 'M14 11h6v4h-6z']} />
);

export const ReceiptIcon = (p: StrokeIconProps) => (
  <StrokeIcon {...p} paths={['M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21z', 'M9 8h6M9 12h6M9 16h3']} />
);

export const HomeIcon = (p: StrokeIconProps) => (
  <StrokeIcon {...p} paths={['M4 10.5 12 4l8 6.5V20h-5.5v-6h-5v6H4z']} />
);

export const BarChartIcon = (p: StrokeIconProps) => (
  <StrokeIcon {...p} paths={['M4 4h16v16H4z', 'M8.5 16v-2.5M12 16v-5M15.5 16V8.5']} />
);

export const UserIcon = (p: StrokeIconProps) => (
  <StrokeIcon {...p} paths={['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4.5 20.5c1-3.6 4-5.5 7.5-5.5s6.5 1.9 7.5 5.5']} />
);

export const BotIcon = (p: StrokeIconProps) => (
  <StrokeIcon
    {...p}
    paths={['M6 8h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z', 'M12 8V5', 'M9.5 12.5v.5M14.5 12.5v.5', 'M10 15.5h4', 'M3 12v2M21 12v2']}
  />
);

export const AlertTriangleIcon = (p: StrokeIconProps) => (
  <StrokeIcon {...p} paths={['M12 4 21 19.5H3z', 'M12 10v4', 'M12 16.8v.2']} />
);

export const FlameIcon = (p: StrokeIconProps) => (
  <StrokeIcon
    {...p}
    paths={['M12 21c-3.6 0-6-2.4-6-5.6 0-3.4 2.6-5.2 3.6-8.4 2 1.2 3 3 3 4.6 1-.6 1.6-1.6 1.8-2.8 2 1.6 3.6 3.8 3.6 6.6 0 3.2-2.4 5.6-6 5.6z', 'M12 21c-1.4 0-2.4-1-2.4-2.4 0-1.6 1.2-2.4 2.4-3.6 1.2 1.2 2.4 2 2.4 3.6 0 1.4-1 2.4-2.4 2.4z']}
  />
);

export const InfoIcon = (p: StrokeIconProps) => (
  <StrokeIcon {...p} paths={['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11v5', 'M12 7.8v.2']} />
);

export const ArrowDownIcon = (p: StrokeIconProps) => (
  <StrokeIcon {...p} paths={['M12 5v14', 'M6 13l6 6 6-6']} />
);

export const ArrowUpIcon = (p: StrokeIconProps) => (
  <StrokeIcon {...p} paths={['M12 19V5', 'M6 11l6-6 6 6']} />
);

export const ChevronRightIcon = (p: StrokeIconProps) => (
  <StrokeIcon {...p} paths={['M5 12h14', 'M13 6l6 6-6 6']} />
);

export const ChevronLeftIcon = (p: StrokeIconProps) => <StrokeIcon {...p} paths={['M15 5l-7 7 7 7']} />;

export const FilterIcon = (p: StrokeIconProps) => <StrokeIcon {...p} paths={['M3 4h18l-7 8.5V19l-4 2v-8.5z']} />;
