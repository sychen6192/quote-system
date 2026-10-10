"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { Slot } from "@radix-ui/react-slot"
import { useTranslations } from "next-intl"
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldError as RHFFieldError,
  type FieldPath,
  type FieldValues,
} from "react-hook-form"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { FieldError } from "@/components/ui/field-error"

const Form = FormProvider

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue | null>(
  null
)

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
  TTransformedValues = TFieldValues,
>(
  props: ControllerProps<TFieldValues, TName, TTransformedValues>
) => {
  const { name } = props
  const value = React.useMemo(() => ({ name }), [name])
  return (
    <FormFieldContext.Provider value={value}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

type FormItemPart = "description" | "message"

type FormItemContextValue = {
  id: string
  /** Which describing elements are mounted, so aria-describedby never points at a missing id. */
  parts: Record<FormItemPart, boolean>
  setPart: (part: FormItemPart, present: boolean) => void
}

const FormItemContext = React.createContext<FormItemContextValue | null>(null)

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState } = useFormContext()
  // Subscribes to this field only, so a keystroke elsewhere does not re-render it.
  const formState = useFormState({ name: fieldContext?.name })

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>")
  }
  if (!itemContext) {
    throw new Error("useFormField should be used within <FormItem>")
  }

  const fieldState = getFieldState(fieldContext.name, formState)
  const { id, parts, setPart } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    parts,
    setPart,
    ...fieldState,
  }
}

const FormItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const id = React.useId()
  const [parts, setParts] = React.useState<Record<FormItemPart, boolean>>({
    description: false,
    message: false,
  })
  const setPart = React.useCallback((part: FormItemPart, present: boolean) => {
    setParts((prev) =>
      prev[part] === present ? prev : { ...prev, [part]: present }
    )
  }, [])
  const value = React.useMemo(
    () => ({ id, parts, setPart }),
    [id, parts, setPart]
  )

  return (
    <FormItemContext.Provider value={value}>
      <div ref={ref} className={cn("space-y-2", className)} {...props} />
    </FormItemContext.Provider>
  )
})
FormItem.displayName = "FormItem"

const FormLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => {
  const { error, formItemId } = useFormField()

  return (
    <Label
      ref={ref}
      className={cn(error && "text-destructive", className)}
      htmlFor={formItemId}
      {...props}
    />
  )
})
FormLabel.displayName = "FormLabel"

const FormControl = React.forwardRef<
  React.ElementRef<typeof Slot>,
  React.ComponentPropsWithoutRef<typeof Slot>
>(({ "aria-describedby": describedByProp, ...props }, ref) => {
  const { error, formItemId, formDescriptionId, formMessageId, parts } =
    useFormField()

  const describedBy =
    [
      describedByProp,
      parts.description && formDescriptionId,
      parts.message && formMessageId,
    ]
      .filter(Boolean)
      .join(" ") || undefined

  return (
    <Slot
      ref={ref}
      id={formItemId}
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
      {...props}
    />
  )
})
FormControl.displayName = "FormControl"

const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { formDescriptionId, setPart } = useFormField()

  React.useEffect(() => {
    setPart("description", true)
    return () => setPart("description", false)
  }, [setPart])

  return (
    <p
      ref={ref}
      id={formDescriptionId}
      className={cn("text-[0.8rem] text-muted-foreground", className)}
      {...props}
    />
  )
})
FormDescription.displayName = "FormDescription"

// `translate` replaces the rarely used HTML translate="yes|no" attribute.
type FormMessageProps = Omit<
  React.HTMLAttributes<HTMLParagraphElement>,
  "children" | "translate"
> & {
  /**
   * Static content when there is no error, or a render function that receives
   * the error message (a zod message KEY in this app) and the error.
   */
  children?:
    | React.ReactNode
    | ((message: string, error: RHFFieldError) => React.ReactNode)
  /**
   * Maps the error message to display text. Defaults to the `Validation`
   * namespace when the message is a key there, else the raw message.
   */
  translate?: (message: string) => React.ReactNode
}

const FormMessage = React.forwardRef<HTMLParagraphElement, FormMessageProps>(
  ({ className, children, translate, ...props }, ref) => {
    const { error, formMessageId, setPart } = useFormField()
    const tValidation = useTranslations("Validation")

    // Field arrays put their own (e.g. "itemsRequired") error under `root`.
    const message = error?.message || error?.root?.message || ""
    let body: React.ReactNode
    if (error && message) {
      if (typeof children === "function") body = children(message, error)
      else if (translate) body = translate(message)
      else body = tValidation.has(message) ? tValidation(message) : message
    } else {
      body = typeof children === "function" ? null : children
    }
    const present = body != null && body !== false && body !== ""

    React.useEffect(() => {
      setPart("message", present)
    }, [present, setPart])
    React.useEffect(() => () => setPart("message", false), [setPart])

    if (!present) return null

    return (
      <FieldError
        ref={ref}
        id={formMessageId}
        className={className}
        {...props}
      >
        {body}
      </FieldError>
    )
  }
)
FormMessage.displayName = "FormMessage"

export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
}
export type { FormMessageProps }
