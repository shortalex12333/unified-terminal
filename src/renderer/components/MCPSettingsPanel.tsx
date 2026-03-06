/**
 * MCPSettingsPanel - Settings panel for MCP server connections
 *
 * Shows all available MCP integrations and their connection status.
 * Allows users to connect/disconnect from services proactively.
 *
 * Features:
 * - List of all available integrations grouped by category
 * - Connection status indicators
 * - One-click connect/disconnect
 * - API key entry for non-OAuth services
 * - Connection verification
 */

import React, { useState, useEffect, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface MCPServer {
  id: string;
  name: string;
  description: string;
  icon: string;
  oauthUrl?: string;
  tokenUrl?: string;
  requiredScopes: string[];
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  errorMessage?: string;
  requiresOAuth: boolean;
  category: string;
  docsUrl?: string;
}

interface MCPConnection {
  serverId: string;
  connectedAt: Date;
  expiresAt?: Date;
  userInfo?: {
    id?: string;
    email?: string;
    name?: string;
    avatar?: string;
  };
}

interface MCPSettingsPanelProps {
  /** Whether the panel is visible */
  isOpen: boolean;
  /** Callback to close the panel */
  onClose: () => void;
}

// ============================================================================
// ICONS (Same as MCPConnectionCard)
// ============================================================================

const SERVER_ICONS: Record<string, React.ReactNode> = {
  stripe: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z"/>
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  ),
  vercel: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M24 22.525H0l12-21.05 12 21.05z"/>
    </svg>
  ),
  supabase: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M21.362 9.354H12V.396a.396.396 0 0 0-.716-.233L2.203 12.424l-.401.562a1.04 1.04 0 0 0 .836 1.659H12v8.959a.396.396 0 0 0 .716.233l9.081-12.261.401-.562a1.04 1.04 0 0 0-.836-1.66z"/>
    </svg>
  ),
  notion: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.166V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.934zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
    </svg>
  ),
  slack: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
    </svg>
  ),
  netlify: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M17.3877 10.399l-1.297-1.2954-.07-.0667-.5017-.5018-.0484-.0484-.3645-.3662-.0067-.0067-.2963-.2963-.1034-.1034-.2662-.2662-.1484-.1501-.2311-.2344-.1802-.1818-.2027-.2044-.2027-.2044-.2027-.2061-.2027-.2027-.1818-.1835-.2194-.2211-.1501-.1518-.2629-.2646-.1034-.1051-.2963-.2963-.0383-.0384-.3795-.3795-.0317-.0317-.5017-.5034-.0383-.0383L10.7008 4 7.7277 6.9665l.4649.4666.0383.0383.3795.3795.0667.0667.3162.3179.0551.0551.3011.3028.0851.0851.2812.2829.1034.1034.2663.2679.1184.1184.2528.2545.1351.1368.241.2428.1501.1501.2311.2311.1635.1651.2177.2194.1769.1769.2044.2061.1885.1885.1919.1935.1985.1985.1802.1818.2061.2094.1668.1685.2161.2177.1518.1535.2278.2278.1351.1368.2378.2395.1184.1184.2512.2528.1001.1034.2679.2679.0851.0851.2812.2812.0701.0701.2996.2996.0517.0534.3145.3162.0384.0383.3312.3312.0233.0233.35.3496.0184.0183.3629.3629.0067.0067.3812.3812.3979.3996.4182-.4183 1.2954-1.3021.07-.07.5051-.505.05-.05.3678-.3679.0084-.0084.2946-.2946.1067-.1067.2629-.2629.1518-.1518.2294-.2294.1835-.1835.201-.201.2077-.2077.1986-.1986.2077-.2077.1802-.1802.2227-.2227.1468-.1468.2679-.2679.1001-.1001.3012-.3012.035-.035.3845-.3845.0284-.0284.5084-.5084.0333-.0333 1.3021-1.2954zm-5.9073 6.56l-.3795-.3778-.0383-.0384-.3145-.3162-.0517-.0517-.2996-.2996-.0701-.0701-.2812-.2812-.0851-.0851-.2679-.2679-.1001-.1001-.2512-.2528-.1184-.1184-.2378-.2395-.1351-.1351-.2278-.2278-.1518-.1535-.2161-.2177-.1668-.1668-.2061-.2077-.1802-.1835-.1919-.1919-.1985-.2001-.1885-.1868-.2044-.2061-.1769-.1769-.2177-.2194-.1635-.1635-.2311-.2311-.1501-.1518-.2411-.2411-.1351-.1368-.2528-.2545-.1184-.1184-.2662-.2679-.1034-.1034-.2812-.2829-.0851-.0851-.3011-.3028-.0551-.0534-.3162-.3179-.0667-.0684-.3795-.3778-.0383-.0384-.4666-.4666L5.4407 9.1008l-.1835 1.8168.2078.2094.1685.1668.2177.2161.1535.1518.2278.2278.1368.1351.2395.2378.1184.1201.2528.2512.1034.1001.2679.2679.0851.0851.2812.2812.0701.0684.2996.2996.0534.0517.3145.3162.0384.0383.3795.3795.0667.0667.5051.5051.1501.1501 1.8151.1834-.1834-1.8168zm.9333-.9333l.3778.3795.0384.0383.3162.3162.0517.0517.2996.2996.0701.0684.2812.2812.0851.0851.2679.2679.1001.1001.2528.2528.1184.1184.2378.2378.1368.1368.2261.2261.1535.1535.2177.2161.1668.1685.2061.2061.1818.1818.1936.1919.2001.2001.1869.1869.2061.2077.1752.1752.2211.2211.1618.1618.2327.2327.1485.1501.2427.2411.1335.1368.2545.2528.1184.1184.2662.2662.1034.1034.2812.2829.0851.0851.3028.3011.055.055.3179.3162.0667.0684.3795.3778.0384.0383.4666.4666 2.6993-2.6943-.1869-1.8151-1.8134.1818-.1518-.1518-.5067-.5034-.0667-.0667-.3779-.3795-.0383-.0384-.3162-.3162-.0517-.0534-.2996-.2979-.0684-.0701-.2829-.2812-.0834-.0868-.2679-.2662-.1001-.1034-.2528-.2512-.1184-.1201-.2378-.2378-.1368-.1368-.2261-.2278-.1535-.1518-.2177-.2177-.1668-.1668-.2061-.2061-.1818-.1818-.1936-.1936-.2001-.1985-.1869-.1885-.2077-.2061-.1752-.1769-.2211-.2194-.1618-.1651-.2327-.2311-.1485-.1501-.2427-.2428-.1335-.1351-.2545-.2545-.1184-.1167-.2662-.2679-.1034-.1034-.2812-.2812-.0851-.0868-.3028-.2996-.055-.0534-.3179-.3162-.0667-.0667-.3795-.3795-.0384-.0367-.1501-.1518zm2.6326.2227l.0717-.0717.5034-.5034.0517-.0517.3645-.3662.0117-.0117.2913-.2913.11-.11.2629-.2629.1535-.1535.2261-.2261.1852-.1852.1969-.1969.2111-.2111.1919-.1919.2111-.2127.1769-.1769.2261-.2278.1501-.1501.2679-.2679.1034-.1034.2996-.2996.0517-.05.3662-.3679.0117-.0117.5034-.505.0717-.0734 1.2954-1.3021-.9333-.9333-1.3021 1.3004-.0717.0717-.5017.5034-.0134.0117-.3645.3662-.0517.0517-.2913.2929-.1117.1101-.2612.2629-.1535.1535-.2278.2278-.1852.1835-.1969.1985-.2111.2094-.1919.1936-.2127.2111-.1769.1769-.2261.2278-.1518.1484-.2679.2679-.1034.1034-.2996.2996-.05.0534-.3679.3662-.0117.0117-.505.5034-.0717.0717-1.2987 1.3004.9316.9316z"/>
    </svg>
  ),
  aws: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 0 1-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 0 1-.287-.375 6.18 6.18 0 0 1-.248-.471c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.384-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.272 0 .551.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.03-.375-1.277-.255-.248-.686-.367-1.3-.367-.28 0-.568.031-.863.103-.295.072-.583.16-.862.272a2.287 2.287 0 0 1-.28.104.488.488 0 0 1-.127.023c-.112 0-.168-.08-.168-.247v-.391c0-.128.016-.224.056-.28a.597.597 0 0 1 .224-.167c.279-.144.614-.264 1.005-.36a4.84 4.84 0 0 1 1.246-.151c.95 0 1.644.216 2.091.647.439.43.662 1.085.662 1.963v2.586zm-3.24 1.214c.263 0 .534-.048.822-.144.287-.096.543-.271.758-.51.128-.152.224-.32.272-.512.047-.191.08-.423.08-.694v-.335a6.66 6.66 0 0 0-.735-.136 6.02 6.02 0 0 0-.75-.048c-.535 0-.926.104-1.19.32-.263.215-.39.518-.39.917 0 .375.095.655.295.846.191.2.47.296.838.296zm6.41.862c-.144 0-.24-.024-.304-.08-.064-.048-.12-.16-.168-.311L7.586 5.55a1.398 1.398 0 0 1-.072-.32c0-.128.064-.2.191-.2h.783c.151 0 .255.025.31.08.065.048.113.16.16.312l1.342 5.284 1.245-5.284c.04-.16.088-.264.151-.312a.549.549 0 0 1 .32-.08h.638c.152 0 .256.025.32.08.063.048.12.16.151.312l1.261 5.348 1.381-5.348c.048-.16.104-.264.16-.312a.52.52 0 0 1 .311-.08h.743c.127 0 .2.065.2.2 0 .04-.009.08-.017.128a1.137 1.137 0 0 1-.056.2l-1.923 6.17c-.048.16-.104.263-.168.311a.51.51 0 0 1-.303.08h-.687c-.151 0-.255-.024-.32-.08-.063-.056-.119-.16-.15-.32l-1.238-5.148-1.23 5.14c-.04.16-.087.264-.15.32-.065.056-.177.08-.32.08zm10.256.215c-.415 0-.83-.048-1.229-.143-.399-.096-.71-.2-.918-.32-.128-.071-.215-.151-.247-.223a.563.563 0 0 1-.048-.224v-.407c0-.167.064-.247.183-.247.048 0 .096.008.144.024.048.016.12.048.2.08.271.12.566.215.878.279.319.064.63.096.95.096.502 0 .894-.088 1.165-.264a.86.86 0 0 0 .415-.758.777.777 0 0 0-.215-.559c-.144-.151-.416-.287-.807-.414l-1.157-.36c-.583-.183-1.014-.454-1.277-.813a1.902 1.902 0 0 1-.4-1.158c0-.335.073-.63.216-.886.144-.255.335-.479.575-.654.24-.184.51-.32.83-.415.32-.096.655-.136 1.006-.136.175 0 .359.008.535.032.183.024.35.056.518.088.16.04.312.08.455.127.144.048.256.096.336.144a.69.69 0 0 1 .24.2.43.43 0 0 1 .071.263v.375c0 .168-.064.256-.184.256a.83.83 0 0 1-.303-.096 3.652 3.652 0 0 0-1.532-.311c-.455 0-.815.071-1.062.223-.248.152-.375.383-.375.71 0 .224.08.416.24.567.159.152.454.304.877.44l1.134.358c.574.184.99.44 1.237.767.247.327.367.702.367 1.117 0 .343-.072.655-.207.926-.144.272-.336.511-.583.703-.248.2-.543.343-.886.447-.36.111-.734.167-1.142.167zM21.698 16.207c-2.626 1.94-6.442 2.969-9.722 2.969-4.598 0-8.74-1.7-11.87-4.526-.247-.223-.024-.527.27-.351 3.384 1.963 7.559 3.153 11.877 3.153 2.914 0 6.114-.607 9.06-1.852.439-.2.814.287.385.607zM22.792 14.961c-.336-.43-2.22-.207-3.074-.103-.255.032-.295-.192-.063-.36 1.5-1.053 3.967-.75 4.254-.399.287.36-.08 2.826-1.485 4.007-.215.184-.423.088-.327-.151.32-.79 1.03-2.57.695-2.994z"/>
    </svg>
  ),
  openai: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364l2.0201-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
    </svg>
  ),
  anthropic: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M17.304 3.541h-3.672l6.696 16.918H24zm-10.608 0L0 20.459h3.744l1.368-3.547h6.48l1.368 3.547h3.744L10.008 3.541zm.432 10.16l2.16-5.592 2.16 5.592z"/>
    </svg>
  ),
};

