import Link from "next/link";
import { login } from "@/app/(auth)/actions/auth";
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

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm border-border bg-bg-secondary">
        <CardHeader className="text-center">
          <p className="eyebrow mb-2">— Animov.ai</p>
          <CardTitle className="font-display text-display-md font-normal">
            Entrar
          </CardTitle>
          <CardDescription className="font-body text-text-secondary">
            Acesse sua conta para criar vídeos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {searchParams.error && (
            <div className="mb-4 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {searchParams.error}
            </div>
          )}
          {searchParams.message && (
            <div className="mb-4 rounded-md border border-accent-gold/20 bg-accent-gold/10 px-3 py-2 text-sm text-accent-gold">
              {searchParams.message}
            </div>
          )}
          <form className="space-y-4">
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
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <Button formAction={login} className="w-full" size="lg">
              Entrar
            </Button>
          </form>
          <Separator className="my-6" />
          <p className="text-center text-sm text-text-secondary">
            Não tem conta?{" "}
            <Link
              href="/cadastro"
              className="text-accent-gold underline-offset-4 hover:underline"
            >
              Criar conta
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
