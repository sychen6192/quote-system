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

const chipClass: Record<Variant, string> = {
  brand: "bg-white/20 text-white",
  sky: "bg-sky-100 text-sky-600 dark:bg-sky-400/20 dark:text-sky-300",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300",
  plain: "bg-accent text-primary",
};

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  variant = "plain",
}: StatCardProps) {
  const filled = variant === "brand";
  return (
    <Card
      className={cn(
        filled && "border-0 bg-primary text-primary-foreground shadow-md shadow-primary/20"
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle
          className={cn(
            "text-sm font-medium",
            filled ? "text-primary-foreground/85" : "text-muted-foreground"
          )}
        >
          {title}
        </CardTitle>
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            chipClass[variant]
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight tabular-nums">
          {value}
        </div>
        <p
          className={cn(
            "text-xs",
            filled ? "text-primary-foreground/75" : "text-muted-foreground"
          )}
        >
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
