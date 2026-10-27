import { cn } from "@/lib/utils";

export function AgentPortrait({ role }: { role: "advocate" | "challenger" }) {
  const advocate = role === "advocate";

  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative h-48 overflow-hidden rounded-t-[1.4rem] sm:h-56",
        advocate
          ? "bg-[linear-gradient(180deg,#f6eadc,#e4c9aa)]"
          : "bg-[linear-gradient(180deg,#e6e0d8,#cfc6bc)]",
      )}
    >
      <div
        className={cn(
          "absolute top-[-18%] h-[92%] w-[70%] rounded-t-[999px] border border-white/40",
          advocate ? "right-[8%]" : "left-[8%]",
        )}
      />
      <svg viewBox="0 0 240 180" className="absolute inset-x-0 bottom-0 h-full w-full">
        <path
          d={
            advocate
              ? "M78 180 C78 112, 108 78, 142 78 C176 78, 196 114, 198 180"
              : "M42 180 C44 114, 64 78, 98 78 C132 78, 162 112, 162 180"
          }
          fill={advocate ? "#c4a27a" : "#8f8478"}
        />
        <circle
          cx={advocate ? 146 : 94}
          cy="74"
          r="28"
          fill={advocate ? "#b8926a" : "#7e746a"}
        />
      </svg>
      <span
        className={cn(
          "absolute font-serif text-5xl font-medium",
          advocate ? "top-5 left-5 text-brass-deep/80" : "top-5 right-5 text-espresso/70",
        )}
      >
        {advocate ? "A" : "C"}
      </span>
    </div>
  );
}
