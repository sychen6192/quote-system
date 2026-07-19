"use client";

import { useState } from "react";
import { useRouter } from "@/navigation";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { deleteQuote } from "@/actions/delete-quote";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Props {
  id: number;
  quotationNumber: string;
  variant?: "icon" | "button";
}

export function DeleteQuoteButton({
  id,
  quotationNumber,
  variant = "icon",
}: Props) {
  const t = useTranslations("DeleteQuote");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const handleConfirm = async () => {
    setPending(true);
    try {
      const res = await deleteQuote(id);
      if (res.success) {
        toast.success(t("deleted"));
        setOpen(false);
        router.push("/quotes");
        router.refresh();
      } else {
        toast.error(t("error"));
      }
    } catch (err) {
      console.error(err);
      toast.error(t("error"));
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {variant === "icon" ? (
          <Button variant="ghost" size="icon" title={t("delete")}>
            <Trash2 className="h-4 w-4 text-muted-foreground transition-colors hover:text-destructive" />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Trash2 className="mr-2 h-4 w-4" /> {t("delete")}
          </Button>
        )}
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("desc")} <b>{quotationNumber}</b>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("deleting")}
              </>
            ) : (
              t("confirm")
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
