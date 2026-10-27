import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  description:
    "Two AI agents argue both sides of a difficult decision. A judge weighs the evidence. You get a clear, balanced verdict.",
};

export default function Home() {
  return <LandingPage />;
}
