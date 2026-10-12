import Link from 'next/link';
import { ArrowUpRight, ArrowRight, Heart, ShieldCheck, Leaf, RotateCcw, ChevronRight, Wrench, Database, Recycle } from 'lucide-react';
import Brand from '../components/Brand';
import HeroFilm from '../components/HeroFilm';
export default function Home() {
    return <main className="yenlap-page">
    <header className="yenlap-nav">
      <Link href="/" className="yenlap-home-link" aria-label="YenLap home"><Brand /></Link>
      <nav aria-label="Main navigation"><a href="#how">How it works</a><a href="#promise">Our promise</a><Link href="/workspace">Track my laptop</Link></nav>
      <Link href="/workspace" className="button green">Give it another life <ArrowUpRight size={16}/></Link>
    </header>
    <section className="yenlap-hero" aria-labelledby="yenlap-title">
      <HeroFilm />
      <div className="yenlap-hero-content">
        <h1 id="yenlap-title"><Brand large/></h1>
        <p className="yenlap-tagline">Keep the memories. Give it another life.</p>
        <div className="yenlap-pillars" aria-label="Our four principles">
          <span><Wrench strokeWidth={1.8}/><span>Repair</span></span>
          <span><RotateCcw strokeWidth={1.8}/><span>Refurbish</span></span>
          <span><Database strokeWidth={1.8}/><span>Recover</span></span>
          <span><Recycle strokeWidth={1.8}/><span>Reuse</span></span>
        </div>
        <div className="yenlap-hero-actions"><Link href="/workspace" className="button green">Give my laptop a new life <ArrowUpRight size={17}/></Link><Link href="/workspace" className="button outline">Track my laptop <ArrowRight size={16}/></Link></div>
        <p className="yenlap-trust"><ShieldCheck size={15}/> Verified ownership. Secure recovery. Your data returned free.</p>
      </div>
    </section>
    <section id="how" className="how section yenlap-how"><div className="section-heading"><div><span className="eyebrow">OLD DEVICES. NOT THE END.</span><h2>Same memories.<br /><em>A brighter tomorrow.</em></h2></div><p>We attempt restoration, keep you part of the story,<br />and give you the first choice to bring it home.</p></div>
      <div className="steps">{[
            ['01', 'Tell us its story', 'Register your old laptop, share its condition and photos, and request a collection.'],
            ['02', 'We find the possibility', 'Our technicians diagnose and attempt restoration. Personal data recovery needs your consent and verified ownership.'],
            ['03', 'You get the first choice', 'If restored, reclaim the same laptop for its restoration cost — or let it begin a new life with someone else.'],
            ['04', 'Your memories come home', 'Recoverable personal data is returned securely to the verified original owner, free of charge.']
        ].map(([n, t, p]) => <article key={n}><span className="step-number">{n}</span><h3>{t}</h3><p>{p}</p><ChevronRight size={20}/></article>)}</div>
    </section>
    <section id="promise" className="promise section yenlap-promise"><span className="eyebrow">NEW LIFE. SAME MEMORIES. A GREENER TOMORROW.</span><h2>Care for your memories.<br /><em>Care for what comes next.</em></h2><div className="promise-grid">
      <article><ShieldCheck /><h3>Your memories stay yours.</h3><p>Recovery happens with your consent and verified ownership. Recoverable data return is free; storage sanitization is required before resale.</p></article>
      <article><Heart /><h3>You always come first.</h3><p>The restored laptop is offered to its original owner first. Follow every milestone, choose to bring it home, or gracefully close your chapter.</p></article>
      <article><Leaf /><h3>A future with less waste.</h3><p>Restored devices find another useful life. Devices beyond repair move into a documented recycling process.</p></article>
    </div></section>
    <section className="final-cta"><div><span className="eyebrow">THAT LAPTOP IN YOUR CUPBOARD?</span><h2>Its story isn’t over yet.</h2></div><Link href="/workspace" className="button green">Let’s give it another life <ArrowUpRight size={18}/></Link></section>
    <footer><Link href="/" aria-label="YenLap home"><Brand /></Link><span>Keep the memories. Give it another life.</span><span>Repair. Refurbish. Recover. Reuse.</span></footer>
  </main>;
}
