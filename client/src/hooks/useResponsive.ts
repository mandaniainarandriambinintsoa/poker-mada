import { useMemo } from 'react';
import { useWindowSize } from './useWindowSize';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

interface ResponsiveInfo {
  deviceType: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
}

// Breakpoints en pixels
const BREAKPOINTS = {
  mobile: 640,
  tablet: 1024,
};

export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowSize();

  const responsiveInfo = useMemo<ResponsiveInfo>(() => {
    let deviceType: DeviceType;

    if (width < BREAKPOINTS.mobile) {
      deviceType = 'mobile';
    } else if (width < BREAKPOINTS.tablet) {
      deviceType = 'tablet';
    } else {
      deviceType = 'desktop';
    }

    return {
      deviceType,
      isMobile: deviceType === 'mobile',
      isTablet: deviceType === 'tablet',
      isDesktop: deviceType === 'desktop',
      width,
      height,
    };
  }, [width, height]);

  return responsiveInfo;
}
