import { useSwipeable } from 'react-swipeable';

export function useSwipeGesture(isMobile, isSidebarOpen, setIsSidebarOpen) {
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
    delta: 10,
    preventScrollOnSwipe: true,
    swipeDuration: 500,
  });
}