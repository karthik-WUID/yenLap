export default function Brand({ large = false }: {
    large?: boolean;
}) {
    return <span className={large ? "yenlap-wordmark yenlap-wordmark-large" : "yenlap-wordmark"} aria-label="YenLap">
    <span>Yen</span><span className="yenlap-brand-green">Lap<svg className="yenlap-brand-leaf" viewBox="0 0 80 52" aria-hidden="true"><path d="M7 48C9 13 39 4 74 3C72 35 50 53 20 43C29 31 43 22 59 13C39 18 21 31 7 48Z" fill="currentColor"/></svg></span>
  </span>;
}
