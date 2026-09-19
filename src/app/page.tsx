import { HuntApp } from "@/components/hunt-app";
import { ListingsProvider } from "@/lib/listings-context";

export default function Home() {
  return (
    <ListingsProvider>
      <HuntApp />
    </ListingsProvider>
  );
}
