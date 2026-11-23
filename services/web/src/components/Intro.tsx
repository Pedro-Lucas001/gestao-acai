import { useEffect } from "react";
import { ArrowRight, Waves } from "lucide-react";
import { Brand } from "./Brand";

export function Intro({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) {
      onComplete();
      return;
    }
    const timer = window.setTimeout(onComplete, 1900);
    const changed = () => {
      if (motion.matches) onComplete();
    };
    motion.addEventListener("change", changed);
    return () => {
      window.clearTimeout(timer);
      motion.removeEventListener("change", changed);
    };
  }, [onComplete]);

  return (
    <main className="intro" aria-label="Abertura Netuno Açaí">
      <div className="intro-orbit intro-orbit-one" aria-hidden="true" />
      <div className="intro-orbit intro-orbit-two" aria-hidden="true" />
      <div className="intro-center">
        <div className="intro-mark">
          <Brand large />
        </div>
        <span className="intro-kicker">SEU NEGÓCIO, NO RUMO.</span>
        <h1>Seu espaço de organização.</h1>
        <div className="intro-line" aria-hidden="true">
          <span />
        </div>
        <button className="intro-skip" onClick={onComplete}>
          Entrar agora <ArrowRight size={16} />
        </button>
      </div>
      <span className="intro-footer">
        <Waves size={17} /> NETUNO AÇAÍ
      </span>
    </main>
  );
}
