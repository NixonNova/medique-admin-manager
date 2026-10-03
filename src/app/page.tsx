import Paper from "@mui/material/Paper";
import HelloPanel from "@/components/HelloPanel";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <Paper elevation={3} className="w-full max-w-xl rounded-2xl p-8 sm:p-10">
        <p className="mb-4 text-sm font-medium uppercase tracking-[0.14em] text-teal-700">
          Medique Admins Manager
        </p>
        <HelloPanel />
      </Paper>
    </main>
  );
}
