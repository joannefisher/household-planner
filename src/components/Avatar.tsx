"use client";

import { avatarUri } from "@/lib/avatars";
import type { Member } from "@/lib/types";

export function Avatar({ member, size = 40, photoUrl, ring = false }: { member: Member; size?: number; photoUrl?: string; ring?: boolean }) {
  const src = photoUrl ?? avatarUri(member.avatar, member.name);
  return (
    <span
      className={`avatar${ring ? " has-ring" : ""}${photoUrl ? " is-photo" : ""}`}
      style={{ width: size, height: size, ["--c" as string]: member.colour }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" width={size} height={size} draggable={false} />
    </span>
  );
}
