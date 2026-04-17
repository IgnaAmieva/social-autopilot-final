import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";

const features = [
  {
    icon: "🤖",
    title: "Generación con IA",
    desc: "Claude genera tweets auténticos en español, adaptados al tono y tema que elijas.",
  },
  {
    icon: "📅",
    title: "Programación inteligente",
    desc: "Distribuye automáticamente tus tweets a lo largo del día para maximizar alcance y consistencia.",
  },
  {
    icon: "🐦",
    title: "Multi-cuenta",
    desc: "Gestiona varias cuentas de X/Twitter desde un solo dashboard conectado con Typefully.",
  },
  {
    icon: "📊",
    title: "Analytics en tiempo real",
    desc: "Visualiza rendimiento, estados y actividad de tu sistema con una interfaz clara y usable.",
  },
];

const steps = [
  {
    step: "01",
    title: "Conectá tus cuentas",
    desc: "Importá desde Typefully las cuentas que querés automatizar y configurá su perfil editorial.",
  },
  {
    step: "02",
    title: "Generá contenido",
    desc: "Definí tema, frecuencia y tono. La IA crea tweets alineados a cada cuenta.",
  },
  {
    step: "03",
    title: "Editá, programá y sincronizá",
    desc: "Controlá todo desde tu app y mantené sincronizados los drafts con Typefully.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#f6f3f1] flex flex-col text-[#111111]">
      <Navbar />

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,88,28,0.18),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(255,255,255,0.95),_transparent_28%),linear-gradient(135deg,_#0a0a0a_0%,_#140707_38%,_#3c0d05_68%,_#ff4d1a_100%)] opacity-[0.14]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#ff6a2a]/50 to-transparent" />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 lg:py-28">
            <div className="max-w-4xl mx-auto text-center">
              <div className="mb-6 flex justify-center">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#ff6a2a]/20 bg-white/75 backdrop-blur px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c44717] shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-gradient-to-r from-[#ff7a2f] to-[#d12d10]" />
                  Potenciado por Claude AI
                </span>
              </div>


              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight text-[#0d1324] leading-[0.95] mb-6">
                Tu piloto automático
                <br />
                <span className="bg-gradient-to-r from-[#8f1208] via-[#ff5a1f] to-[#ff8b2f] bg-clip-text text-transparent">
                  para redes sociales
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-[#5d6678] max-w-3xl mx-auto mb-10 leading-relaxed">
                Generá, editá, sincronizá y programá contenido para múltiples cuentas
                desde una sola plataforma, con la identidad visual y operativa de{" "}
                <span className="font-semibold text-[#1a1a1a]">NDSocialAutopilot</span>.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl px-8 py-4 text-base font-semibold text-white transition-all shadow-[0_16px_40px_rgba(217,60,18,0.28)] bg-gradient-to-r from-[#8f1208] via-[#d63a12] to-[#ff6a2a] hover:brightness-110"
                >
                  <span>🚀</span>
                  Dashboard de Generación
                </Link>

                <Link
                  href="/analytics"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl px-8 py-4 text-base font-semibold border border-[#1b1b1b]/10 bg-white/90 text-[#171717] hover:bg-white transition-all shadow-sm"
                >
                  <span>📊</span>
                  Ver Analytics
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-black/5 bg-white/70 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#121212] text-center mb-12">
              Todo lo que necesitás
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-black/6 bg-gradient-to-b from-white to-[#fff7f3] p-6 shadow-[0_10px_30px_rgba(15,15,15,0.04)] hover:border-[#ff6a2a]/25 hover:shadow-[0_16px_40px_rgba(255,106,42,0.10)] transition-all"
                >
                  <div className="mb-4 text-3xl">{f.icon}</div>
                  <h3 className="mb-2 font-semibold text-[#161616]">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-[#666a73]">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#121212] text-center mb-12">
            ¿Cómo funciona?
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {steps.map((s) => (
              <div key={s.step} className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#8f1208] via-[#d63a12] to-[#ff7a2f] text-sm font-bold text-white shadow-[0_10px_24px_rgba(214,58,18,0.22)]">
                  {s.step}
                </div>
                <h3 className="mb-2 font-semibold text-[#181818]">{s.title}</h3>
                <p className="text-sm text-[#676b74] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#090909] text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_rgba(255,255,255,0.12),_transparent_18%),radial-gradient(circle_at_top_right,_rgba(255,86,28,0.28),_transparent_28%),linear-gradient(135deg,_#050505_0%,_#120404_35%,_#320a03_68%,_#ff4d1a_100%)] opacity-95" />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-14 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              Empezá a automatizar con NDSocialAutopilot
            </h2>
            <p className="mb-8 text-base text-white/75 max-w-2xl mx-auto">
              Conectá tus cuentas, definí la línea editorial y manejá todo desde un
              dashboard con identidad de marca y flujo profesional.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-base font-bold text-[#b92f0f] shadow-[0_12px_30px_rgba(255,255,255,0.14)] transition-all hover:bg-[#fff2eb]"
            >
              Ir al Dashboard →
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/6 bg-[#111111] text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-white/55">
          <span className="font-semibold text-white">NDSocialAutopilot</span>
          <span>Powered by Claude AI + Typefully</span>
          <div className="flex gap-4">
            <Link href="/dashboard" className="transition-colors hover:text-[#ff8b2f]">
              Dashboard
            </Link>
            <Link href="/analytics" className="transition-colors hover:text-[#ff8b2f]">
              Analytics
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}