export const imageAspects = ["square", "landscape", "portrait"] as const;
export const imageQualities = ["low", "medium", "high"] as const;

export type ImageAspect = typeof imageAspects[number];
export type ImageQuality = typeof imageQualities[number];

export const imageSizes: Record<ImageAspect, "1024x1024" | "1536x1024" | "1024x1536"> = {
  square: "1024x1024", landscape: "1536x1024", portrait: "1024x1536",
};

export function imageOptions(value: unknown): { aspect: ImageAspect; quality: ImageQuality; size: string } {
  const input = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const aspect: ImageAspect = imageAspects.some(x => x === input.aspect) ? input.aspect as ImageAspect : "square";
  const quality: ImageQuality = imageQualities.some(x => x === input.quality) ? input.quality as ImageQuality : "low";
  return { aspect, quality, size: imageSizes[aspect] };
}
