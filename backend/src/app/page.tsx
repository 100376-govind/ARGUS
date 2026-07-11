import { redirect } from "next/navigation";

/**
 * Root page — redirects to API docs since this is an API-only backend.
 */
export default function RootPage() {
  redirect("/api/docs");
}

