// Voiant wordmark — teal bracketed "V" + uppercase wordmark, matching voiantclinical.com.
export default function VoiantLogo({
  onDark = true,
  size = "md",
}: {
  onDark?: boolean;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "h-7 w-7 text-base" : "h-9 w-9 text-xl";
  const word = size === "sm" ? "text-base" : "text-xl";
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`grid ${box} place-items-center rounded-[3px] border-2 border-brand font-display font-extrabold text-brand`}
      >
        V
      </div>
      <span
        className={`font-display ${word} font-extrabold uppercase tracking-[0.04em] ${
          onDark ? "text-white" : "text-navy"
        }`}
      >
        Voiant
        <sup className="ml-0.5 text-[0.5em] align-super text-brand">®</sup>
      </span>
    </div>
  );
}
