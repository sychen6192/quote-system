"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, Send, Loader2 } from "lucide-react";
import { sendQuoteEmail } from "@/actions/send-email";
import { toast } from "sonner";
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
import { type InferSelectModel } from "drizzle-orm";
import { customers, quotations, quotationItems } from "@/db/schema";
import { useTranslations } from "next-intl";

type QuoteWithRelations = InferSelectModel<typeof quotations> & {
  customer: InferSelectModel<typeof customers> | null;
  items: InferSelectModel<typeof quotationItems>[];
};

interface QuoteActionsProps {
  quote: QuoteWithRelations;
}

export default function SendEmailButton({ quote }: QuoteActionsProps) {
  const t = useTranslations("QuoteActions");

  const [open, setOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const name = quote.customer?.companyName;
  const email = quote.customer?.email;

  const handleSend = async (e: React.MouseEvent) => {
    e.preventDefault();

    setIsSending(true);
    try {
      const res = await sendQuoteEmail(quote);

      if (res.success) {
        toast.success(t("success"));
        setOpen(false);
      } else {
        toast.error(res.error || t("error"));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  if (!email) {
    return (
      <Button variant="outline" size="sm" disabled title="No email address">
        <Mail className="mr-2 h-4 w-4" /> No Email
      </Button>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Mail className="mr-2 h-4 w-4" />
          {t("sendEmail")}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("dialogTitle")}</AlertDialogTitle>{" "}
          <AlertDialogDescription className="space-y-2">
            {t("dialogDesc")} <b>{name}</b>
            <br />
            <span className="font-bold text-foreground block p-2 bg-muted rounded-md text-center">
              {email}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSending}>
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSend}
            disabled={isSending}
            className="min-w-[100px]"
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                {t("sending")}{" "}
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" /> {t("confirmSend")}{" "}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
