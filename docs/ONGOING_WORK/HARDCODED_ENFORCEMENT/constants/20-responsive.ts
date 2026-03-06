// Source: HARDCODED-ENFORCEMENT-VALUES.md section 22

export interface Viewport {
  width: number;
  height: number;
  name: string;
}

export const RESPONSIVE_VIEWPORTS: Viewport[] = [
  { width: 375, height: 812, name: "mobile" },
  { width: 768, height: 1024, name: "tablet" },
  { width: 1440, height: 900, name: "desktop" },
];
