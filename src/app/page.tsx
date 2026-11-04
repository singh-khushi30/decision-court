import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  description:
    "Decision Court examines a difficult decision from both sides and returns a balanced verdict, including what is still unknown and what would change the conclusion.",
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  return <LandingPage />;
}
