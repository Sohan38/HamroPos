import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ScrollToTop() {
  const [location] = useLocation();
  const [isVisible, setIsVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto'
    });
  }, [location]);

  // Handle scroll and compute progress
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollTop = window.scrollY;
          const docHeight = document.documentElement.scrollHeight - window.innerHeight;
          
          if (docHeight > 0) {
            setScrollProgress(Math.min((scrollTop / docHeight) * 100, 100));
          } else {
            setScrollProgress(0);
          }

          setIsVisible(scrollTop > 300);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Run initially to set correct state
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  // Circumference of progress circle (r = 18): 2 * PI * 18 ≈ 113.1
  const circumference = 2 * Math.PI * 18;
  const strokeDashoffset = circumference - (scrollProgress / 100) * circumference;

  return (
    <button
      onClick={scrollToTop}
      className={cn(
        "fixed right-4 z-50 flex items-center justify-center rounded-full p-2.5 shadow-lg backdrop-blur-md transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
        "border border-border/40 bg-background/85 text-muted-foreground hover:text-primary-foreground",
        "hover:bg-primary hover:scale-110 hover:shadow-xl hover:border-primary/20",
        "active:scale-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        // Position above bottom navigation bar on mobile (typically 20/24), standard on larger screens
        "bottom-[88px] md:bottom-8",
        isVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-10 scale-75 pointer-events-none"
      )}
      aria-label="Scroll to top"
    >
      {/* Scroll Progress Ring */}
      <svg className="absolute -rotate-90 w-[44px] h-[44px]" viewBox="0 0 44 44">
        <circle
          cx="22"
          cy="22"
          r="18"
          className="stroke-muted/20"
          strokeWidth="2"
          fill="transparent"
        />
        <circle
          cx="22"
          cy="22"
          r="18"
          className="stroke-primary transition-all duration-100"
          strokeWidth="2.5"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <ArrowUp className="h-5 w-5 relative z-10 transition-transform duration-300 hover:-translate-y-0.5" />
    </button>
  );
}

