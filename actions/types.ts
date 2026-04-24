export type ActionResult =
  | { success: true }
  | { success: false; code: 'VALIDATION'; fieldErrors: Record<string, string[] | undefined> }
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'INTERNAL'; message: string };
