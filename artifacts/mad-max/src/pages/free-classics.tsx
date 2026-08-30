import { Navbar } from "@/components/navbar";
import { FreeClassicsSection } from "@/components/free-classics";

export default function FreeClassics() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <Navbar />
      <main className="pt-[4.5rem]">
        <FreeClassicsSection fullPage />
      </main>
    </div>
  );
}