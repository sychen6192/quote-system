import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "brand" | "sky" | "amber" | "plain";

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  variant?: Variant;
}

const gradients: Record<Exclude<Variant, "plain">, string> = {
  brand: "bg-grad-brand",
  sky: "bg-grad-sky",
  amber: "bg-grad-amber",
};

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  variant = "plain",
}: StatCardProps) {
  const filled = variant !== "plain";
  return (
    <Card
      className={cn(
        "overflow-hidden",
        filled && `border-0 text-white shadow-brand ${gradients[variant]}`
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle
          className={cn("text-sm font-medium", filled && "text-white/85")}
        >
          {title}
        </CardTitle>
        <Icon
          className={cn(
            "h-4 w-4",
            filled ? "text-white/85" : "text-muted-foreground"
          )}
        />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight tabular-nums">
          {value}
        </div>
        <p
          className={cn(
            "text-xs",
            filled ? "text-white/75" : "text-muted-foreground"
          )}
        >
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
