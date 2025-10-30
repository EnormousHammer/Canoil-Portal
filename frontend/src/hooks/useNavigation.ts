import { useState, useCallback } from 'react';

export interface NavigationItem {
  id: string;
  type: 'tab' | 'modal' | 'search';
  title: string;
  data?: any;
  timestamp: number;
}

export interface NavigationState {
  history: NavigationItem[];
  currentIndex: number;
  canGoBack: boolean;
  canGoForward: boolean;
}

export function useNavigation() {
  const [navigationState, setNavigationState] = useState<NavigationState>({
    history: [],
    currentIndex: -1,
    canGoBack: false,
    canGoForward: false
  });

  const navigate = useCallback((item: Omit<NavigationItem, 'timestamp'>) => {
    setNavigationState(prev => {
      const newItem: NavigationItem = {
        ...item,
        timestamp: Date.now()
      };

      // Remove any forward history when navigating to a new item
      const newHistory = prev.history.slice(0, prev.currentIndex + 1);
      newHistory.push(newItem);

      const newIndex = newHistory.length - 1;

      return {
        history: newHistory,
        currentIndex: newIndex,
        canGoBack: newIndex > 0,
        canGoForward: false
      };
    });
  }, []);

  const goBack = useCallback(() => {
    setNavigationState(prev => {
      if (!prev.canGoBack) return prev;

      const newIndex = prev.currentIndex - 1;
      return {
        ...prev,
        currentIndex: newIndex,
        canGoBack: newIndex > 0,
        canGoForward: true
      };
    });
  }, []);

  const goForward = useCallback(() => {
    setNavigationState(prev => {
      if (!prev.canGoForward) return prev;

      const newIndex = prev.currentIndex + 1;
      return {
        ...prev,
        currentIndex: newIndex,
        canGoBack: true,
        canGoForward: newIndex < prev.history.length - 1
      };
    });
  }, []);

  const getCurrentItem = useCallback(() => {
    const { history, currentIndex } = navigationState;
    return currentIndex >= 0 ? history[currentIndex] : null;
  }, [navigationState]);

  const getBreadcrumbs = useCallback(() => {
    const { history, currentIndex } = navigationState;
    return history.slice(0, currentIndex + 1);
  }, [navigationState]);

  const clearHistory = useCallback(() => {
    setNavigationState({
      history: [],
      currentIndex: -1,
      canGoBack: false,
      canGoForward: false
    });
  }, []);

  return {
    navigationState,
    navigate,
    goBack,
    goForward,
    getCurrentItem,
    getBreadcrumbs,
    clearHistory
  };
}
