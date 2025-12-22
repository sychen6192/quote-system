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

export default function SendEmailButton({ quote }: { quote: any }) {
  const [open, setOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // 檢查 Email 是否存在
  const email = quote.customer?.email;

  const handleSend = async (e: React.MouseEvent) => {
    // ⚠️ 關鍵：阻止 Dialog 點擊後自動關閉，我們要手動控制
    e.preventDefault();

    setIsSending(true);
    try {
      const res = await sendQuoteEmail(quote);

      if (res.success) {
        toast.success(`Email sent to ${email} successfully!`);
        setOpen(false); // 發送成功才關閉視窗
      } else {
        toast.error(res.error || "Failed to send email");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setIsSending(false);
    }
  };

  // 如果沒有 Email，按鈕直接 disable 並提示 (或是你可以隱藏按鈕)
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
          <Mail className="mr-2 h-4 w-4" /> Send Email
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Send Quotation?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            Are you sure you want to send this quotation to:
            <br />
            {/* 強調顯示客戶 Email，讓使用者最後確認一次 */}
            <span className="font-bold text-foreground block p-2 bg-muted rounded-md text-center">
              {email}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSending}>Cancel</AlertDialogCancel>

          <AlertDialogAction
            onClick={handleSend}
            disabled={isSending}
            className="min-w-[100px]"
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" /> Confirm Send
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
