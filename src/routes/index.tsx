import { createFileRoute } from "@tanstack/react-router";
import { DuskGame } from "@/components/dusk-game";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <DuskGame />;
}
