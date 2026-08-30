import { useEffect, useRef, useState } from "react";

export function useNearViewport<T extends Element = HTMLElement>(
  rootMargin = "240px 0px",
  enabled = true,
) {
  const ref = useRef<T | null>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!enabled) {
      setIsNearViewport(false);
      return;
    }

    if (!element || !("IntersectionObserver" in window)) {
      setIsNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setIsNearViewport(true);
        observer.disconnect();
      },
      { rootMargin },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, rootMargin]);

  return { ref, isNearViewport };
}