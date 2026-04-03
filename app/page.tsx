import { HomeLanding } from "@/components/marketing/home-landing";
import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";

export default async function Home() {
  const isAuthenticated = await isAuthenticatedNextjs();
  return <HomeLanding isAuthenticated={isAuthenticated} />;
}
