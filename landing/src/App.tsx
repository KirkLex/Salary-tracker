import { useRef } from "react"
import { ArrowRight, CalendarRange, Wallet } from "lucide-react"
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

const days = Array.from({ length: 31 }, (_, index) => index + 1)
const incomeDays = new Set([5, 18])
const expenseDays = new Set([3, 7, 9, 16, 21])

export default function App() {
  const paused = useReducedMotion() ?? false
  const threadRef = useRef<HTMLElement>(null)
  const { scrollY } = useScroll()
  const { scrollYProgress: threadProgress } = useScroll({
    target: threadRef,
    offset: ["start end", "end start"],
  })

  const glowY = useTransform(scrollY, (value) => (paused ? 0 : value * 0.15))
  const boardY = useTransform(scrollY, (value) => (paused ? 0 : value * -0.12))
  const titleY = useTransform(scrollY, (value) => (paused ? 0 : value * 0.28))
  const slipY = useTransform(scrollY, (value) => (paused ? 0 : value * -0.22))
  const threadX = useTransform(threadProgress, [0, 1], paused ? [0, 0] : [-80, 90])
  const threadY = useTransform(threadProgress, [0, 1], paused ? [0, 0] : [70, -90])
  const backY = useTransform(threadProgress, [0, 1], paused ? [0, 0] : [120, -40])

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <motion.div
        aria-hidden
        style={{ y: glowY }}
        className="pointer-events-none absolute inset-x-0 top-0 h-[140vh]"
      >
        <div className="absolute -left-24 top-10 size-[28rem] rounded-full bg-[oklch(0.78_0.12_45)]/30 blur-3xl" />
        <div className="absolute right-0 top-40 size-[22rem] rounded-full bg-[oklch(0.78_0.08_150)]/35 blur-3xl" />
      </motion.div>

      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <a href="#top" className="font-heading text-xl">Финансы</a>
          <nav className="hidden items-center gap-5 text-sm text-muted-foreground sm:flex">
            <a href="#layers" className="hover:text-foreground">Слои</a>
            <a href="#thread" className="hover:text-foreground">Нить месяца</a>
            <a href="#start" className="hover:text-foreground">Старт</a>
          </nav>
          <Button asChild size="lg" className="h-10 px-4">
            <a href="/tracker.html">Открыть трекер <ArrowRight /></a>
          </Button>
        </div>
      </header>

      <main id="top">
        <section className="relative mx-auto grid min-h-[88vh] max-w-6xl items-center gap-10 px-5 py-16 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div style={{ y: titleY }} className="relative z-10">
            <Badge variant="secondary">Презентация учёта</Badge>
            <h1 className="mt-5 font-heading text-5xl leading-[1.05] font-medium tracking-tight sm:text-6xl">
              Деньги видны до конца месяца
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Счета, бюджет и отчёт живут в одном месте. Нить месяца показывает, чем закончится месяц, если дальше тратить как один выбранный день.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-11 px-5 text-base">
                <a href="/tracker.html">Перейти к учёту <ArrowRight /></a>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 px-5 text-base">
                <a href="#thread">Смотреть нить</a>
              </Button>
            </div>
          </motion.div>

          <motion.div style={{ y: boardY }} className="relative">
            <Card className="relative z-10 bg-card/90 shadow-xl">
              <CardHeader>
                <CardTitle className="font-heading text-2xl">Октябрь</CardTitle>
                <CardDescription>Зелёное — доход, тёплое — расход. День можно выбрать.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1.5">
                  {days.map((day) => (
                    <div
                      key={day}
                      className={`flex h-11 flex-col items-center justify-between rounded-md px-0.5 py-1 text-[10px] font-semibold ${
                        day === 3 ? "bg-primary/10 ring-2 ring-primary" : "bg-muted"
                      }`}
                    >
                      <span>{day}</span>
                      <span
                        className={`block w-2 rounded-full ${
                          incomeDays.has(day)
                            ? "h-4 bg-[oklch(0.55_0.12_155)]"
                            : expenseDays.has(day)
                              ? "h-3 bg-primary"
                              : "h-1 bg-transparent"
                        }`}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <motion.div style={{ y: slipY }} className="absolute -right-3 -bottom-8 z-20 w-52">
              <Card size="sm">
                <CardHeader>
                  <CardDescription>Если повторить 3 октября</CardDescription>
                  <CardTitle className="font-heading text-2xl text-primary">−380 150</CardTitle>
                </CardHeader>
              </Card>
            </motion.div>
          </motion.div>
        </section>

        <section id="layers" className="mx-auto max-w-6xl px-5 py-20">
          <div className="mb-8 flex items-end justify-between gap-6">
            <div>
              <p className="text-sm font-semibold tracking-wide text-primary uppercase">Три слоя</p>
              <h2 className="mt-2 font-heading text-4xl">Учёт, который листается, а не прячется в таблице</h2>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: Wallet, title: "Счета", text: "У каждого счёта своя валюта. Перевод между ними считает курс.", shift: 40 },
              { icon: CalendarRange, title: "Бюджет", text: "План и факт по категориям расходов за текущий месяц.", shift: 90 },
              { icon: ArrowRight, title: "Отчёт", text: "Сравнение с прошлым месяцем, норма сбережений и крупные траты.", shift: 20 },
            ].map((item) => (
              <LayerCard key={item.title} icon={item.icon} title={item.title} text={item.text} shift={item.shift} paused={paused} />
            ))}
          </div>
        </section>

        <section id="thread" ref={threadRef} className="relative h-[150vh]">
          <div className="sticky top-0 flex h-screen items-center overflow-hidden">
            <motion.div
              aria-hidden
              style={{ y: backY }}
              className="absolute inset-x-0 top-24 mx-auto flex h-80 max-w-4xl items-end justify-end rounded-[2.5rem] bg-primary/15 px-10 pb-8"
            >
              <span className="hidden font-heading text-7xl text-primary/30 md:block">Октябрь</span>
            </motion.div>
            <div className="relative mx-auto grid w-full max-w-6xl items-center gap-8 px-5 lg:grid-cols-2">
              <div>
                <Badge>Нить месяца</Badge>
                <h2 className="mt-4 font-heading text-4xl sm:text-5xl">Выберите день и проживите им остаток месяца</h2>
                <p className="mt-4 max-w-md text-muted-foreground">
                  Слева прогноз, если каждый оставшийся день будет как выбранный. Справа — если держать уже сложившийся темп.
                </p>
                <Separator className="my-6 max-w-sm" />
                <p className="text-sm text-muted-foreground">Это отдельная презентация. Сам учёт открывается в трекере.</p>
              </div>
              <motion.div style={{ x: threadX, y: threadY }}>
                <Card className="bg-card/95 shadow-2xl">
                  <CardHeader>
                    <CardTitle className="font-heading text-3xl">3 октября</CardTitle>
                    <CardDescription>Аренда 28 000. Так до конца месяца уходит в минус, текущий темп оставляет запас.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-primary/10 p-4">
                      <p className="text-xs text-muted-foreground">Повтор дня</p>
                      <p className="font-heading text-2xl text-primary">−380 150</p>
                    </div>
                    <div className="rounded-xl bg-secondary p-4">
                      <p className="text-xs text-muted-foreground">Текущий темп</p>
                      <p className="font-heading text-2xl">31 530</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </section>

        <section id="start" className="mx-auto max-w-6xl px-5 py-24">
          <h2 className="font-heading text-4xl">Три шага</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ["1", "Регистрация", "Почта и пароль. Пароль хранится только в виде шифра."],
              ["2", "Свой учёт", "Операции, счета, бюджет, цели и повторы привязаны к аккаунту."],
              ["3", "Нить", "На сводке выберите день и сравните два финала месяца."],
            ].map(([step, title, text]) => (
              <Card key={step}>
                <CardHeader>
                  <Badge variant="outline">{step}</Badge>
                  <CardTitle className="font-heading text-2xl">{title}</CardTitle>
                  <CardDescription>{text}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
          <div className="mt-10">
            <Button asChild size="lg" className="h-11 px-5 text-base">
              <a href="/tracker.html">Открыть трекер <ArrowRight /></a>
            </Button>
          </div>
        </section>
      </main>
    </div>
  )
}

function LayerCard({
  icon: Icon,
  title,
  text,
  shift,
  paused,
}: {
  icon: typeof Wallet
  title: string
  text: string
  shift: number
  paused: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })
  const y = useTransform(scrollYProgress, [0, 1], paused ? [0, 0] : [shift, -shift])

  return (
    <motion.div ref={ref} style={{ y }}>
      <Card className="h-full">
        <CardHeader>
          <Icon />
          <CardTitle className="font-heading text-2xl">{title}</CardTitle>
          <CardDescription>{text}</CardDescription>
        </CardHeader>
      </Card>
    </motion.div>
  )
}
