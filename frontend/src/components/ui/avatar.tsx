import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

interface AvatarProps {
  name?: string;
  src?: string | null;
  className?: string;
}

export function Avatar({ name, src, className }: AvatarProps) {
  if (src) {
    return <img src={src} alt={name ?? "avatar"} className={cn("size-10 rounded-full object-cover", className)} />;
  }
  return (
    <div
      aria-hidden
      className={cn(
        "flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 text-sm font-semibold text-white",
        className
      )}
    >
      {initials(name)}
    </div>
  );
}
