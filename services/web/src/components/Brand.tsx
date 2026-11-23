export function Brand({ large = false }: { large?: boolean }) {
  return (
    <div className={`brand ${large ? "brand-large" : ""}`}>
      <div className="logo-frame">
        <img src="/netuno-logo.jpg" alt="Netuno Açaí" />
      </div>
      {!large && <span>GESTÃO DO NEGÓCIO</span>}
    </div>
  );
}
