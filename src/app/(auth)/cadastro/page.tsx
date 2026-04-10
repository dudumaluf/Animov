import Link from "next/link";
import { signup } from "@/app/(auth)/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function CadastroPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm border-border bg-bg-secondary">
        <CardHeader className="text-center">
          <p className="eyebrow mb-2">— Animov.ai</p>
          <CardTitle className="font-display text-display-md font-normal">
            Criar conta
          </CardTitle>
          <CardDescription className="font-body text-text-secondary">
            Comece a criar vídeos cinematográficos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {searchParams.error && (
            <div className="mb-4 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {searchParams.error}
            </div>
          )}
          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="font-mono text-label-sm uppercase tracking-widest">
                Nome
              </Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="Seu nome"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="font-mono text-label-sm uppercase tracking-widest">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="seu@email.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="font-mono text-label-sm uppercase tracking-widest">
                Senha
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
              />
            </div>
            <Button formAction={signup} className="w-full" size="lg">
              Criar conta
            </Button>
          </form>
          <Separator className="my-6" />
          <p className="text-center text-sm text-text-secondary">
            Já tem conta?{" "}
            <Link
              href="/login"
              className="text-accent-gold underline-offset-4 hover:underline"
            >
              Entrar
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
