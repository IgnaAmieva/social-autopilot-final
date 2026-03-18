import Link from "next/link";
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
    desc: "Distribuye automáticamente tus tweets a lo largo de 24 horas para máximo alcance.",
  },
  {
    icon: "🐦",
    title: "Multi-cuenta",
    desc: "Publica en hasta 20 cuentas de X/Twitter simultáneamente vía Typefully.",
  },
  {
    icon: "📊",
    title: "Analytics en tiempo real",
    desc: "Visualiza el rendimiento de tus tweets con gráficos detallados e insights.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      {/* Hero */}
      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          <span className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full mb-6 uppercase tracking-wide">
            Potenciado por Claude AI
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
            Tu piloto automático
            <br />
            <span className="text-blue-500">para redes sociales</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-10">
            Genera decenas de tweets auténticos en español con IA, distribúyelos entre tus cuentas
            y prográmalos automáticamente — todo en segundos.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold px-8 py-4 rounded-xl text-base transition-colors shadow-lg shadow-blue-500/25"
            >
              <span>🚀</span> Dashboard de Generación
            </Link>
            <Link
              href="/analytics"
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-100 text-gray-800 font-semibold px-8 py-4 rounded-xl text-base border border-gray-200 transition-colors"
            >
              <span>📊</span> Ver Analytics
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="bg-white border-t border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-12">
              Todo lo que necesitas
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((f) => (
                <div key={f.title} className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-colors">
                  <div className="text-3xl mb-4">{f.icon}</div>
                  <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-12">
            ¿Cómo funciona?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {[
              { step: "01", title: "Elige tu tema", desc: "Escribe el tema y el tono que quieres para tus tweets." },
              { step: "02", title: "La IA genera", desc: "Claude crea tweets únicos en español, con hashtags y emojis." },
              { step: "03", title: "Se publican solos", desc: "Los tweets se distribuyen automáticamente en tus cuentas de X." },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-12 h-12 bg-blue-500 text-white rounded-xl flex items-center justify-center font-bold text-sm mx-auto mb-4">
                  {s.step}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-blue-500 text-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              Empieza a generar tweets ahora
            </h2>
            <p className="text-blue-100 mb-8 text-base">
              Sin configuraciones complejas. Escribe el tema y listo.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-white text-blue-600 font-bold px-8 py-4 rounded-xl hover:bg-blue-50 transition-colors text-base"
            >
              Ir al Dashboard →
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-400">
          <span className="font-semibold text-gray-700">SocialAutopilot</span>
          <span>Powered by Claude AI + Typefully</span>
          <div className="flex gap-4">
            <Link href="/dashboard" className="hover:text-gray-700 transition-colors">Dashboard</Link>
            <Link href="/analytics" className="hover:text-gray-700 transition-colors">Analytics</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
