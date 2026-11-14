import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Activity, AirVent, FlaskConical, Snowflake, Thermometer, Zap } from 'lucide-react'

export function AuthLayout({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string
  subtitle: string
  footer: ReactNode
  children: ReactNode
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-[#070d19] lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_20%_0%,rgb(56_189_248/0.22),transparent_60%),radial-gradient(ellipse_60%_60%_at_100%_100%,rgb(99_102_241/0.22),transparent_55%)]" />
        <div className="app-grid-bg absolute inset-0 opacity-40" />

        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-[linear-gradient(145deg,#38BDF8,#6366F1)] text-white shadow-[0_8px_30px_-8px_rgb(56_189_248/0.8)]">
              <Snowflake className="size-5" strokeWidth={2.2} />
            </span>
            <span>
              <span className="block text-[15px] leading-tight font-semibold tracking-tight text-white">
                CoolSense
              </span>
              <span className="block text-[10px] font-medium tracking-[0.16em] text-white/40 uppercase">
                AC Intelligence
              </span>
            </span>
          </Link>

          <div className="max-w-md">
            <p className="text-[10.5px] font-semibold tracking-[0.2em] text-[#7DD3FC] uppercase">
              Software-defined cooling
            </p>
            <h1 className="mt-4 text-[34px] leading-[1.15] font-semibold tracking-[-0.03em] text-white xl:text-[40px]">
              Every virtual AC, every degree, under control.
            </h1>
            <p className="mt-4 text-[13.5px] leading-6 text-white/55">
              Monitor rooms, drive compressor behaviour and run physics-accurate experiments — all
              without a single piece of hardware.
            </p>

            <div className="mt-9 grid gap-2.5">
              {[
                { icon: AirVent, label: 'Virtual AC fleet', value: '5 units modelled' },
                { icon: Thermometer, label: 'Thermal simulation', value: 'Lumped-capacitance model' },
                { icon: Zap, label: 'Energy intelligence', value: 'Live kWh + tariff costing' },
                { icon: FlaskConical, label: 'Experiment lab', value: 'Inverter vs fixed-speed' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5 backdrop-blur-sm"
                >
                  <span className="grid size-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-[#7DD3FC]">
                    <item.icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11.5px] font-medium text-white/85">{item.label}</p>
                    <p className="text-[10.5px] text-white/40">{item.value}</p>
                  </div>
                  <Activity className="ml-auto size-3.5 text-white/20" />
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10.5px] text-white/30">
            © {new Date().getFullYear()} CoolSense Labs · Simulation-based estimates, not laboratory
            measurements.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid size-9 place-items-center rounded-xl bg-[linear-gradient(145deg,#38BDF8,#6366F1)] text-white">
              <Snowflake className="size-5" strokeWidth={2.2} />
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-fg">CoolSense</span>
          </div>
          <h2 className="text-[24px] leading-tight font-semibold tracking-[-0.025em] text-fg">{title}</h2>
          <p className="mt-1.5 text-[12.5px] leading-5 text-muted">{subtitle}</p>
          <div className="mt-7">{children}</div>
          <div className="mt-6 text-[12px] text-muted">{footer}</div>
        </div>
      </div>
    </div>
  )
}
