import type { meSchema } from "@lumo/contracts";
import {
  avatarConfigSchema,
  avatarResultSchema,
  AVATAR_MAX_DIMENSION,
  AVATAR_MAX_PIXELS,
} from "@lumo/contracts/avatar";
import { Button, ErrorMessage, Field } from "@lumo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import type { z } from "zod";

import { AppAvatar } from "../../components/app-avatar";
import { api } from "../../lib/api";
import { avatarCrop } from "./avatar-crop";
type Photo = { src: string; width: number; height: number; image: ImageBitmap };
export function AvatarEditor({ name, image }: { name: string; image: string | null }) {
  const client = useQueryClient();
  const pickerId = useId();
  const config = useQuery({
    queryKey: ["avatar-config"],
    queryFn: ({ signal }) => api("/me/avatar/config", avatarConfigSchema, { signal }),
  });
  const [photo, setPhoto] = useState<Photo | null>(null),
    [error, setError] = useState<unknown>(null),
    [decoding, setDecoding] = useState(false);
  const [zoom, setZoom] = useState(1),
    [x, setX] = useState(50),
    [y, setY] = useState(50);
  const generation = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  function clear() {
    generation.current++;
    setPhoto(null);
    setDecoding(false);
    if (fileInput.current) fileInput.current.value = "";
  }
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  useEffect(
    () => () => {
      photo?.image.close();
    },
    [photo],
  );
  const save = useMutation({
    mutationFn: async (remove: boolean) => {
      if (remove) return api("/me/avatar", avatarResultSchema, { method: "DELETE" });
      if (!photo) throw new Error("Choose a photo first.");
      const crop = avatarCrop(photo.width, photo.height, zoom, x, y),
        canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Your device could not prepare the image. Please try again.");
      context.drawImage(photo.image, crop.left, crop.top, crop.side, crop.side, 0, 0, 256, 256);
      const data = canvas.toDataURL("image/webp", 0.85);
      const mimeType = data.startsWith("data:image/webp;") ? "image/webp" : "image/png";
      return api("/me/avatar", avatarResultSchema, {
        method: "PUT",
        body: { mimeType, data: data.split(",")[1] },
      });
    },
    onSuccess: async ({ image: savedImage }) => {
      client.setQueryData<z.infer<typeof meSchema>>(["session"], (current) =>
        current ? { ...current, user: { ...current.user, image: savedImage } } : current,
      );
      clear();
      await Promise.all([
        client.invalidateQueries({ queryKey: ["session"] }),
        client.invalidateQueries({ queryKey: ["workspace"] }),
        client.invalidateQueries({ queryKey: ["avatar"] }),
      ]);
    },
  });
  const crop = photo ? avatarCrop(photo.width, photo.height, zoom, x, y) : null;
  return (
    <section aria-label="Profile photo" className="grid gap-3 rounded-lg border bg-surface p-4">
      <div className="flex items-center gap-3">
        <AppAvatar name={name} src={image ?? undefined} size="lg" />
        <div>
          <h2 className="text-sm font-semibold">Profile photo</h2>
          <p className="text-xs text-muted-foreground">
            JPEG, PNG or WebP · up to{" "}
            {config.data ? `${Math.round((config.data.maxBytes / 1024 / 1024) * 10) / 10} MB` : "…"}
          </p>
        </div>
      </div>
      <div className="grid gap-2">
        <Button
          className="justify-self-start"
          disabled={save.isPending || decoding || !config.data}
          onClick={() => fileInput.current?.click()}
          aria-controls={pickerId}
        >
          {photo ? "Change selected photo" : image ? "Change photo" : "Choose photo"}
        </Button>
        <p className="text-xs">
          Photo changes are saved separately. Choose, adjust, then select Save photo.
        </p>
        <input
          id={pickerId}
          className="sr-only"
          tabIndex={-1}
          ref={fileInput}
          aria-label={photo ? "Choose a different photo" : "Choose profile photo"}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={save.isPending || decoding || !config.data}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setError(null);
            save.reset();
            if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
              setError(new Error("Choose a JPEG, PNG or WebP image."));
              event.target.value = "";
              return;
            }
            if (!file.size || file.size > config.data!.maxBytes) {
              setError(new Error("The selected image exceeds the upload limit or is empty."));
              event.target.value = "";
              return;
            }
            const request = ++generation.current;
            setDecoding(true);
            void Promise.resolve()
              .then(() => createImageBitmap(file, { imageOrientation: "from-image" }))
              .then((bitmap) => {
                if (request !== generation.current) {
                  bitmap.close();
                  return;
                }
                if (
                  bitmap.width > AVATAR_MAX_DIMENSION ||
                  bitmap.height > AVATAR_MAX_DIMENSION ||
                  bitmap.width * bitmap.height > AVATAR_MAX_PIXELS
                ) {
                  bitmap.close();
                  throw new Error("Choose an image up to 8192 pixels per side and 16 megapixels.");
                }
                const canvas = document.createElement("canvas");
                const ratio = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
                canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
                canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
                const context = canvas.getContext("2d");
                if (!context) {
                  bitmap.close();
                  throw new Error("Unable to preview this image.");
                }
                context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
                // The bitmap is oriented; preview and saved crop therefore use identical coordinates.
                const src = canvas.toDataURL("image/webp", 0.9);
                setPhoto({ src, width: bitmap.width, height: bitmap.height, image: bitmap });
                setZoom(1);
                setX(50);
                setY(50);
              })
              .catch((cause: unknown) => {
                if (request === generation.current) {
                  if (fileInput.current) fileInput.current.value = "";
                  setError(
                    cause instanceof Error ? cause : new Error("Unable to decode this image."),
                  );
                }
              })
              .finally(() => {
                if (request === generation.current) setDecoding(false);
              });
          }}
        />
      </div>
      {decoding && <output>Preparing preview…</output>}
      {photo && crop && (
        <fieldset disabled={save.isPending} className="grid gap-3">
          <legend className="text-sm font-medium">Adjust your new photo</legend>
          <p className="text-xs text-muted-foreground">
            Drag to reposition, or use the sliders. The circular preview matches your saved avatar.
          </p>
          <div
            aria-label="Circular crop preview"
            className="relative mx-auto aspect-square w-full max-w-64 touch-none overflow-hidden rounded-full border-2 border-primary bg-muted"
            onPointerDown={(event) => {
              drag.current = { x, y, startX: event.clientX, startY: event.clientY };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!drag.current) return;
              const scale = event.currentTarget.clientWidth / crop.side;
              if (photo.width > crop.side)
                setX(
                  Math.max(
                    0,
                    Math.min(
                      100,
                      drag.current.x -
                        ((event.clientX - drag.current.startX) /
                          (photo.width - crop.side) /
                          scale) *
                          100,
                    ),
                  ),
                );
              if (photo.height > crop.side)
                setY(
                  Math.max(
                    0,
                    Math.min(
                      100,
                      drag.current.y -
                        ((event.clientY - drag.current.startY) /
                          (photo.height - crop.side) /
                          scale) *
                          100,
                    ),
                  ),
                );
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            <img
              src={photo.src}
              width={photo.width}
              height={photo.height}
              alt="Circular crop preview"
              draggable={false}
              className="pointer-events-none absolute max-w-none select-none"
              style={{
                width: `${(photo.width * 100) / crop.side}%`,
                height: `${(photo.height * 100) / crop.side}%`,
                left: `${(-crop.left * 100) / crop.side}%`,
                top: `${(-crop.top * 100) / crop.side}%`,
              }}
            />
          </div>
          <Field
            label="Photo zoom"
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
          <Field
            label="Horizontal position"
            type="range"
            min={0}
            max={100}
            value={x}
            onChange={(event) => setX(Number(event.target.value))}
          />
          <Field
            label="Vertical position"
            type="range"
            min={0}
            max={100}
            value={y}
            onChange={(event) => setY(Number(event.target.value))}
          />
          <div className="flex gap-2">
            <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate(false)}>
              {save.isPending ? "Saving photo…" : "Save photo"}
            </Button>
            <Button disabled={save.isPending} onClick={clear}>
              Cancel photo
            </Button>
          </div>
        </fieldset>
      )}
      {image && !photo && (
        <Button variant="ghost" disabled={save.isPending} onClick={() => save.mutate(true)}>
          Remove photo
        </Button>
      )}
      <ErrorMessage error={error ?? save.error ?? config.error} />
      {save.isSuccess && <output className="text-sm text-success">Profile photo updated.</output>}
    </section>
  );
}