// Default icon for unknown servers
const DEFAULT_ICON = (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
  </svg>
);

// Category labels
const CATEGORY_LABELS: Record<string, string> = {
  'payments': 'Payments',
  'deployment': 'Deployment & Hosting',
  'database': 'Database',
  'productivity': 'Productivity',
  'version-control': 'Version Control',
  'communication': 'Communication',
  'storage': 'Storage',
  'other': 'Other',
};

// Category order
const CATEGORY_ORDER = [
  'payments',
  'version-control',
  'deployment',
  'database',
  'productivity',
  'communication',
  'storage',
  'other',
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function MCPSettingsPanel({ isOpen, onClose }: MCPSettingsPanelProps) {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [connections, setConnections] = useState<MCPConnection[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [showApiKeyFor, setShowApiKeyFor] = useState<string | null>(null);

  // Fetch servers and connections on mount/open
  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      if (!window.electronAPI?.mcp) return;

      const [serverList, connectionList] = await Promise.all([
        window.electronAPI.mcp.listServers(),
        window.electronAPI.mcp.getConnections(),
      ]);

      setServers(serverList);
      setConnections(connectionList);
    };

    fetchData();
  }, [isOpen]);

  // Listen for status changes
  useEffect(() => {
    const cleanup = window.electronAPI?.mcp?.onStatusChange?.((event) => {
      setServers((prev) =>
        prev.map((s) =>
          s.id === event.serverId
            ? { ...s, status: event.newStatus, errorMessage: event.errorMessage }
            : s
        )
      );

      if (event.serverId === connecting) {
        if (event.newStatus === 'connected' || event.newStatus === 'error') {
          setConnecting(null);
        }
        if (event.newStatus === 'error') {
          setError(event.errorMessage || 'Connection failed');
        }
      }
    });

    return () => { cleanup?.(); };
  }, [connecting]);

  // Listen for connection changes
  useEffect(() => {
    const addedCleanup = window.electronAPI?.mcp?.onConnectionAdded?.((connection) => {
      setConnections((prev) => [...prev.filter((c) => c.serverId !== connection.serverId), connection]);
    });

    const removedCleanup = window.electronAPI?.mcp?.onConnectionRemoved?.((serverId) => {
      setConnections((prev) => prev.filter((c) => c.serverId !== serverId));
    });

    return () => {
      addedCleanup?.();
      removedCleanup?.();
    };
  }, []);

  // Handle connect
  const handleConnect = useCallback(async (server: MCPServer) => {
    if (!window.electronAPI?.mcp) return;

    // For non-OAuth servers, show API key input
    if (!server.requiresOAuth) {
      setShowApiKeyFor(server.id);
      return;
    }

    setConnecting(server.id);
    setError(null);

    try {
      const result = await window.electronAPI.mcp.connect(server.id);
      if (!result.success) {
        setError(result.error || 'Connection failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(null);
    }
  }, []);

  // Handle API key submission
  const handleApiKeySubmit = useCallback(async (serverId: string) => {
    const apiKey = apiKeyInputs[serverId];
    if (!apiKey || !window.electronAPI?.mcp) return;

    setConnecting(serverId);
    setError(null);

    try {
      const result = await window.electronAPI.mcp.setApiKey(serverId, apiKey);
      if (result.success) {
        setShowApiKeyFor(null);
        setApiKeyInputs((prev) => ({ ...prev, [serverId]: '' }));
      } else {
        setError(result.error || 'Failed to save API key');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save API key');
    } finally {
      setConnecting(null);
    }
  }, [apiKeyInputs]);

  // Handle disconnect
  const handleDisconnect = useCallback(async (serverId: string) => {
    if (!window.electronAPI?.mcp) return;

    try {
      await window.electronAPI.mcp.disconnect(serverId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed');
    }
  }, []);

  // Group servers by category
  const serversByCategory = servers.reduce((acc, server) => {
    const category = server.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(server);
    return acc;
  }, {} as Record<string, MCPServer[]>);

  // Get connection for server
  const getConnection = (serverId: string) =>
    connections.find((c) => c.serverId === serverId);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9998,
    }}>
      <div style={{
        backgroundColor: '#1e1e1e',
        borderRadius: 12,
        width: '90%',
        maxWidth: 600,
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #333',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 600,
              color: '#fff',
            }}>
              Connected Services
            </h2>
            <p style={{
              margin: '4px 0 0',
              fontSize: 13,
              color: '#888',
            }}>
              Manage your external service integrations
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              padding: 8,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            margin: '16px 24px 0',
            padding: 12,
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 8,
          }}>
            <p style={{
              margin: 0,
              fontSize: 13,
              color: '#ef4444',
            }}>
              {error}
            </p>
          </div>
        )}

        {/* Server list */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px 24px 24px',
        }}>
          {CATEGORY_ORDER.map((category) => {
            const categoryServers = serversByCategory[category];
            if (!categoryServers || categoryServers.length === 0) return null;

            return (
              <div key={category} style={{ marginBottom: 24 }}>
                <h3 style={{
                  margin: '0 0 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#666',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  {CATEGORY_LABELS[category] || category}
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {categoryServers.map((server) => {
                    const connection = getConnection(server.id);
                    const isConnected = server.status === 'connected';
                    const isConnecting = connecting === server.id;
                    const showingApiKey = showApiKeyFor === server.id;

                    return (
                      <div
                        key={server.id}
                        style={{
                          backgroundColor: '#252525',
                          borderRadius: 8,
                          padding: 16,
                          border: '1px solid #333',
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                        }}>
                          {/* Icon */}
                          <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: 8,
                            backgroundColor: '#1a1a1a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isConnected ? '#10b981' : '#666',
                            flexShrink: 0,
                          }}>
                            {SERVER_ICONS[server.id] || DEFAULT_ICON}
                          </div>

                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                            }}>
                              <span style={{
                                fontSize: 14,
                                fontWeight: 500,
                                color: '#fff',
                              }}>
                                {server.name}
                              </span>
                              {isConnected && (
                                <span style={{
                                  fontSize: 11,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                  color: '#10b981',
                                }}>
                                  Connected
                                </span>
                              )}
                            </div>
                            <p style={{
                              margin: '4px 0 0',
                              fontSize: 12,
                              color: '#888',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {server.description}
                            </p>
                            {connection?.userInfo?.email && (
                              <p style={{
                                margin: '4px 0 0',
                                fontSize: 11,
                                color: '#666',
                              }}>
                                {connection.userInfo.email}
                              </p>
                            )}
                          </div>

                          {/* Action button */}
                          <div style={{ flexShrink: 0 }}>
                            {isConnected ? (
                              <button
                                onClick={() => handleDisconnect(server.id)}
                                style={{
                                  padding: '8px 16px',
                                  borderRadius: 6,
                                  border: '1px solid #444',
                                  backgroundColor: 'transparent',
                                  color: '#888',
                                  cursor: 'pointer',
                                  fontSize: 13,
                                }}
                              >
                                Disconnect
                              </button>
                            ) : (
                              <button
                                onClick={() => handleConnect(server)}
                                disabled={isConnecting}
                                style={{
                                  padding: '8px 16px',
                                  borderRadius: 6,
                                  border: 'none',
                                  backgroundColor: isConnecting ? '#444' : '#3b82f6',
                                  color: '#fff',
                                  cursor: isConnecting ? 'not-allowed' : 'pointer',
                                  fontSize: 13,
                                  fontWeight: 500,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}
                              >
                                {isConnecting ? (
                                  <>
                                    <span style={{
                                      width: 14,
                                      height: 14,
                                      border: '2px solid rgba(255,255,255,0.3)',
                                      borderTopColor: '#fff',
                                      borderRadius: '50%',
                                      animation: 'spin 1s linear infinite',
                                    }} />
                                    Connecting
                                  </>
                                ) : (
                                  'Connect'
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* API Key input */}
                        {showingApiKey && (
                          <div style={{ marginTop: 12 }}>
                            <div style={{
                              display: 'flex',
                              gap: 8,
                            }}>
                              <input
                                type="password"
                                value={apiKeyInputs[server.id] || ''}
                                onChange={(e) =>
                                  setApiKeyInputs((prev) => ({ ...prev, [server.id]: e.target.value }))
                                }
                                placeholder="Enter API key..."
                                style={{
                                  flex: 1,
                                  padding: '8px 12px',
                                  fontSize: 13,
                                  backgroundColor: '#1a1a1a',
                                  border: '1px solid #444',
                                  borderRadius: 6,
                                  color: '#fff',
                                  outline: 'none',
                                }}
                                autoFocus
                              />
                              <button
                                onClick={() => handleApiKeySubmit(server.id)}
                                disabled={!apiKeyInputs[server.id] || isConnecting}
                                style={{
                                  padding: '8px 16px',
                                  borderRadius: 6,
                                  border: 'none',
                                  backgroundColor: apiKeyInputs[server.id] && !isConnecting ? '#10b981' : '#444',
                                  color: '#fff',
                                  cursor: apiKeyInputs[server.id] && !isConnecting ? 'pointer' : 'not-allowed',
                                  fontSize: 13,
                                  fontWeight: 500,
                                }}
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setShowApiKeyFor(null);
                                  setApiKeyInputs((prev) => ({ ...prev, [server.id]: '' }));
                                }}
                                style={{
                                  padding: '8px 12px',
                                  borderRadius: 6,
                                  border: '1px solid #444',
                                  backgroundColor: 'transparent',
                                  color: '#888',
                                  cursor: 'pointer',
                                  fontSize: 13,
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                            {server.tokenUrl && (
                              <p style={{
                                margin: '8px 0 0',
                                fontSize: 11,
                                color: '#666',
                              }}>
                                <a
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    window.electronAPI?.shell?.openExternal(server.tokenUrl!);
                                  }}
                                  style={{ color: '#3b82f6', textDecoration: 'none' }}
                                >
                                  Get your API key from {server.name}
                                </a>
                              </p>
                            )}
                          </div>
                        )}

                        {/* Error message for this server */}
                        {server.status === 'error' && server.errorMessage && (
                          <p style={{
                            margin: '8px 0 0',
                            fontSize: 12,
                            color: '#ef4444',
                          }}>
                            {server.errorMessage}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Spinner animation keyframes */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
