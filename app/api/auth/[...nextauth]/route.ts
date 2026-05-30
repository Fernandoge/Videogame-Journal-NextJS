// app/api/auth/[...nextauth]/route.ts
//
// This file is intentionally tiny. All configuration lives in auth.ts at the root.
//
// The [...nextauth] folder name is a Next.js "catch-all route" — the [...param]
// syntax means this single file handles ALL of these URLs:
//   /api/auth/signin
//   /api/auth/callback/google
//   /api/auth/signout
//   /api/auth/session
//   ... and any other /api/auth/* path NextAuth needs
//
// We destructure GET and POST out of the handlers object NextAuth generated.
// `handlers` is { GET: fn, POST: fn } — exporting the object itself as GET
// would hand an object where Next.js expects a function (causes "r is not a function").
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
