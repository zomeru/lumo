import { z } from "zod";

const webSchema = z.object({
  VITE_API_URL: z
    .union([
      z.literal(""),
      z.url().refine((value) => {
        const url = new URL(value);
        return ["http:", "https:"].includes(url.protocol) && url.origin === value;
      }),
    ])
    .default(""),
});

export function readWebEnv(source: Record<string, unknown>) {
  return webSchema.parse(source);
}
