import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: "blue" | "green" | "yellow" | "purple";
  trend?: string;
  href?: string;
}

const colorMap = {
  blue: {
    bg: "bg-[#eaf4f4]",
    icon: "text-[#2D5F5F]",
    border: "border-[#d5e8e8]",
  },
  green: {
    bg: "bg-[#DCEFE9]",
    icon: "text-[#246451]",
    border: "border-[#D5E8E0]",
  },
  yellow: {
    bg: "bg-[#EDF4E9]",
    icon: "text-[#45664E]",
    border: "border-[#DEE8DA]",
  },
  purple: {
    bg: "bg-[#E5EEEF]",
    icon: "text-[#315E63]",
    border: "border-[#D5E3E5]",
  },
};

export default function StatsCard({
  title,
  value,
  icon: Icon,
  color = "blue",
  trend,
  href,
}: StatsCardProps) {
  const c = colorMap[color];
  const content = (
    <div
      className={cn(
        "h-full min-h-40 rounded-3xl border bg-white p-4 shadow-[0_6px_20px_rgba(13,43,43,0.05)] sm:p-5",
        c.border,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm font-bold leading-6 text-[#526E6B]">
          {title}
        </p>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
            c.bg,
          )}
        >
          <Icon aria-hidden="true" className={cn("w-5 h-5", c.icon)} />
        </div>
      </div>
      <p className="mt-4 break-words text-3xl font-black tracking-tight text-[#0D2B2B] sm:text-4xl">
        {value}
      </p>
      {trend && (
        <p className="mt-2 text-xs leading-5 text-[#637A76]">{trend}</p>
      )}
    </div>
  );
  return href ? (
    <Link
      href={href}
      className="block h-full min-w-0 rounded-3xl outline-offset-4 transition hover:brightness-[0.98] focus-visible:outline-2 focus-visible:outline-[#2D5F5F]"
    >
      {content}
    </Link>
  ) : (
    content
  );
}
