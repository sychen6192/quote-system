import { renderToString } from "react-dom/server";
import { useForm, type FieldError as RHFFieldError } from "react-hook-form";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  type FormMessageProps,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Toggle } from "@/components/ui/toggle";

// next-intl ships ESM only; the primitives need just useTranslations + t.has.
jest.mock("next-intl", () => {
  const dict: Record<string, Record<string, string>> = {
    Validation: { invalidEmail: "電子郵件格式不正確", itemsRequired: "至少需要一個品項" },
  };
  return {
    useTranslations: (ns: string) => {
      const t = (key: string) => dict[ns]?.[key] ?? `${ns}.${key}`;
      t.has = (key: string) => key in (dict[ns] ?? {});
      return t;
    },
  };
});

type Values = { email: string; items: { name: string }[] };

function EmailField({
  error,
  messageProps,
}: {
  error?: RHFFieldError;
  messageProps?: FormMessageProps;
}) {
  const form = useForm<Values>({ defaultValues: { email: "", items: [] } });
  // setError during render is visible to the same server render (no effects).
  if (error) form.setError("email", error);
  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage {...messageProps} />
          </FormItem>
        )}
      />
    </Form>
  );
}

const attr = (html: string, tag: string, name: string) =>
  new RegExp(`<${tag}[^>]*\\s${name}="([^"]*)"`).exec(html)?.[1];

describe("Form primitives (server render)", () => {
  it("links the label to the control and marks it invalid", () => {
    const html = renderToString(
      <EmailField error={{ type: "manual", message: "invalidEmail" }} />
    );
    const id = attr(html, "input", "id");
    expect(id).toBeTruthy();
    expect(attr(html, "label", "for")).toBe(id);
    expect(attr(html, "input", "aria-invalid")).toBe("true");
    expect(html).toMatch(/<p role="alert"[^>]*>電子郵件格式不正確<\/p>/);
  });

  it("renders no message and no aria-invalid without an error", () => {
    const html = renderToString(<EmailField />);
    expect(attr(html, "input", "aria-invalid")).toBeUndefined();
    expect(html).not.toContain('role="alert"');
  });

  it("shows a message that is not a Validation key as is", () => {
    const html = renderToString(
      <EmailField error={{ type: "server", message: "Email already used" }} />
    );
    expect(html).toContain(">Email already used</p>");
  });

  it("lets callers translate the key or render it themselves", () => {
    const translated = renderToString(
      <EmailField
        error={{ type: "manual", message: "invalidEmail" }}
        messageProps={{ translate: (key) => `T(${key})` }}
      />
    );
    expect(translated).toContain(">T(invalidEmail)</p>");

    const rendered = renderToString(
      <EmailField
        error={{ type: "custom", message: "invalidEmail" }}
        messageProps={{ children: (message, error) => `${error.type}:${message}` }}
      />
    );
    expect(rendered).toContain(">custom:invalidEmail</p>");
  });

  it("shows a field array's root error", () => {
    function Items() {
      const form = useForm<Values>({ defaultValues: { email: "", items: [] } });
      // zodResolver puts array-level errors at `<name>.root`; setError's
      // types do not model that path, but it stores it the same way.
      form.setError("items.root" as "items", { type: "min", message: "itemsRequired" });
      return (
        <Form {...form}>
          <FormField
            control={form.control}
            name="items"
            render={() => (
              <FormItem>
                <FormMessage />
              </FormItem>
            )}
          />
        </Form>
      );
    }
    expect(renderToString(<Items />)).toContain(">至少需要一個品項</p>");
  });
});

describe("Checkbox", () => {
  it("shows the dash for an uncontrolled indeterminate default", () => {
    const html = renderToString(<Checkbox defaultChecked="indeterminate" aria-label="all" />);
    expect(html).toContain('aria-checked="mixed"');
    expect(html).toMatch(/<span[^>]*data-state="indeterminate"[^>]*class="group /);
    expect(html).toContain("group-data-[state=indeterminate]:block");
  });
});

describe("Toggle", () => {
  it("exposes its state with aria-pressed", () => {
    expect(renderToString(<Toggle aria-label="bold" />)).toContain('aria-pressed="false"');
    expect(renderToString(<Toggle aria-label="bold" defaultPressed />)).toMatch(
      /aria-pressed="true" data-state="on"/
    );
  });
});
