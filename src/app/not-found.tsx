import Link from "next/link";
import Image from "next/image";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-navy-950 px-4 text-center">
      <Image src="/images/laguna/lazer/piscina-com-palmeira.webp" alt="" fill className="object-cover opacity-20" />
      <div className="relative">
        <p className="font-display text-[8rem] leading-none text-gold-400">404</p>
        <h1 className="mt-4 font-display text-4xl text-white">Página não encontrada</h1>
        <p className="mt-3 text-navy-200">A página que procura não existe ou foi movida.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/" className={buttonClass("gold", "lg")}>
            Voltar ao início
          </Link>
          <Link href="/painel" className={buttonClass("outline", "lg", "border-white/25 bg-transparent text-white hover:bg-white/10")}>
            Área de Moradores
          </Link>
        </div>
      </div>
    </main>
  );
}
