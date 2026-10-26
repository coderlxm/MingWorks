import { useMediaQuery, useWindowSize } from '@vueuse/core';
import { computed } from 'vue';

export function useHandheldLayout() {
  const { width } = useWindowSize();
  const touchPrimary = useMediaQuery('(pointer: coarse)');

  const wideHandheld = computed(() => {
    if (!touchPrimary.value || width.value < 400 || width.value >= 1000) return false;

    // Use the full screen so browser chrome and the keyboard do not change the ratio.
    const screenRatio = window.screen.width / window.screen.height;
    return screenRatio >= 0.55 && screenRatio <= 0.65;
  });
  const mobileNavigation = computed(() => width.value < 800 || wideHandheld.value);

  return { wideHandheld, mobileNavigation };
}
