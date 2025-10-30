import { useEffect, useCallback } from 'react';

interface KeyboardNavigationOptions {
  onEscape?: () => void;
  onBack?: () => void;
  onForward?: () => void;
  onSearch?: () => void;
  onHome?: () => void;
  enabled?: boolean;
}

export function useKeyboardNavigation({
  onEscape,
  onBack,
  onForward,
  onSearch,
  onHome,
  enabled = true
}: KeyboardNavigationOptions) {
  
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Don't trigger shortcuts when user is typing in input fields
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      // Only allow Escape key in input fields
      if (event.key === 'Escape' && onEscape) {
        event.preventDefault();
        onEscape();
      }
      return;
    }

    switch (event.key) {
      case 'Escape':
        if (onEscape) {
          event.preventDefault();
          onEscape();
        }
        break;
        
      case 'ArrowLeft':
        if (event.altKey && onBack) {
          event.preventDefault();
          onBack();
        }
        break;
        
      case 'ArrowRight':
        if (event.altKey && onForward) {
          event.preventDefault();
          onForward();
        }
        break;
        
      case 'f':
      case 'F':
        if (event.ctrlKey && onSearch) {
          event.preventDefault();
          onSearch();
        }
        break;
        
      case 'h':
      case 'H':
        if (event.ctrlKey && onHome) {
          event.preventDefault();
          onHome();
        }
        break;
        
      case 'Backspace':
        // Alt + Backspace = Back (like browsers)
        if (event.altKey && onBack) {
          event.preventDefault();
          onBack();
        }
        break;
    }
  }, [enabled, onEscape, onBack, onForward, onSearch, onHome]);

  useEffect(() => {
    if (enabled) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [enabled, handleKeyDown]);

  return {
    // Utility function to focus search input
    focusSearch: useCallback(() => {
      const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }, [])
  };
}
