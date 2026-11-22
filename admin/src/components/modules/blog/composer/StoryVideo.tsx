"use client";

import { useState } from "react";
import { PlayIcon } from "lucide-react";

import { videoSource } from "./blocks";

/**
 * A story's video. With a poster, the poster shows until the reader presses
 * play — no third-party player loads before then. Without one, the player
 * itself is shown. Shared with the storefront; keep the copies identical.
 */
export function StoryVideo({ url, poster, caption }: { url: string; poster: string; caption: string }) {
  const [playing, setPlaying] = useState(false);
  const source = videoSource(url);
  const label = source.kind === "youtube" ? "YouTube" : source.kind === "vimeo" ? "Vimeo" : url ? "Video" : "Add a video link";

  const player =
    source.kind === "youtube" || source.kind === "vimeo" ? (
      <iframe
        src={playing ? source.src : source.src.replace("autoplay=1", "autoplay=0")}
        title={caption || "Video"}
        loading="lazy"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    ) : source.kind === "file" ? (
      <video src={source.src} controls autoPlay={playing} poster={poster || undefined} preload="metadata" />
    ) : null;

  return (
    <figure className="a-vid">
      {(poster && !playing) || source.kind === "none" ? (
        <button
          type="button"
          className="pst"
          onClick={() => source.kind !== "none" && setPlaying(true)}
          aria-label={source.kind === "none" ? "No video yet" : `Play ${caption || "video"}`}
        >
          {poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" />
          )}
          <span className="play">
            <PlayIcon className="h-6 w-6 fill-current" aria-hidden="true" />
          </span>
          <span className="src">{label}</span>
        </button>
      ) : (
        player
      )}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
