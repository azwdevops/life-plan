import { redirect } from "next/navigation";

export default function TimeTrackingPage() {
  redirect("/productivity?tab=tracking");
}
