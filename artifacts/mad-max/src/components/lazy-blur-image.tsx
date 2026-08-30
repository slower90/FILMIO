import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface LazyBlurImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "placeholder"> {
  src: string;
  placeholderSrc?: string;
  wrapperClassName?: string;
  eager?: boolean;
}

export function LazyBlurImage({
  src,
  placeholderSrc,
  alt,
  width,
  height,
  className,
  wrapperClassName,
  eager = false,
  onLoad,
  onError,
  ...props
}: LazyBlurImageProps) {
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const [isNearViewport, setIsNearViewport] = useState(eager);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setIsNearViewport(eager);
    setIsLoaded(false);
    setHasError(false);
  }, [eager, src]);

  useEffect(() => {
    if (eager) return;
    const element = wrapperRef.current;
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
      { rootMargin: "240px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [eager, src]);

  const aspectRatio =
    typeof width === "number" && typeof height === "number"
      ? `${width} / ${height}`
      : undefined;

  return (
    <span
      ref={wrapperRef}
      className={cn("relative block overflow-hidden bg-muted/70", wrapperClassName)}
      style={{ aspectRatio }}
      role={hasError ? "img" : undefined}
      aria-label={hasError ? alt : undefined}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-0 bg-gradient-to-br from-primary/10 via-muted to-card transition-opacity duration-500",
          isLoaded && "opacity-0",
        )}
      />
      {isNearViewport && placeholderSrc && !hasError && (
        <img
          src={placeholderSrc}
          alt=""
          aria-hidden="true"
          width={width}
          height={height}
          className={cn(
            "absolute inset-0 h-full w-full scale-105 object-cover blur-md transition-opacity duration-500",
            isLoaded && "opacity-0",
          )}
          decoding="async"
        />
      )}
      {isNearViewport && !hasError && (
        <img
          {...props}
          src={src}
          alt={alt}
          width={width}
          height={height}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
            isLoaded ? "opacity-100" : "opacity-0",
            className,
          )}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={(event) => {
            setIsLoaded(true);
            onLoad?.(event);
          }}
          onError={(event) => {
            setHasError(true);
            onError?.(event);
          }}
        />
      )}
    </span>
  );
}