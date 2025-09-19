import { useSwipeable } from 'react-swipeable';

const EDGE_SWIPE_THRESHOLD = 30;
const SWIPE_DELTA_THRESHOLD = 10;
const MAX_SWIPE_DURATION = 500;
export function useSwipeGesture({ isMobile, isSidebarOpen, setIsSidebarOpen }) {
  return useSwipeable({
    onSwipedRight: (eventData) => {
      if (isMobile && !isSidebarOpen && eventData.initial[0] < 30) {
        setIsSidebarOpen(true);
      }
    },
    onSwipedLeft: () => {
      if (isMobile && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    },
    trackMouse: false,
    trackTouch: true,
    delta: SWIPE_DELTA_THRESHOLD,
    preventScrollOnSwipe: true,
    swipeDuration: 500,
  });
}