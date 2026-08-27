export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
      <div className="text-[20px] font-bold mb-1">{title}</div>
      <div className="text-[13px] text-ink-muted">Écran en construction — voir docs/04-TODO.md (Phases 3–4).</div>
    </div>
  );
}
