import { Baby, Blocks, DoorOpen, Sun, Trees, Umbrella, Waves, type LucideIcon } from "lucide-react";

const icons: Record<string, LucideIcon> = { waves: Waves, baby: Baby, sun: Sun, umbrella: Umbrella, trees: Trees, door: DoorOpen, blocks: Blocks };

export function InfraIcon({ name, className }: { name: string; className?: string }) {
  const Icon = icons[name] ?? Waves;
  return <Icon className={className} />;
}
