import { ArrowRight, Check, Cloud, Cpu, KeyRound, LockKeyhole, Minus, Monitor, Plus, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { ChannelForm } from "@/components/ChannelForm";

// Sample images are fictional (AI-generated for the design), not any real channel's thumbnails.
const FEED = ["phone", "headphones", "car", "laptop", "mine", "watch"];

const STEPS = [
  ["Elige un canal", "Traemos sus videos más vistos entre los últimos 200, sin Shorts. Tú decides cuáles usar como referencia."],
  ["Estudiamos el estilo", "Un modelo con visión describe encuadre, expresión, paleta y texto, y lista lo que no hay que copiar."],
  ["Conceptos para tu video", "Describe tu video y recibes 3 conceptos editables: prompt, título, posición y colores."],
  ["Genera y compara", "Generamos con tu modelo, añadimos el título y te mostramos tu miniatura en el feed junto a las del canal."],
];

const PALETTE: [string, number][] = [["#0E0E10", 38], ["#1B2A4A", 19], ["#E8E4DC", 13], ["#FF6A1A", 10], ["#2DD4BF", 8], ["#6B21A8", 6]];

const LOCAL = [
  ["Ollama", "Análisis", "Modelos con visión como qwen2.5vl o gemma3"],
  ["ComfyUI", "Imágenes", "SDXL o FLUX; con Redux toma el estilo de las referencias"],
  ["LM Studio y compatibles", "Análisis", "Cualquier servidor con API de OpenAI en tu máquina"],
];
const CLOUD = [
  ["Gemini", "Gratis para análisis", "Nivel gratuito de Google AI Studio; también genera imágenes"],
  ["Claude", "Análisis", "El análisis de estilo más fiel"],
  ["OpenAI", "Ambos", "GPT para analizar y gpt-image para generar"],
  ["fal.ai y Replicate", "Imágenes", "FLUX Pro, Kontext, Redux, Ideogram, Nano Banana"],
];

const FAQ = [
  ["¿Cuesta algo?", "No. El sitio es gratis. Si usas modelos en tu PC no pagas nada; si usas una API externa, pagas a ese proveedor con tu propia key."],
  ["¿Por qué a veces dice que no puede procesar mi solicitud?", "Consultamos YouTube con una cuota diaria compartida. Si se agota, te avisamos y vuelve a funcionar al día siguiente. Los canales ya consultados siguen disponibles."],
  ["¿Cómo conecto Ollama o ComfyUI?", "Tienen que estar abiertos y permitir este sitio (CORS). En Ajustes te damos el comando exacto para tu sistema y un botón para probar la conexión."],
  ["¿Funciona en Safari?", "Con APIs externas sí. Para modelos locales usa Chrome o Edge: Safari bloquea las conexiones a tu propio equipo desde un sitio seguro."],
];

function ModelGroup({ title, sub, icon, rows }: { title: string; sub: string; icon: React.ReactNode; rows: string[][] }) {
  return (
    <div className="flex-1 overflow-hidden rounded-[14px] border border-border bg-bg">
      <div className="flex items-center gap-3 border-b border-border px-6 py-5">
        {icon}
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-[13px] text-subtle">{sub}</p>
        </div>
      </div>
      {rows.map(([name, role, note], i) => (
        <div key={name} className={`flex items-center gap-4 px-6 py-4 ${i < rows.length - 1 ? "border-b border-border" : ""}`}>
          <div className="flex-1">
            <p className="text-[15px] font-semibold">{name}</p>
            <p className="text-[13px] text-muted">{note}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${role.startsWith("Gratis") ? "bg-highlight/10 text-highlight" : "bg-surface-2 text-muted"}`}>
            {role}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Landing() {
  return (
    <main>
      <nav className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-4 sm:px-20 sm:py-6">
        <Brand />
        <div className="hidden items-center gap-9 text-sm text-muted md:flex">
          <a href="#como-funciona" className="hover:text-text">Cómo funciona</a>
          <a href="#modelos" className="hover:text-text">Modelos</a>
          <a href="#modelos" className="hover:text-text">Privacidad</a>
          <a href="#preguntas" className="hover:text-text">Preguntas</a>
        </div>
        <Link href="/studio" className="flex items-center gap-2 rounded-lg bg-text px-4 py-2.5 text-sm font-semibold text-bg">
          Abrir el estudio <ArrowRight className="size-4" />
        </Link>
      </nav>

      {/* Hero */}
      <section className="mx-auto flex max-w-[1440px] flex-col items-center gap-12 px-4 pb-16 pt-6 sm:px-20 sm:pb-24 sm:pt-16 lg:flex-row lg:gap-16">
        <div className="flex w-full flex-col gap-7 lg:w-[560px] lg:shrink-0">
          <span className="flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] text-muted">
            <span className="size-1.5 rounded-full bg-accent" /> Para creadores de YouTube · gratis
          </span>
          <h1 className="font-display text-[46px] leading-[1.02] sm:text-[76px] sm:leading-[78px]">
            EL ESTILO QUE YA FUNCIONA.
            <br />
            <span className="text-highlight">LA IDEA ES TUYA.</span>
          </h1>
          <p className="text-base leading-[26px] text-muted sm:text-lg sm:leading-[28px]">
            Pega un canal: tomamos sus videos más vistos, estudiamos cómo son sus miniaturas —encuadre, expresión, paleta, texto— y generamos miniaturas para tu video con ese estilo. Nunca copiamos sus temas.
          </p>
          <ChannelForm />
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-subtle">
            <span className="flex items-center gap-1.5"><Cpu className="size-[15px]" /> Tus modelos locales</span>
            <span className="flex items-center gap-1.5"><KeyRound className="size-[15px]" /> o tus API keys</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="size-[15px]" /> Nada se guarda en el servidor</span>
          </div>
        </div>

        <div className="w-full flex-1 rounded-2xl border border-border bg-feed p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[13px] font-semibold text-muted">Así se ve en el feed</p>
            <span className="flex items-center gap-1.5 text-xs text-muted"><span className="h-1 w-3.5 rounded-sm bg-accent" /> tu miniatura</span>
          </div>
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
            {FEED.map((name) => (
              <div key={name} className="flex flex-col gap-2">
                <div className="relative h-[132px] overflow-hidden rounded-lg bg-surface-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/samples/${name}.jpg`} alt="" className="size-full object-cover" />
                  {name === "mine" && <span className="absolute inset-x-0 bottom-0 h-1.5 bg-accent" />}
                </div>
                <div className="flex flex-col gap-[5px]">
                  <span className="h-2 rounded bg-border" />
                  <span className="h-1.5 w-[70px] rounded bg-surface-2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="border-y border-border bg-surface">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-14 px-4 py-16 sm:px-20 sm:py-24">
          <div className="flex max-w-[720px] flex-col gap-3.5">
            <p className="kicker">Cómo funciona</p>
            <h2 className="font-display text-4xl leading-[1.08] sm:text-5xl">De un canal que funciona a tu miniatura en 4 pasos</h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, body], i) => (
              <div key={title} className={`flex flex-col gap-3.5 border-t-2 pt-6 ${i === 0 ? "border-accent" : "border-border"}`}>
                <span className={`font-display text-[40px] ${i === 0 ? "text-accent" : "text-subtle"}`}>0{i + 1}</span>
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="text-[15px] leading-[23px] text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Style, not ideas */}
      <section className="mx-auto flex max-w-[1440px] flex-col items-center gap-12 px-4 py-20 sm:px-20 sm:py-28 lg:flex-row lg:gap-20">
        <div className="flex w-full flex-col gap-6 rounded-2xl border border-border bg-surface p-5 sm:p-7 lg:w-[620px] lg:shrink-0">
          <div className="flex gap-2">
            {["phone", "headphones", "laptop", "watch"].map((n) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={n} src={`/samples/${n}.jpg`} alt="" className="h-[78px] min-w-0 flex-1 rounded-md object-cover" />
            ))}
          </div>
          <div className="flex flex-col gap-2.5">
            <p className="label">Paleta compartida</p>
            <div className="flex h-7 overflow-hidden rounded-md">
              {PALETTE.map(([c, w]) => <span key={c} style={{ background: c, flexGrow: w }} />)}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["Tomamos", <Check key="i" className="size-4 text-success" />, ["Primer plano, sujeto a un lado", "Una sola luz dura y fondo oscuro", "2–3 palabras, una resaltada", "Alto contraste, un color de acento"]],
              ["Evitamos", <X key="i" className="size-4 text-accent" />, ["Sus productos y marcas", "Sus títulos y frases", "Sus personas y su set", "Sus temas de video"]],
            ].map(([title, icon, items]) => (
              <div key={title as string} className="flex flex-col gap-3 rounded-[10px] bg-bg p-[18px]">
                <p className="flex items-center gap-2 text-sm font-semibold">{icon}{title as string}</p>
                {(items as string[]).map((t) => <p key={t} className="text-[13px] text-muted">{t}</p>)}
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-5">
          <p className="kicker">La regla</p>
          <h2 className="font-display text-4xl leading-[1.06] sm:text-[52px]">Copiamos el estilo. Nunca la idea.</h2>
          <p className="text-[17px] leading-[27px] text-muted">
            Las miniaturas más vistas de un canal comparten un lenguaje: cómo encuadran, cuánta emoción muestran, qué colores repiten y cómo usan el texto. Eso es lo que medimos y lo que aplicamos a tu video.
          </p>
          <p className="text-[17px] leading-[27px] text-muted">
            El análisis también lista lo concreto de esos videos para que el generador lo deje fuera. Tu miniatura se parece al canal, pero habla de tu video.
          </p>
        </div>
      </section>

      {/* Models and keys */}
      <section id="modelos" className="border-y border-border bg-surface">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-12 px-4 py-16 sm:px-20 sm:py-24">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="flex max-w-[640px] flex-col gap-3.5">
              <p className="kicker">Tus modelos, tus keys</p>
              <h2 className="font-display text-4xl leading-[1.08] sm:text-5xl">Úsalo gratis en tu PC o con la API que ya pagas</h2>
            </div>
            <p className="max-w-[360px] text-[15px] leading-[23px] text-muted">No hay cuentas ni planes. Tu navegador habla directo con tus modelos.</p>
          </div>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <ModelGroup title="En tu PC" sub="Gratis, privado, sin límites" icon={<Monitor className="size-5" />} rows={LOCAL} />
            <ModelGroup title="En la nube, con tu key" sub="Pagas solo lo que uses a cada proveedor" icon={<Cloud className="size-5" />} rows={CLOUD} />
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-success/25 bg-success/[0.08] px-6 py-5">
            <LockKeyhole className="size-5 shrink-0 text-success" />
            <p className="text-sm leading-normal">
              Tus API keys y tus imágenes se quedan en tu navegador. Van directo a cada proveedor; nuestro servidor solo consulta YouTube y nunca guarda keys ni miniaturas.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="preguntas" className="mx-auto flex max-w-[1440px] flex-col gap-10 px-4 py-16 sm:px-20 sm:py-24 lg:flex-row lg:gap-20">
        <div className="flex flex-col gap-3.5 lg:w-[380px] lg:shrink-0">
          <p className="kicker">Preguntas</p>
          <h2 className="font-display text-4xl leading-[1.1]">Lo que conviene saber antes de empezar</h2>
        </div>
        <div className="flex-1 border-t border-border">
          {FAQ.map(([q, a], i) => (
            <details key={q} open={i === 0} className="group border-b border-border py-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                {q}
                <Plus className="size-[18px] shrink-0 text-muted group-open:hidden" /><Minus className="hidden size-[18px] shrink-0 text-muted group-open:block" />
              </summary>
              <p className="mt-2.5 max-w-[640px] text-[15px] leading-[24px] text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border bg-[radial-gradient(ellipse_at_bottom,rgba(255,59,48,0.15),transparent_70%)]">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-7 px-4 py-20 text-center sm:px-20 sm:py-24">
          <h2 className="font-display text-4xl sm:text-[64px]">¿QUÉ CANAL QUIERES ESTUDIAR?</h2>
          <p className="text-[17px] text-muted">Pega un @handle y en un minuto ves qué hace que sus miniaturas funcionen.</p>
          <ChannelForm className="w-full max-w-[620px]" />
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-3 px-4 py-7 text-[13px] text-subtle sm:flex-row sm:px-20">
          <span>ThumbStudio · Hecho para creadores</span>
          <div className="flex gap-6">
            <a href="#modelos">Privacidad</a>
            <a href="#preguntas">Cómo conectar modelos locales</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
